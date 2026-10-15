package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.dto.SaleResponseDTO;
import com.ferreteria.PuntoDeVenta.exception.ResourceNotFoundException;
import com.ferreteria.PuntoDeVenta.model.*;
import com.ferreteria.PuntoDeVenta.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.w3c.dom.*;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.*;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Slf4j
@Service
@RequiredArgsConstructor
public class CfdiService {

    private final SaleRepository         saleRepository;
    private final EmpresaRepository      empresaRepository;
    private final CustomerRepository     customerRepository;
    private final CfdiTimbradoRepository cfdiTimbradoRepository;
    private final PrefacturaRepository   prefacturaRepository;
    private final ConfiguracionFacturacionService configuracionFacturacionService;

    private static final BigDecimal TASA_IVA = new BigDecimal("0.160000");
    private static final BigDecimal DIVISOR_IVA = BigDecimal.ONE.add(new BigDecimal("0.16"));
    private static final DateTimeFormatter FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss");

    private static final String URL_PRUEBAS    =
            "http://app.fel.mx/CR33Test/ConexionRemota.svc";
    private static final String URL_PRODUCCION =
            "https://www.fel.mx/CR33/ConexionRemota.svc";
    private static final String SOAP_ACTION_GENERAR =
            "http://tempuri.org/IConexionRemota/GenerarCFDI40";
    private static final String SOAP_ACTION_CANCELAR =
            "http://tempuri.org/IConexionRemota/CancelarCFDIsV4";

    @Value("${fel.usuario:}")  private String felUsuarioEnv;
    @Value("${fel.cuenta:}")   private String felCuentaEnv;
    @Value("${fel.password:}") private String felPasswordEnv;
   @Value("${fel.ambiente:pruebas}") private String felAmbienteEnvFallback;

     private static final BigDecimal TASA_RET_ISR_RESICO = new BigDecimal("0.0125");

    private static final String CLAVE_PROD_DEFAULT  = "01010101";
    private static final String CLAVE_UNIDAD_DEFAULT = "H87";
    private static final String OBJETO_IMP_DEFAULT   = "02";

     @Transactional
    public CfdiTimbrado timbrarVenta(Long saleId) {
        if (cfdiTimbradoRepository.existsBySaleIdAndStatusNot(saleId, "CANCELADO")) {
            throw new RuntimeException(
                    "Esta venta ya tiene un CFDI timbrado vigente. UUID: " +
                            cfdiTimbradoRepository
                                    .findFirstBySaleIdAndStatusNotOrderByFechaTimbradoDesc(
                                            saleId, "CANCELADO")
                                    .map(CfdiTimbrado::getUuid).orElse("?"));
        }
       Sale ventaPrevia = saleRepository.findById(saleId).orElse(null);
        if (ventaPrevia != null
                && Boolean.TRUE.equals(ventaPrevia.getIncluidoFacturaGlobal())) {
            throw new RuntimeException(
                    "Esta venta ya está incluida en una factura global vigente. "
                            + "Para facturarla a un cliente, primero cancela la "
                            + "global y reemítela sin esta venta (Apéndice 2 de la "
                            + "guía del SAT).");
        }

        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Venta no encontrada: " + saleId));

        if (sale.getCustomer() == null)
            throw new RuntimeException(
                    "La venta no tiene cliente asignado. No se puede facturar.");

       if ("CANCELLED".equals(sale.getStatus())) {
            throw new IllegalStateException(
                    "La venta " + sale.getInvoiceNumber() + " está CANCELADA: "
                            + "no se puede facturar. El SAT tendría una factura de una "
                            + "venta que no ocurrió.");
        }

        Empresa empresa = obtenerEmpresa();
        Credenciales creds = obtenerCredenciales(empresa);
        String xmlSoap = construirSoapGenerarCFDI40(sale, empresa);

        log.info("[CFDI] Enviando a FEL — venta #{}, cliente {}, total {}",
                saleId, sale.getCustomer().getFullName(), sale.getTotalAmount());

        String respuestaSoap = invocarSoap(xmlSoap, SOAP_ACTION_GENERAR, creds);
        return procesarRespuestaTimbrado(respuestaSoap, sale, null, empresa);
    }

    @Transactional
    public CfdiTimbrado timbrarPrefactura(Long prefacturaId) {
        if (cfdiTimbradoRepository.existsByPrefacturaIdAndStatusNot(prefacturaId, "CANCELADO")) {
            throw new RuntimeException(
                    "Esta pre-factura ya tiene un CFDI timbrado.");
        }

        Prefactura pref = prefacturaRepository.findById(prefacturaId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Pre-factura no encontrada: " + prefacturaId));

        Empresa empresa = obtenerEmpresa();
        Credenciales creds = obtenerCredenciales(empresa);
        String xmlSoap = construirSoapGenerarCFDI40Prefactura(pref, empresa);

        String respuestaSoap = invocarSoap(xmlSoap, SOAP_ACTION_GENERAR, creds);
        return procesarRespuestaTimbrado(respuestaSoap, null, pref, empresa);
    }

    @Transactional
    public synchronized CfdiTimbrado timbrarFacturaGlobal(List<Long> saleIds) {
        if (saleIds == null || saleIds.isEmpty())
            throw new RuntimeException(
                    "No hay ventas del periodo para facturar.");

        List<Sale> ventas = saleRepository.findAllById(saleIds);
        if (ventas.isEmpty())
            throw new RuntimeException("No se encontraron las ventas indicadas.");

        long yaIncluidas = ventas.stream()
                .filter(v -> Boolean.TRUE.equals(v.getIncluidoFacturaGlobal()))
                .count();
        if (yaIncluidas > 0)
            throw new RuntimeException(
                    yaIncluidas + " venta(s) ya fueron incluidas en una factura global anterior.");

        List<Sale> canceladas = ventas.stream()
                .filter(v -> "CANCELLED".equals(v.getStatus()))
                .toList();
        if (!canceladas.isEmpty())
            throw new RuntimeException(
                    "Hay " + canceladas.size() + " venta(s) CANCELADAS en la lista ("
                            + canceladas.stream().map(Sale::getInvoiceNumber)
                            .reduce((a, b) -> a + ", " + b).orElse("")
                            + "). Quítalas antes de timbrar la global.");

        List<Sale> conCfdiNominativo = ventas.stream()
                .filter(v -> cfdiTimbradoRepository
                        .existsBySaleIdAndStatusNot(v.getId(), "CANCELADO"))
                .toList();
        if (!conCfdiNominativo.isEmpty())
            throw new RuntimeException(
                    "Hay " + conCfdiNominativo.size() + " venta(s) que YA tienen factura "
                            + "nominativa timbrada ("
                            + conCfdiNominativo.stream().map(Sale::getInvoiceNumber)
                            .reduce((a, b) -> a + ", " + b).orElse("")
                            + "). No pueden ir también en la global: el ingreso "
                            + "se declararía dos veces.");

        List<Sale> sinMonto = ventas.stream()
                .filter(v -> v.getTotalAmount() == null
                        || v.getTotalAmount().compareTo(BigDecimal.ZERO) <= 0)
                .toList();
        if (!sinMonto.isEmpty())
            throw new RuntimeException(
                    "Hay " + sinMonto.size() + " venta(s) con total inválido o en cero ("
                            + sinMonto.stream().map(Sale::getInvoiceNumber)
                            .reduce((a, b) -> a + ", " + b).orElse("")
                            + "). Revísalas antes de timbrar.");

        java.util.Set<java.time.YearMonth> meses = ventas.stream()
                .map(v -> java.time.YearMonth.from(v.getCreatedAt()))
                .collect(java.util.stream.Collectors.toSet());
        if (meses.size() > 1)
            throw new RuntimeException(
                    "Las ventas seleccionadas pertenecen a meses distintos ("
                            + meses.stream().map(java.time.YearMonth::toString)
                            .sorted().reduce((a, b) -> a + ", " + b).orElse("")
                            + "). La factura global lleva un solo mes en "
                            + "InformacionGlobal: timbra cada mes por separado.");
        java.time.YearMonth periodo = meses.iterator().next();

        Empresa empresa = obtenerEmpresa();
        Credenciales creds = obtenerCredenciales(empresa);

        BigDecimal totalGlobal = ventas.stream()
                .map(Sale::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        String xmlSoap = construirSoapFacturaGlobal(ventas, empresa, periodo);

        log.info("[CFDI] Factura Global QUINCENAL — {} ventas (un concepto c/u), "
                        + "total {}, periodo {}",
                ventas.size(), totalGlobal, periodo);

        if (ventas.size() > 500)
            log.warn("[CFDI] La global de {} lleva {} conceptos. Si el PAC la "
                            + "rechaza por tamaño, divide la quincena en varias "
                            + "globales (el SAT lo permite).",
                    periodo, ventas.size());

        String respuestaSoap = invocarSoap(xmlSoap, SOAP_ACTION_GENERAR, creds);
        CfdiTimbrado cfdi = procesarRespuestaTimbrado(
                respuestaSoap, null, null, empresa);

        cfdi.setTotal(totalGlobal);
        cfdi.setRfcReceptor("XAXX010101000");
        cfdi.setNombreReceptor("PUBLICO EN GENERAL — Factura Global "
                + periodo + " (" + ventas.size() + " venta"
                + (ventas.size() == 1 ? "" : "s") + ")");
        cfdi = cfdiTimbradoRepository.save(cfdi);

       final CfdiTimbrado cfdiGlobal = cfdi;
        ventas.forEach(v -> {
            v.setIncluidoFacturaGlobal(true);
            v.setCfdiGlobal(cfdiGlobal);
        });
        saleRepository.saveAll(ventas);

        return cfdi;
    }

   private String construirSoapFacturaGlobal(
            List<Sale> ventas, Empresa empresa, java.time.YearMonth periodo) {

        StringBuilder conceptos = new StringBuilder();
        BigDecimal subtotalGlobal = BigDecimal.ZERO;
        BigDecimal ivaGlobal      = BigDecimal.ZERO;
        BigDecimal totalGlobal    = BigDecimal.ZERO;

        for (Sale venta : ventas) {
            BigDecimal totalVenta = venta.getTotalAmount()
                    .setScale(2, RoundingMode.HALF_UP);

            BigDecimal baseVenta = totalVenta.divide(
                    DIVISOR_IVA, 2, RoundingMode.HALF_UP);
            BigDecimal ivaVenta = totalVenta.subtract(baseVenta);

            String folioTicket = venta.getInvoiceNumber() != null
                    && !venta.getInvoiceNumber().isBlank()
                    ? venta.getInvoiceNumber()
                    : String.valueOf(venta.getId());

            conceptos.append(construirConceptoSimple(
                    "Venta",            
                    folioTicket,        
                    CLAVE_PROD_DEFAULT, 
                    "ACT",             
                    BigDecimal.ONE,     
                    baseVenta,          
                    baseVenta,          
                    ivaVenta            
            ));

            subtotalGlobal = subtotalGlobal.add(baseVenta);
            ivaGlobal      = ivaGlobal.add(ivaVenta);
            totalGlobal    = totalGlobal.add(totalVenta);
        }

        String fecha = LocalDateTime.now(ZoneId.of("America/Mazatlan")).format(FMT);
        String folio = String.valueOf(
                empresa.getFolioActual() != null ? empresa.getFolioActual() : 1);

        Customer clientePublico = ventas.get(0).getCustomer();

        return soapEnvelope(
                construirComprobante40(
                        empresa, clientePublico, conceptos.toString(),
                        subtotalGlobal, ivaGlobal, totalGlobal,
                        fecha, folio, empresa.getSerie(),
                        "01",   
                        "PUE",
                        periodo 
                )
        );
    }

    @Transactional
    public void cancelarCfdi(String uuid, String motivo) {
        CfdiTimbrado cfdi = cfdiTimbradoRepository.findByUuid(uuid)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "CFDI no encontrado con UUID: " + uuid));

        if ("CANCELADO".equals(cfdi.getStatus()))
            throw new RuntimeException("Este CFDI ya está cancelado.");

        Empresa empresa = obtenerEmpresa();
        Credenciales creds = obtenerCredenciales(empresa);

        if (empresa.getFelPin() == null || empresa.getFelPin().isBlank()) {
            throw new RuntimeException(
                    "PIN de cancelación no configurado. " +
                            "Ve a fel.blikon.com → Configurar PIN, y guarda el PIN en la " +
                            "tabla empresa campo fel_pin.");
        }

        String xmlSoap = construirSoapCancelar(uuid, motivo, empresa);
        log.info("[CFDI] Enviando cancelación a FEL — UUID {}", uuid);
        String respuesta = invocarSoap(xmlSoap, SOAP_ACTION_CANCELAR, creds);

        log.info("[CFDI] Respuesta de cancelación FEL:\n{}", respuesta);

       
        boolean operacionExitosa = respuesta.contains("<a:OperacionExitosa>true</a:OperacionExitosa>");

        String textoRespuesta = (respuesta == null ? "" : respuesta).toLowerCase();
        boolean yaEstabaCancelado = textoRespuesta.contains("ya se encuentra cancelado")
                || textoRespuesta.contains("previamente cancelado")
                || textoRespuesta.contains("folio fiscal previamente cancelado");

        if (!operacionExitosa && !yaEstabaCancelado) {
            String error = extraerErrorCancelacion(respuesta);
            throw new RuntimeException(
                    mensajeAmigableFel(error, null).startsWith("⚠️")
                            ? mensajeAmigableFel(error, null)
                            : "FEL rechazó la cancelación: " + error + ". El CFDI permanece vigente.");
        }

       
        String estatusCod = extraerEstatusCancelacion(respuesta);
        String mensajeFel = extraerMensajeErrorUuid(respuesta);
        log.info("[CFDI] Estatus cancelación — UUID {} código: {} mensaje: {}",
                uuid, estatusCod, mensajeFel);

        boolean esperaAceptacion = respuesta.contains("Cancelable con aceptación")
                || respuesta.contains("EnProceso");

        if (mensajeFel != null && mensajeFel.toLowerCase().contains("ya se encuentra cancelado")) {
            yaEstabaCancelado = true;
        }

        if ("201".equals(estatusCod) || "202".equals(estatusCod) || yaEstabaCancelado) {
            cfdi.setStatus("CANCELADO");
            cfdi.setCanceladoAt(LocalDateTime.now());
            cfdi.setCancelReason(motivo
                    + ("202".equals(estatusCod) || yaEstabaCancelado
                    ? " | SAT: previamente cancelado" : ""));
            cfdiTimbradoRepository.save(cfdi);

            if (cfdi.getSale() == null && cfdi.getPrefactura() == null) {
                List<Sale> ventasLigadas = saleRepository
                        .findByCfdiGlobalIdOrderByCreatedAtAsc(cfdi.getId());
                if (!ventasLigadas.isEmpty()) {
                    ventasLigadas.forEach(v -> {
                        v.setIncluidoFacturaGlobal(false);
                        v.setCfdiGlobal(null);
                    });
                    saleRepository.saveAll(ventasLigadas);
                    log.info("[CFDI] {} venta(s) liberadas de la global cancelada — "
                            + "podrán incluirse en una nueva global", ventasLigadas.size());
                }
            }
            if (yaEstabaCancelado && !"202".equals(estatusCod)) {
                log.info("[CFDI] El SAT reporta el UUID {} como YA cancelado — "
                        + "se sincroniza el estatus local a CANCELADO", uuid);
            }
            log.info("[CFDI] CFDI cancelado exitosamente — UUID {}", uuid);

        } else if (esperaAceptacion && ("EnProceso".equals(estatusCod)
                || "En proceso".equalsIgnoreCase(mensajeFel))) {
            cfdi.setStatus("CANCELACION_PENDIENTE");
            cfdi.setCanceladoAt(LocalDateTime.now());
            cfdi.setCancelReason(motivo + " | SAT: EN PROCESO (72h)");
            cfdiTimbradoRepository.save(cfdi);
            throw new RuntimeException(
                    "Cancelación EN PROCESO: el receptor tiene 72h para aceptar o rechazar. UUID: " + uuid);

        } else if ("209".equals(estatusCod)) {
            
            throw new RuntimeException(
                    "El SAT rechazó la cancelación (209): se envió folio de "
                            + "sustitución sin necesitarlo. Si acabas de actualizar el "
                            + "sistema, vuelve a intentar; si sigue igual, cancélalo "
                            + "desde el portal de FEL.");

        } else {
            throw new RuntimeException(
                    "El SAT no aceptó la cancelación (código " + estatusCod
                            + (mensajeFel != null && !mensajeFel.isBlank()
                            ? " — " + mensajeFel : "")
                            + "). El CFDI permanece VIGENTE. "
                            + "Verifica en fel.blikon.com o intenta cancelarlo desde el portal.");
        }
    }

    private String extraerEstatusCancelacion(String respuesta) {
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                "<a:RespuestaServicio>\\s*(\\d{3})\\s*</a:RespuestaServicio>");
        java.util.regex.Matcher m = p.matcher(respuesta);
        if (m.find()) return m.group(1);

        p = java.util.regex.Pattern.compile(
                "EstatusUUID(?:>|&gt;)\\s*(\\d{3})\\s*(?:<|&lt;)");
        m = p.matcher(respuesta);
        if (m.find()) return m.group(1);

        p = java.util.regex.Pattern.compile(
                "EstatusCancelacion[^>]*>\\s*(\\d{3})\\s*<");
        m = p.matcher(respuesta);
        if (m.find()) return m.group(1);

        return "DESCONOCIDO";
    }

    private String extraerMensajeErrorUuid(String respuesta) {
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                "<a:MensajeError>([^<]*)</a:MensajeError>");
        java.util.regex.Matcher m = p.matcher(respuesta);
        if (m.find()) return m.group(1).trim();
        return "";
    }

    private void descontarCreditoFel() {
        try {
            Empresa emp = empresaRepository.findAll().stream().findFirst().orElse(null);
            if (emp != null && emp.getFelCreditosDisponibles() != null
                    && emp.getFelCreditosDisponibles() > 0) {
                emp.setFelCreditosDisponibles(emp.getFelCreditosDisponibles() - 1);
                empresaRepository.save(emp);
                if (emp.getFelCreditosDisponibles() <= 20) {
                    log.warn("[CFDI] ⚠️ Quedan solo {} créditos de FEL",
                            emp.getFelCreditosDisponibles());
                }
            }
        } catch (Exception ex) {
            log.warn("[CFDI] No se pudo descontar crédito local: {}", ex.getMessage());
        }
    }

    public Integer consultarCreditosLocales() {
        Empresa emp = empresaRepository.findAll().stream().findFirst().orElse(null);
        return emp != null ? emp.getFelCreditosDisponibles() : null;
    }

    public Integer ajustarCreditosLocales(Integer nuevoValor) {
        Empresa emp = empresaRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new RuntimeException("Empresa no configurada"));
        emp.setFelCreditosDisponibles(nuevoValor);
        empresaRepository.save(emp);
        log.info("[CFDI] Contador de créditos FEL ajustado a {}", nuevoValor);
        return nuevoValor;
    }

    private String mensajeAmigableFel(String err, String det) {
        String todo = ((err != null ? err : "") + " " +
                (det != null ? det : "")).toLowerCase();

        boolean sinTimbres =
                todo.contains("credito") || todo.contains("crédito")
                        || todo.contains("timbre") || todo.contains("saldo")
                        || todo.contains("folios disponibles")
                        || todo.contains("sin folios")
                        || todo.contains("insuficiente")
                        || todo.contains("agotad")            
                        || todo.contains("no cuenta con")
                        || todo.contains("vigencia") || todo.contains("vencid");

        if (sinTimbres) {
            return "⚠️ SE ACABARON LOS TIMBRES DE FACTURACIÓN (o el paquete venció). "
                    + "No se puede facturar hasta recargar timbres en FEL. "
                    + "Entra a fel.blikon.com para comprar más o contacta al programador. "
                    + "Detalle de FEL: " + (err != null ? err : "")
                    + (det != null && !det.isBlank() ? " — " + det : "");
        }
        return "FEL rechazó el CFDI: " + (err != null ? err : "error desconocido")
                + (det != null && !det.isBlank() ? " — " + det : "");
    }

    private String extraerErrorCancelacion(String respuesta) {
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                "<[^>]*[Ee]rror[^>]*>([^<]{3,200})<");
        java.util.regex.Matcher m = p.matcher(respuesta);
        if (m.find()) return m.group(1).trim();
        p = java.util.regex.Pattern.compile(
                "<[^>]*[Mm]ensaje[^>]*>([^<]{3,200})<");
        m = p.matcher(respuesta);
        if (m.find()) return m.group(1).trim();
        return "Revisa el log del servidor para ver la respuesta completa de FEL.";
    }

    private String construirSoapGenerarCFDI40(Sale sale, Empresa empresa) {
        Customer cliente = sale.getCustomer();
        List<SaleItem> items = sale.getItems();

        boolean esPublicoGeneral = cliente.getRfc() != null
                && "XAXX010101000".equals(cliente.getRfc());

        BigDecimal subtotal;
        BigDecimal ivaTotal;
        BigDecimal total;
        StringBuilder conceptos = new StringBuilder();

        if (esPublicoGeneral) {
            total = sale.getTotalAmount().setScale(2, RoundingMode.HALF_UP);
            subtotal = total.divide(DIVISOR_IVA, 2, RoundingMode.HALF_UP);
            ivaTotal = total.subtract(subtotal);

            String folioTicket = sale.getInvoiceNumber() != null
                    && !sale.getInvoiceNumber().isBlank()
                    ? sale.getInvoiceNumber()
                    : String.valueOf(sale.getId());

            conceptos.append(construirConceptoSimple(
                    "Venta", folioTicket,
                    CLAVE_PROD_DEFAULT, "ACT",
                    BigDecimal.ONE, subtotal, subtotal, ivaTotal
            ));
        } else {
            boolean retenerIsr = esPersonaMoral(cliente.getRfc());

            BigDecimal sub  = BigDecimal.ZERO;
            BigDecimal ivas = BigDecimal.ZERO;
            BigDecimal rets = BigDecimal.ZERO;

            for (SaleItem item : items) {
                BigDecimal baseUnit = item.getUnitPrice().divide(
                        DIVISOR_IVA, 6, RoundingMode.HALF_UP);
                BigDecimal importe  = baseUnit.multiply(item.getQuantity())
                        .setScale(2, RoundingMode.HALF_UP);
                BigDecimal ivaItem  = importe.multiply(TASA_IVA)
                        .setScale(2, RoundingMode.HALF_UP);
                BigDecimal retItem  = retenerIsr
                        ? importe.multiply(TASA_RET_ISR_RESICO)
                        .setScale(2, RoundingMode.HALF_UP)
                        : null;

                Product p = item.getProduct();
                String claveProd = p.getSatClaveProdServ() != null
                        && !p.getSatClaveProdServ().isBlank()
                        ? p.getSatClaveProdServ() : CLAVE_PROD_DEFAULT;
                String claveUnidad = p.getSatClaveUnidad() != null
                        && !p.getSatClaveUnidad().isBlank()
                        ? p.getSatClaveUnidad() : CLAVE_UNIDAD_DEFAULT;

                String descripcion = item.getCustomName() != null
                        && !item.getCustomName().isBlank()
                        ? item.getCustomName() : p.getName();

                conceptos.append(construirConceptoSimple(
                        descripcion, p.getSku(), claveProd, claveUnidad,
                        item.getQuantity(),
                        baseUnit.setScale(2, RoundingMode.HALF_UP),
                        importe, ivaItem, retItem));

                sub  = sub.add(importe);
                ivas = ivas.add(ivaItem);
                if (retItem != null) rets = rets.add(retItem);
            }

            subtotal = sub;
            ivaTotal = ivas;
            total = sub.add(ivas).subtract(rets)
                    .setScale(2, RoundingMode.HALF_UP);

            if (retenerIsr) {
                log.info("[CFDI] Receptor persona moral ({}) — retención ISR "
                                + "1.25% aplicada: {} (Art. 113-J LISR)",
                        cliente.getRfc(), rets.toPlainString());
            }
        }

        return soapEnvelope(
                construirComprobante40(
                        empresa, cliente, conceptos.toString(),
                        subtotal, ivaTotal, total,
                        
                        LocalDateTime.now(ZoneId.of("America/Mazatlan")).format(FMT),
                        String.valueOf(empresa.getFolioActual() != null
                                ? empresa.getFolioActual() : 1),
                        empresa.getSerie(),
                        mapFormaPago(sale.getPaymentMethod()),
                        mapMetodoPago(sale.getPaymentMethod()),
                        
                        sale.getCreatedAt() != null
                                ? java.time.YearMonth.from(sale.getCreatedAt())
                                : null
                )
        );
    }

    private String construirSoapGenerarCFDI40Prefactura(
            Prefactura pref, Empresa empresa) {

        BigDecimal subtotal;
        Customer cliente = pref.getCustomer();
        boolean retenerIsr = esPersonaMoral(
                cliente != null ? cliente.getRfc() : null);

        BigDecimal sub  = BigDecimal.ZERO;
        BigDecimal ivas = BigDecimal.ZERO;
        BigDecimal rets = BigDecimal.ZERO;

        StringBuilder conceptos = new StringBuilder();
        for (var item : pref.getItems()) {
            BigDecimal baseUnit = item.getUnitPrice().divide(
                    DIVISOR_IVA, 6, RoundingMode.HALF_UP);
            BigDecimal importe  = baseUnit.multiply(item.getQuantity())
                    .setScale(2, RoundingMode.HALF_UP);
            BigDecimal iva      = importe.multiply(TASA_IVA)
                    .setScale(2, RoundingMode.HALF_UP);
            BigDecimal retItem  = retenerIsr
                    ? importe.multiply(TASA_RET_ISR_RESICO)
                    .setScale(2, RoundingMode.HALF_UP)
                    : null;
            conceptos.append(construirConceptoSimple(
                    item.getProductName(), item.getProductSku(),
                    CLAVE_PROD_DEFAULT, CLAVE_UNIDAD_DEFAULT,
                    item.getQuantity(), baseUnit.setScale(2, RoundingMode.HALF_UP),
                    importe, iva, retItem
            ));
            sub  = sub.add(importe);
            ivas = ivas.add(iva);
            if (retItem != null) rets = rets.add(retItem);
        }

        subtotal = sub;
        BigDecimal ivaTotal = ivas;
        BigDecimal totalCfdi = sub.add(ivas).subtract(rets)
                .setScale(2, RoundingMode.HALF_UP);
        if (retenerIsr) {
            log.info("[CFDI] Prefactura a persona moral ({}) — retención ISR "
                    + "1.25% aplicada: {}", cliente.getRfc(), rets.toPlainString());
        }
        return soapEnvelope(
                construirComprobante40(
                        empresa, cliente, conceptos.toString(),
                        subtotal, ivaTotal, totalCfdi,
                        // Fecha del CFDI = momento del timbrado (regla SAT 72h)
                        LocalDateTime.now(ZoneId.of("America/Mazatlan")).format(FMT),
                        pref.getFolio(),
                        empresa.getSerie(),
                        "01", "PUE"
                )
        );
    }

    private String construirComprobante40(
            Empresa empresa, Customer cliente,
            String conceptosXml,
            BigDecimal subtotal, BigDecimal ivaTotal, BigDecimal total,
            String fecha, String folio, String serie,
            String formaPago, String metodoPago) {
        return construirComprobante40(empresa, cliente, conceptosXml,
                subtotal, ivaTotal, total, fecha, folio, serie,
                formaPago, metodoPago, null);
    }

    private String construirComprobante40(
            Empresa empresa, Customer cliente,
            String conceptosXml,
            BigDecimal subtotal, BigDecimal ivaTotal, BigDecimal total,
            String fecha, String folio, String serie,
            String formaPago, String metodoPago,
            java.time.YearMonth periodoGlobal) {

        String nombreReceptor = cliente.getRazonSocial() != null
                ? cliente.getRazonSocial() : cliente.getFullName();
        String rfcReceptor = cliente.getRfc() != null
                ? cliente.getRfc() : "XAXX010101000";
        String cpReceptor = cliente.getCodigoPostal() != null
                ? cliente.getCodigoPostal() : "00000";
        String regimenReceptor = cliente.getRegimenFiscal() != null
                ? cliente.getRegimenFiscal() : "616";
        String usoCfdi = cliente.getUsoCfdi() != null
                ? cliente.getUsoCfdi() : "S01";

        boolean esPublicoGeneral = "XAXX010101000".equals(rfcReceptor);
        String informacionGlobal = "";
        if (esPublicoGeneral) {
            java.time.YearMonth ym = periodoGlobal != null
                    ? periodoGlobal
                    : java.time.YearMonth.now();
            String periodicidad = configuracionFacturacionService
                    .periodicidadActual().getCodigoSat();
            informacionGlobal = "<tes:InformacionGlobal>"
                    + "<tes:Año>" + ym.getYear() + "</tes:Año>"
                    + "<tes:Meses>" + String.format("%02d", ym.getMonthValue()) + "</tes:Meses>"
                    + "<tes:Periodicidad>" + periodicidad + "</tes:Periodicidad>"
                    + "</tes:InformacionGlobal>";
        }

        return "<tes:ClaveCFDI>FAC</tes:ClaveCFDI>"
                + "<tes:Conceptos>" + conceptosXml + "</tes:Conceptos>"
                + "<tes:Emisor>"
                + "<tes:Nombre>" + esc(empresa.getRazonSocial()) + "</tes:Nombre>"
                + "<tes:RegimenFiscal>" + esc(empresa.getRegimenFiscal()) + "</tes:RegimenFiscal>"
                + "</tes:Emisor>"
                + "<tes:Exportacion>01</tes:Exportacion>"
                + "<tes:FormaPago>" + formaPago + "</tes:FormaPago>"
                + informacionGlobal
                + "<tes:LugarExpedicion>" + esc(empresa.getCodigoPostal()) + "</tes:LugarExpedicion>"
                + "<tes:MetodoPago>" + metodoPago + "</tes:MetodoPago>"
                + "<tes:Moneda>MXN</tes:Moneda>"
                + "<tes:Receptor>"
                + "<tes:DomicilioFiscalReceptor>" + esc(cpReceptor) + "</tes:DomicilioFiscalReceptor>"
                + "<tes:Nombre>" + esc(nombreReceptor) + "</tes:Nombre>"
                + "<tes:RegimenFiscalReceptor>" + esc(regimenReceptor) + "</tes:RegimenFiscalReceptor>"
                + "<tes:Rfc>" + esc(rfcReceptor) + "</tes:Rfc>"
                + "<tes:UsoCFDI>" + esc(usoCfdi) + "</tes:UsoCFDI>"
                + "</tes:Receptor>"
                + (folio != null && !folio.isBlank()
                ? "<tes:Referencia>" + esc(folio) + "</tes:Referencia>" : "")
                + "<tes:SubTotal>" + subtotal.toPlainString() + "</tes:SubTotal>"
                + "<tes:TipoCambio>1</tes:TipoCambio>"
                + "<tes:Total>" + total.toPlainString() + "</tes:Total>";
    }

    private String construirConcepto40(
            Product producto, BigDecimal qty, BigDecimal unitPriceConIva) {

        BigDecimal baseUnit = unitPriceConIva.divide(
                DIVISOR_IVA, 6, RoundingMode.HALF_UP);
        BigDecimal importe  = baseUnit.multiply(qty)
                .setScale(2, RoundingMode.HALF_UP);
        BigDecimal iva      = importe.multiply(TASA_IVA)
                .setScale(2, RoundingMode.HALF_UP);

        String claveProd = producto.getSatClaveProdServ() != null
                && !producto.getSatClaveProdServ().isBlank()
                ? producto.getSatClaveProdServ() : CLAVE_PROD_DEFAULT;
        String claveUnidad = producto.getSatClaveUnidad() != null
                && !producto.getSatClaveUnidad().isBlank()
                ? producto.getSatClaveUnidad() : CLAVE_UNIDAD_DEFAULT;

        return construirConceptoSimple(
                producto.getName(),
                producto.getSku(),
                claveProd, claveUnidad,
                qty, baseUnit.setScale(2, RoundingMode.HALF_UP),
                importe, iva
        );
    }

    private boolean esPersonaMoral(String rfc) {
        return rfc != null && rfc.trim().length() == 12;
    }

    private String construirConceptoSimple(
            String nombre, String sku,
            String claveProd, String claveUnidad,
            BigDecimal qty, BigDecimal valorUnitario,
            BigDecimal importe, BigDecimal iva) {
        return construirConceptoSimple(nombre, sku, claveProd, claveUnidad,
                qty, valorUnitario, importe, iva, null);
    }

    private String construirConceptoSimple(
            String nombre, String sku,
            String claveProd, String claveUnidad,
            BigDecimal qty, BigDecimal valorUnitario,
            BigDecimal importe, BigDecimal iva,
            BigDecimal isrRetenido ) {

        String retencionesXml = "";
        if (isrRetenido != null) {
            retencionesXml = "<tes:Retenciones>"
                    + "<tes:RetencionConcepto40R>"
                    + "<tes:Base>" + importe.toPlainString() + "</tes:Base>"
                    + "<tes:Importe>" + isrRetenido.toPlainString() + "</tes:Importe>"
                    + "<tes:Impuesto>001</tes:Impuesto>"
                    + "<tes:TasaOCuota>0.012500</tes:TasaOCuota>"
                    + "<tes:TipoFactor>Tasa</tes:TipoFactor>"
                    + "</tes:RetencionConcepto40R>"
                    + "</tes:Retenciones>";
        }

        return "<tes:Concepto40R>"
                + "<tes:Cantidad>" + qty.toPlainString() + "</tes:Cantidad>"
                + "<tes:ClaveProdServ>" + esc(claveProd) + "</tes:ClaveProdServ>"
                + "<tes:ClaveUnidad>" + esc(claveUnidad) + "</tes:ClaveUnidad>"
                + "<tes:Descripcion>" + esc(nombre) + "</tes:Descripcion>"
                + "<tes:Importe>" + importe.toPlainString() + "</tes:Importe>"
                + "<tes:Impuestos>"
                + retencionesXml
                + "<tes:Traslados>"
                + "<tes:TrasladoConcepto40R>"
                + "<tes:Base>" + importe.toPlainString() + "</tes:Base>"
                + "<tes:Importe>" + iva.toPlainString() + "</tes:Importe>"
                + "<tes:Impuesto>002</tes:Impuesto>"
                + "<tes:TasaOCuota>0.160000</tes:TasaOCuota>"
                + "<tes:TipoFactor>Tasa</tes:TipoFactor>"
                + "</tes:TrasladoConcepto40R>"
                + "</tes:Traslados>"
                + "</tes:Impuestos>"
                + "<tes:NoIdentificacion>" + esc(sku != null ? sku : "") + "</tes:NoIdentificacion>"
                + "<tes:ObjetoImp>02</tes:ObjetoImp>"
                + "<tes:ValorUnitario>" + valorUnitario.toPlainString() + "</tes:ValorUnitario>"
                + "</tes:Concepto40R>";
    }

    private String construirSoapCancelar(
            String uuid, String motivo, Empresa empresa) {

       String motivoClave = "02";

        String folioSustitucionXml = "01".equals(motivoClave)
                ? "<tes:FolioSustitucion>" + motivo + "</tes:FolioSustitucion>"
                : "";

        return "<soapenv:Envelope"
                + " xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\""
                + " xmlns:tem=\"http://tempuri.org/\""
                + " xmlns:i=\"http://www.w3.org/2001/XMLSchema-instance\""
                + " xmlns:tes=\"http://schemas.datacontract.org/2004/07/TES.V33.CFDI.Negocios\">"
                + "<soapenv:Header/>"
                + "<soapenv:Body>"
                + "<tem:CancelarCFDIsV4>"
                + "<tem:credenciales>"
                + "<tes:Cuenta>" + esc(empresa.getFelCuenta()) + "</tes:Cuenta>"
                + "<tes:NIP>" + esc(empresa.getFelPin()) + "</tes:NIP>"
                + "<tes:Password>" + esc(empresa.getFelPassword()) + "</tes:Password>"
                + "<tes:Usuario>" + esc(empresa.getFelUsuario()) + "</tes:Usuario>"
                + "</tem:credenciales>"
                + "<tem:uuids>"
                + "<tes:UUIDMotivoCancelacionCR>"
                + folioSustitucionXml
                + "<tes:Motivo>" + motivoClave + "</tes:Motivo>"
                + "<tes:UUID>" + uuid + "</tes:UUID>"
                + "</tes:UUIDMotivoCancelacionCR>"
                + "</tem:uuids>"
                + "</tem:CancelarCFDIsV4>"
                + "</soapenv:Body>"
                + "</soapenv:Envelope>";
    }

    private String soapEnvelope(String comprobante40Xml) {
        return "<soapenv:Envelope"
                + " xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\""
                + " xmlns:tem=\"http://tempuri.org/\""
                + " xmlns:tes=\"http://schemas.datacontract.org/2004/07/TES.V33.CFDI.Negocios\">"
                + "<soapenv:Header/>"
                + "<soapenv:Body>"
                + "<tem:GenerarCFDI40>"
                + "<tem:cfdi>"
                + comprobante40Xml
                + "</tem:cfdi>"
                + "</tem:GenerarCFDI40>"
                + "</soapenv:Body>"
                + "</soapenv:Envelope>";
    }

    public String obtenerAmbienteFel() {
        Empresa emp = empresaRepository.findAll().stream().findFirst().orElse(null);
        if (emp != null && emp.getFelAmbiente() != null && !emp.getFelAmbiente().isBlank()) {
            return emp.getFelAmbiente().toUpperCase();
        }
        return felAmbienteEnvFallback.toUpperCase();
    }

    @Transactional
    public String cambiarAmbienteFel(String nuevoAmbiente) {
        String normalizado = "PRUEBAS".equalsIgnoreCase(nuevoAmbiente) ? "PRUEBAS" : "PRODUCCION";
        Empresa emp = empresaRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new RuntimeException(
                        "No hay datos de la empresa capturados todavía."));
        emp.setFelAmbiente(normalizado);
        empresaRepository.save(emp);
        log.info("[FEL] Ambiente cambiado a {}", normalizado);
        return normalizado;
    }

    private String invocarSoap(String xmlBody, String soapAction,
                               Credenciales creds) {
        String endpoint = "PRUEBAS".equalsIgnoreCase(obtenerAmbienteFel())
                ? URL_PRUEBAS : URL_PRODUCCION;

        String xmlFinal = inyectarCredenciales(xmlBody, creds);

        String xmlLog = xmlFinal.replaceAll(
                "<tes:Password>[^<]*</tes:Password>",
                "<tes:Password>***</tes:Password>");
        log.info("[CFDI-XML] Enviando a {}:\n{}", endpoint, xmlLog);

        try {
            URL url = new URL(endpoint);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setConnectTimeout(15_000);
            conn.setReadTimeout(30_000);
            conn.setRequestProperty("Content-Type",
                    "text/xml; charset=utf-8");
            conn.setRequestProperty("SOAPAction",
                    "\"" + soapAction + "\"");

            try (OutputStream os = conn.getOutputStream()) {
                os.write(xmlFinal.getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();
            InputStream is = code >= 400
                    ? conn.getErrorStream() : conn.getInputStream();

            String response = new String(is.readAllBytes(), StandardCharsets.UTF_8);
            log.info("[CFDI] Respuesta HTTP {} — RESPUESTA COMPLETA DE FEL:\n{}", code, response);

            if (code >= 400) {
                throw new RuntimeException(
                        "FEL respondió HTTP " + code + ": " + response);
            }
            return response;

        } catch (IOException e) {
            log.error("[CFDI] Error de conexión con FEL", e);
            throw new RuntimeException(
                    "No se pudo conectar con el servicio de facturación FEL: "
                            + e.getMessage());
        }
    }

    private String inyectarCredenciales(String xmlSoap, Credenciales creds) {
        String bloqueCredenciales =
                "<tem:credenciales>"
                        + "<tes:Cuenta>" + esc(creds.cuenta()) + "</tes:Cuenta>"
                        + "<tes:Password>" + esc(creds.password()) + "</tes:Password>"
                        + "<tes:Usuario>" + esc(creds.usuario()) + "</tes:Usuario>"
                        + "</tem:credenciales>";

        return xmlSoap.replace(
                "<tem:GenerarCFDI40>",
                "<tem:GenerarCFDI40>" + bloqueCredenciales
        );
    }

    private CfdiTimbrado procesarRespuestaTimbrado(
            String respuestaSoap,
            Sale sale, Prefactura prefactura,
            Empresa empresa) {

        try {
            DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
            dbf.setNamespaceAware(true);
            DocumentBuilder db = dbf.newDocumentBuilder();
            Document doc = db.parse(
                    new ByteArrayInputStream(
                            respuestaSoap.getBytes(StandardCharsets.UTF_8)));

            boolean exitosa = "true".equalsIgnoreCase(
                    texto(doc, "OperacionExitosa"));

            if (!exitosa) {
                String err = texto(doc, "ErrorGeneral");
                String det = texto(doc, "ErrorDetallado");
                log.error("[CFDI] Error de FEL — {} / {}", err, det);
                throw new RuntimeException(mensajeAmigableFel(err, det));
            }

            String uuid = primerNoVacio(
                    texto(doc, "CodigoConfirmacion"),
                    texto(doc, "UUID"),
                    texto(doc, "FolioFiscal"),
                    texto(doc, "Uuid"),
                    texto(doc, "uuid")
            );
            String xml   = primerNoVacio(texto(doc, "XML"), texto(doc, "XmlTimbrado"));
            String pdf   = primerNoVacio(texto(doc, "PDF"), texto(doc, "PdfBase64"));
            String cbb   = texto(doc, "CBB");
            String folio = primerNoVacio(texto(doc, "FolioGenerado"), texto(doc, "Folio"));

            if ((uuid == null || uuid.isBlank()) && xml != null && !xml.isBlank()) {
                uuid = extraerUuidDelXml(xml);
                log.info("[CFDI] UUID extraído del XML timbrado: {}", uuid);
            }

            if ((folio == null || folio.isBlank()) && xml != null && !xml.isBlank()) {
                folio = extraerFolioDelXml(xml);
            }

            log.info("[CFDI] Campos respuesta — UUID={}, Folio={}, tienePDF={}, tieneXML={}",
                    uuid, folio, pdf != null && !pdf.isBlank(), xml != null && !xml.isBlank());

            if (uuid == null || uuid.isBlank())
                throw new RuntimeException(
                        "FEL respondió éxito pero no devolvió UUID. " +
                                "Revisa el log '[CFDI] Respuesta HTTP' para ver el XML completo de FEL.");

            descontarCreditoFel();

            if (empresa.getFolioActual() != null)
                empresa.setFolioActual(empresa.getFolioActual() + 1);

            CfdiTimbrado cfdi = new CfdiTimbrado();
            cfdi.setUuid(uuid);
            cfdi.setFolio(folio);
            cfdi.setSerie(empresa.getSerie());
            cfdi.setXmlTimbrado(xml);
            cfdi.setPdfBase64(pdf);
            cfdi.setCbbUrl(cbb);
            cfdi.setStatus("VIGENTE");
            cfdi.setFechaTimbrado(LocalDateTime.now());

            if (sale != null) {
                cfdi.setSale(sale);
                cfdi.setRfcReceptor(sale.getCustomer() != null
                        ? sale.getCustomer().getRfc() : null);
                cfdi.setNombreReceptor(sale.getCustomer() != null
                        ? sale.getCustomer().getFullName() : null);
                cfdi.setTotal(extraerTotalDelXml(cfdi.getXmlTimbrado())
                        .orElse(sale.getTotalAmount()));
            }
            if (prefactura != null) {
                cfdi.setPrefactura(prefactura);
                cfdi.setTotal(extraerTotalDelXml(cfdi.getXmlTimbrado())
                        .orElse(prefactura.getTotal()));
            }

            log.info("[CFDI] Timbrado exitoso — UUID {}", uuid);
            return cfdiTimbradoRepository.save(cfdi);

        } catch (Exception e) {
            if (e instanceof RuntimeException) throw (RuntimeException) e;
            throw new RuntimeException(
                    "Error al procesar respuesta de FEL: " + e.getMessage(), e);
        }
    }

    private Empresa obtenerEmpresa() {
        return empresaRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No hay datos de empresa configurados. " +
                                "Ve a Configuración → Empresa y completa tus datos fiscales."));
    }

    private Credenciales obtenerCredenciales(Empresa empresa) {
        String usuario  = nvl(empresa.getFelUsuario(),  felUsuarioEnv);
        String cuenta   = nvl(empresa.getFelCuenta(),   felCuentaEnv);
        String password = nvl(empresa.getFelPassword(), felPasswordEnv);

        if (usuario.isBlank() || cuenta.isBlank() || password.isBlank()) {
            throw new RuntimeException(
                    "Credenciales FEL no configuradas. " +
                            "Ve a Configuración → Empresa → Credenciales FEL y " +
                            "completa Usuario, Cuenta y Contraseña que te dio Blikon.");
        }
        return new Credenciales(usuario, cuenta, password);
    }

    private record Credenciales(String usuario, String cuenta, String password) {}

    private String nvl(String a, String b) {
        return (a != null && !a.isBlank()) ? a : (b != null ? b : "");
    }

    private String esc(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }

    private String primerNoVacio(String... valores) {
        for (String v : valores) {
            if (v != null && !v.isBlank()) return v;
        }
        return null;
    }

    private java.util.Optional<BigDecimal> extraerTotalDelXml(String xmlTimbrado) {
        if (xmlTimbrado == null) return java.util.Optional.empty();
        try {
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("\\bTotal=\"([0-9]+(?:\\.[0-9]+)?)\"")
                    .matcher(xmlTimbrado);
            if (m.find()) return java.util.Optional.of(new BigDecimal(m.group(1)));
        } catch (Exception ignored) { }
        return java.util.Optional.empty();
    }

    private String extraerUuidDelXml(String xmlTimbrado) {
        try {
            java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                    "UUID=\"([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})\"");
            java.util.regex.Matcher m = p.matcher(xmlTimbrado);
            if (m.find()) return m.group(1);
        } catch (Exception e) {
            log.warn("[CFDI] No se pudo extraer UUID del XML: {}", e.getMessage());
        }
        return null;
    }

    
    private String extraerFolioDelXml(String xmlTimbrado) {
        try {
            java.util.regex.Pattern p = java.util.regex.Pattern.compile("Folio=\"(\\d+)\"");
            java.util.regex.Matcher m = p.matcher(xmlTimbrado);
            if (m.find()) return m.group(1);
        } catch (Exception e) {
            log.warn("[CFDI] No se pudo extraer Folio del XML: {}", e.getMessage());
        }
        return null;
    }

    private String texto(Document doc, String tagName) {
        NodeList nodes = doc.getElementsByTagNameNS("*", tagName);
        if (nodes.getLength() == 0) {
            nodes = doc.getElementsByTagName(tagName);
        }
        if (nodes.getLength() > 0) {
            Node n = nodes.item(0);
            return n.getTextContent();
        }
        return null;
    }

    private String mapFormaPago(String metodo) {
        if (metodo == null) return "01";
        return switch (metodo.toUpperCase()) {
            case "EFECTIVO"      -> "01";
            case "TARJETA"       -> "04";
            case "TRANSFERENCIA" -> "03";
            case "DEUDA"         -> "99";
            default              -> "01";
        };
    }

    private String mapMetodoPago(String paymentMethod) {
        if (paymentMethod != null
                && paymentMethod.toUpperCase().equals("DEUDA")) {
            return "PPD";
        }
        return "PUE";
    }

    private BigDecimal[] calcularTotales(List<ItemCalc> items) {
        BigDecimal subtotal = BigDecimal.ZERO;
        BigDecimal iva      = BigDecimal.ZERO;
        for (ItemCalc item : items) {
            BigDecimal base = item.qty()
                    .multiply(item.precioConIva()
                            .divide(DIVISOR_IVA, 6, RoundingMode.HALF_UP))
                    .setScale(2, RoundingMode.HALF_UP);
            BigDecimal ivaItem = base.multiply(TASA_IVA)
                    .setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(base);
            iva      = iva.add(ivaItem);
        }
        return new BigDecimal[]{subtotal, iva, subtotal.add(iva)};
    }

    private record ItemCalc(BigDecimal qty, BigDecimal precioConIva) {}

    public String previewXmlSoap(Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Venta no encontrada: " + saleId));
        Empresa empresa = obtenerEmpresa();
        return construirSoapGenerarCFDI40(sale, empresa);
    }

    public List<CfdiTimbrado> listarVigentes() {
        return cfdiTimbradoRepository
                .findByStatusOrderByFechaTimbradoDesc("VIGENTE");
    }

    public Optional<CfdiTimbrado> buscarPorSale(Long saleId) {
        return cfdiTimbradoRepository
                .findFirstBySaleIdOrderByFechaTimbradoDesc(saleId);
    }

    public List<Map<String, Object>> listarTodos() {
        List<CfdiTimbrado> todos = cfdiTimbradoRepository
                .findAllByOrderByFechaTimbradoDesc();
        return todos.stream().map(c -> {
            Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("id",             c.getId());
            m.put("uuid",           c.getUuid());
            m.put("serie",          c.getSerie());
            m.put("folio",          c.getFolio());
            m.put("fechaTimbrado",  c.getFechaTimbrado());
            m.put("rfcReceptor",    c.getRfcReceptor());
            m.put("nombreReceptor", c.getNombreReceptor());
            m.put("total",          c.getTotal());
            m.put("status",         c.getStatus());
            m.put("canceladoAt",    c.getCanceladoAt());
            m.put("cancelReason",   c.getCancelReason());
            m.put("tienePdf",       c.getPdfBase64() != null && !c.getPdfBase64().isBlank());
            m.put("tieneXml",       c.getXmlTimbrado() != null && !c.getXmlTimbrado().isBlank());
            m.put("pdfBase64",      c.getPdfBase64());
            boolean esGlobal = c.getSale() == null && c.getPrefactura() == null;
            m.put("esGlobal", esGlobal);
            if (esGlobal) {
                m.put("ticketsIncluidos",
                        saleRepository.countByCfdiGlobalId(c.getId()));
            }
            if (c.getSale() != null) {
                Sale s = c.getSale();
                m.put("saleId",          s.getId());
                m.put("invoiceNumber",   s.getInvoiceNumber());
                m.put("paymentMethod",   s.getPaymentMethod());
                m.put("saleCreatedAt",   s.getCreatedAt());
                if (s.getItems() != null) {
                    m.put("items", s.getItems().stream().map(i -> {
                        Map<String, Object> item = new java.util.LinkedHashMap<>();
                        item.put("productName",
                                i.getCustomName() != null && !i.getCustomName().isBlank()
                                        ? i.getCustomName()
                                        : (i.getProduct() != null ? i.getProduct().getName() : ""));
                        item.put("sku",         i.getProduct() != null ? i.getProduct().getSku() : "");
                        item.put("quantity",    i.getQuantity());
                        item.put("unitPrice",   i.getUnitPrice());
                        item.put("total",       i.getQuantity().multiply(i.getUnitPrice()));
                        return item;
                    }).toList());
                }
            }
            return m;
        }).toList();
    }

    public String obtenerXml(String uuid) {
        CfdiTimbrado cfdi = cfdiTimbradoRepository.findByUuid(uuid)
                .orElseThrow(() -> new RuntimeException(
                        "CFDI no encontrado con UUID " + uuid));
        if (cfdi.getXmlTimbrado() == null || cfdi.getXmlTimbrado().isBlank())
            throw new RuntimeException(
                    "Este CFDI no tiene XML almacenado. Descárgalo del portal de FEL.");
        return cfdi.getXmlTimbrado();
    }

    public Map<String, Object> detalleFacturaGlobal(Long cfdiId) {
        CfdiTimbrado cfdi = cfdiTimbradoRepository.findById(cfdiId)
                .orElseThrow(() -> new RuntimeException(
                        "CFDI no encontrado con id " + cfdiId));

        if (cfdi.getSale() != null || cfdi.getPrefactura() != null)
            throw new RuntimeException(
                    "Este CFDI no es una factura global (es nominativo).");

        List<Sale> ventas = saleRepository
                .findByCfdiGlobalIdOrderByCreatedAtAsc(cfdiId);

        List<Map<String, Object>> tickets = ventas.stream().map(v -> {
            Map<String, Object> t = new java.util.LinkedHashMap<>();
            t.put("saleId",        v.getId());
            t.put("folio",         v.getInvoiceNumber());
            t.put("fecha",         v.getCreatedAt());
            t.put("metodoPago",    v.getPaymentMethod());
            t.put("vendedor",      v.getSellerName());
            t.put("total",         v.getTotalAmount());
            t.put("items", v.getItems() == null ? List.of()
                    : v.getItems().stream().map(i -> {
                Map<String, Object> item = new java.util.LinkedHashMap<>();
                item.put("productName",
                        i.getCustomName() != null && !i.getCustomName().isBlank()
                        ? i.getCustomName()
                        : (i.getProduct() != null ? i.getProduct().getName() : ""));
                item.put("sku",         i.getProduct() != null ? i.getProduct().getSku() : "");
                item.put("quantity",    i.getQuantity());
                item.put("unitPrice",   i.getUnitPrice());
                item.put("total",       i.getQuantity().multiply(i.getUnitPrice()));
                return item;
            }).toList());
            return t;
        }).toList();

        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("cfdiId",        cfdi.getId());
        out.put("uuid",          cfdi.getUuid());
        out.put("serie",         cfdi.getSerie());
        out.put("folio",         cfdi.getFolio());
        out.put("fechaTimbrado", cfdi.getFechaTimbrado());
        out.put("status",        cfdi.getStatus());
        out.put("total",         cfdi.getTotal());
        out.put("totalTickets",  tickets.size());
        out.put("tickets",       tickets);
        if (tickets.isEmpty()) {
            out.put("nota", "Sin tickets ligados. Las facturas globales timbradas "
                    + "antes de la actualización de trazabilidad no tienen "
                    + "tickets asociados en el sistema.");
        }
        return out;
    }
}