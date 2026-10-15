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

/**
 * CfdiService — Facturación electrónica CFDI 4.0 con FEL Premium / Blikon
 *
 * Flujo:
 *   1. construirComprobante40()  → arma el XML SOAP con la estructura Comprobante40R
 *   2. invocarGenerarCFDI40()    → llama al webservice SOAP de Blikon
 *   3. parsearRespuesta()        → extrae UUID, XML, PDF de RespuestaOperacionCR
 *   4. guardarCfdi()             → persiste en cfdi_timbrados
 *
 * Las credenciales se leen primero de la tabla `empresa` (configurable desde UI).
 * Si no están configuradas ahí, se usan las variables de entorno como fallback.
 */
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

    // URL del webservice — producción vs pruebas
    private static final String URL_PRUEBAS    =
            "http://app.fel.mx/CR33Test/ConexionRemota.svc";
    private static final String URL_PRODUCCION =
            "https://www.fel.mx/CR33/ConexionRemota.svc";
    private static final String SOAP_ACTION_GENERAR =
            "http://tempuri.org/IConexionRemota/GenerarCFDI40";
    private static final String SOAP_ACTION_CANCELAR =
            "http://tempuri.org/IConexionRemota/CancelarCFDIsV4";

    // ── Variables de entorno como fallback si no están en BD ─────────────────
    @Value("${fel.usuario:}")  private String felUsuarioEnv;
    @Value("${fel.cuenta:}")   private String felCuentaEnv;
    @Value("${fel.password:}") private String felPasswordEnv;
    // Ya NO es la fuente de verdad — queda solo como respaldo si la BD aún
    // no tiene el campo fel_ambiente lleno (ej. justo después de migrar).
    @Value("${fel.ambiente:pruebas}") private String felAmbienteEnvFallback;

    // ── PERIODICIDAD DE LA FACTURA GLOBAL (catálogo SAT c_Periodicidad) ──────
    //   01 Diario · 02 Semanal · 03 Quincenal · 04 Mensual · 05 Bimestral
    // Ya NO se lee de application.properties: el dueño la cambia desde el
    // front (Facturación → Configurar periodicidad) y aquí se consulta en
    // tiempo real vía ConfiguracionFacturacionService — ver el método
    // periodicidadSatActual() más abajo.

    // Art. 113-J LISR: las personas morales retienen 1.25% de ISR a las
    // personas físicas RESICO. Los PACs VALIDAN que el CFDI de ingreso
    // hacia una PM incluya esta retención; sin ella, rechazan el timbrado.
    private static final BigDecimal TASA_RET_ISR_RESICO = new BigDecimal("0.0125");

    private static final String CLAVE_PROD_DEFAULT  = "01010101";
    private static final String CLAVE_UNIDAD_DEFAULT = "H87";
    private static final String OBJETO_IMP_DEFAULT   = "02";

    // ─────────────────────────────────────────────────────────────────────────
    // TIMBRAR: construye el XML SOAP y llama a FEL/Blikon
    // ─────────────────────────────────────────────────────────────────────────
    @Transactional
    public CfdiTimbrado timbrarVenta(Long saleId) {
        // Solo bloquea si existe un CFDI NO cancelado. Si el anterior fue
        // cancelado ante el SAT, reemitir es el procedimiento correcto.
        if (cfdiTimbradoRepository.existsBySaleIdAndStatusNot(saleId, "CANCELADO")) {
            throw new RuntimeException(
                    "Esta venta ya tiene un CFDI timbrado vigente. UUID: " +
                            cfdiTimbradoRepository
                                    .findFirstBySaleIdAndStatusNotOrderByFechaTimbradoDesc(
                                            saleId, "CANCELADO")
                                    .map(CfdiTimbrado::getUuid).orElse("?"));
        }
        // Si la venta ya fue incluida en una factura GLOBAL vigente, tampoco
        // se puede facturar nominativamente: el ingreso quedaría duplicado.
        // (Apéndice 2, caso I: primero se cancela/ajusta la global.)
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

        // ── La venta debe seguir VIVA ────────────────────────────────────────
        // Faltaba revisar el estado: se podía facturar una venta CANCELADA.
        // Ante el SAT quedaría un CFDI de mercancía que nunca salió, cobrando
        // un IVA que nunca se recibió. Cancelar ese CFDI después tiene reglas
        // y plazos propios del SAT: es mucho más caro que no emitirlo.
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

    /**
     * Factura Global QUINCENAL — agrupa todas las ventas de Público General
     * de UNA QUINCENA en un solo CFDI y las marca como incluidas para no
     * duplicarlas. Es la única forma en que se facturan las ventas sin RFC.
     *
     * El nodo InformacionGlobal viaja con Periodicidad 03 (Quincenal) y el
     * Mes/Año de las OPERACIONES. Las ventas de la lista deben ser del
     * mismo mes (el SAT no distingue Q1/Q2 en el XML, solo la periodicidad).
     *
     * Plazo SAT: la global se expide a más tardar dentro de las 72 horas
     * siguientes al cierre del periodo que ampara (día 15 o fin de mes).
     */
    // synchronized: si el usuario da doble clic en "Timbrar", dos hilos
    // podrían leer incluidoFacturaGlobal=false al mismo tiempo y timbrar
    // DOS globales duplicadas ante el SAT. Serializar la operación lo evita.
    @Transactional
    public synchronized CfdiTimbrado timbrarFacturaGlobal(List<Long> saleIds) {
        if (saleIds == null || saleIds.isEmpty())
            throw new RuntimeException(
                    "No hay ventas del periodo para facturar.");

        List<Sale> ventas = saleRepository.findAllById(saleIds);
        if (ventas.isEmpty())
            throw new RuntimeException("No se encontraron las ventas indicadas.");

        // Verificar que ninguna ya esté incluida en factura global
        long yaIncluidas = ventas.stream()
                .filter(v -> Boolean.TRUE.equals(v.getIncluidoFacturaGlobal()))
                .count();
        if (yaIncluidas > 0)
            throw new RuntimeException(
                    yaIncluidas + " venta(s) ya fueron incluidas en una factura global anterior.");

        // ── Filtros de seguridad ─────────────────────────────────────────────
        List<Sale> canceladas = ventas.stream()
                .filter(v -> "CANCELLED".equals(v.getStatus()))
                .toList();
        if (!canceladas.isEmpty())
            throw new RuntimeException(
                    "Hay " + canceladas.size() + " venta(s) CANCELADAS en la lista ("
                            + canceladas.stream().map(Sale::getInvoiceNumber)
                            .reduce((a, b) -> a + ", " + b).orElse("")
                            + "). Quítalas antes de timbrar la global.");

        // Solo bloquean los CFDIs nominativos NO cancelados; uno cancelado
        // significa que la venta quedó libre y SÍ debe entrar a la global.
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

        // Montos válidos: sin totalAmount la división base/IVA truena con NPE
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

        // ── Todas las ventas deben ser del MISMO mes/año ─────────────────────
        // El nodo InformacionGlobal lleva UN solo Mes/Año (el de las
        // operaciones, no el de hoy). Con ventas liberadas de globales
        // canceladas es posible mezclar meses: hay que timbrarlas por separado.
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

        // Total real de la global = suma de los totales (con IVA) de cada venta.
        BigDecimal totalGlobal = ventas.stream()
                .map(Sale::getTotalAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        // Construir el XML SOAP — UN CONCEPTO POR VENTA (regla SAT de la global)
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

        // Completar datos del CFDI global (sale/prefactura vienen null aquí,
        // así que total y receptor no se llenaron en procesarRespuestaTimbrado;
        // sin esto el controller truena con NPE al armar el Map de respuesta).
        cfdi.setTotal(totalGlobal);
        cfdi.setRfcReceptor("XAXX010101000");
        cfdi.setNombreReceptor("PUBLICO EN GENERAL — Factura Global "
                + periodo + " (" + ventas.size() + " venta"
                + (ventas.size() == 1 ? "" : "s") + ")");
        cfdi = cfdiTimbradoRepository.save(cfdi);

        // Marcar todas las ventas como incluidas y LIGARLAS a este CFDI global
        // (trazabilidad: cada ticket sabe en qué factura global quedó)
        final CfdiTimbrado cfdiGlobal = cfdi;
        ventas.forEach(v -> {
            v.setIncluidoFacturaGlobal(true);
            v.setCfdiGlobal(cfdiGlobal);
        });
        saleRepository.saveAll(ventas);

        return cfdi;
    }

    /**
     * ═══════════════════════════════════════════════════════════════════════
     *  FACTURA GLOBAL QUINCENAL — REGLA SAT (guía de llenado CFDI 4.0 global):
     *  Cada CONCEPTO representa UNA VENTA/TICKET COMPLETO, no un producto.
     *
     *    Cantidad         = 1 (SIEMPRE — validación CFDI40999 de FEL)
     *    ClaveProdServ    = 01010101
     *    ClaveUnidad      = ACT
     *    Descripcion      = "Venta"
     *    NoIdentificacion = folio del ticket (invoice_number)
     *    ValorUnitario    = subtotal de la venta (sin IVA)
     *    Importe          = igual al ValorUnitario
     *    Traslado         = Base: subtotal · Importe: IVA de la venta
     *
     *  ANTI-DESCUADRE: base = total/1.16 e IVA = total − base, POR VENTA.
     *  Así base + IVA = total EXACTO de cada ticket, y la suma cuadra al
     *  centavo con lo que ve el usuario en pantalla (adiós 408.91 vs 408.90).
     * ═══════════════════════════════════════════════════════════════════════
     */
    private String construirSoapFacturaGlobal(
            List<Sale> ventas, Empresa empresa, java.time.YearMonth periodo) {

        StringBuilder conceptos = new StringBuilder();
        BigDecimal subtotalGlobal = BigDecimal.ZERO;
        BigDecimal ivaGlobal      = BigDecimal.ZERO;
        BigDecimal totalGlobal    = BigDecimal.ZERO;

        for (Sale venta : ventas) {
            BigDecimal totalVenta = venta.getTotalAmount()
                    .setScale(2, RoundingMode.HALF_UP);

            // base = total sin IVA; IVA por diferencia → cuadre exacto
            BigDecimal baseVenta = totalVenta.divide(
                    DIVISOR_IVA, 2, RoundingMode.HALF_UP);
            BigDecimal ivaVenta = totalVenta.subtract(baseVenta);

            // Folio del ticket → NoIdentificacion (trazabilidad SAT)
            String folioTicket = venta.getInvoiceNumber() != null
                    && !venta.getInvoiceNumber().isBlank()
                    ? venta.getInvoiceNumber()
                    : String.valueOf(venta.getId());

            conceptos.append(construirConceptoSimple(
                    "Venta",            // Descripcion fija según guía SAT
                    folioTicket,        // NoIdentificacion = folio del ticket
                    CLAVE_PROD_DEFAULT, // 01010101
                    "ACT",              // ClaveUnidad fija para global
                    BigDecimal.ONE,     // Cantidad SIEMPRE 1 (un ticket)
                    baseVenta,          // ValorUnitario = subtotal de la venta
                    baseVenta,          // Importe = 1 × ValorUnitario
                    ivaVenta            // IVA de la venta completa
            ));

            subtotalGlobal = subtotalGlobal.add(baseVenta);
            ivaGlobal      = ivaGlobal.add(ivaVenta);
            totalGlobal    = totalGlobal.add(totalVenta);
        }

        // Receptor siempre XAXX para factura global
        // Fecha del CFDI = momento del timbrado (regla SAT 72h)
        String fecha = LocalDateTime.now(ZoneId.of("America/Mazatlan")).format(FMT);
        String folio = String.valueOf(
                empresa.getFolioActual() != null ? empresa.getFolioActual() : 1);

        // Usar cliente genérico de la primera venta (siempre es Público General)
        Customer clientePublico = ventas.get(0).getCustomer();

        return soapEnvelope(
                construirComprobante40(
                        empresa, clientePublico, conceptos.toString(),
                        subtotalGlobal, ivaGlobal, totalGlobal,
                        fecha, folio, empresa.getSerie(),
                        "01",   // Efectivo (FormaPago genérico para factura global)
                        "PUE",
                        periodo // mes/año de las VENTAS, no de hoy
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

        // Verificar que el PIN esté configurado
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

        // La respuesta exitosa de FEL tiene:
        // <a:OperacionExitosa>true</a:OperacionExitosa>
        // <a:UUIDS><a:UUIDEstatusCancelacionCR>
        //   <a:EstatusCancelacion>201</a:EstatusCancelacion>  ← Cancelado
        //   <a:EstatusCancelacion>202</a:EstatusCancelacion>  ← En proceso
        //   <a:UUID>...</a:UUID>
        // </a:UUIDEstatusCancelacionCR></a:UUIDS>
        //
        // Cuando falla: <a:OperacionExitosa>false</a:OperacionExitosa>
        //               <a:ErrorGeneral>mensaje de error</a:ErrorGeneral>

        boolean operacionExitosa = respuesta.contains("<a:OperacionExitosa>true</a:OperacionExitosa>");

        // ── "YA SE ENCUENTRA CANCELADO" NO ES UN ERROR ──────────────────────
        // Se detecta AQUÍ ARRIBA, antes de cualquier throw, y por una razón
        // concreta: cuando FEL contesta eso, manda OperacionExitosa=FALSE. Si
        // la comprobación va más abajo, el throw de aquí se dispara primero y
        // nunca se llega a ella — el CFDI se quedaba marcado VIGENTE para
        // siempre aunque en el SAT estuviera cancelado.
        //
        // Que el comprobante ya esté cancelado allá es justo lo que se quería
        // lograr. Se toma como confirmación y se sincroniza el estatus local.
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

        // OJO: OperacionExitosa=true solo significa que FEL PROCESÓ la petición,
        // NO que el SAT haya cancelado. El veredicto real viene en el código:
        //   <a:RespuestaServicio> (por UUID) y/o <EstatusUUID> dentro del acuse.
        //   201 = solicitud de cancelación ACEPTADA por el SAT
        //   202 = CFDI ya estaba cancelado previamente
        //   Cualquier otro código (203, 205, 209, ...) = NO se canceló.
        String estatusCod = extraerEstatusCancelacion(respuesta);
        String mensajeFel = extraerMensajeErrorUuid(respuesta);
        log.info("[CFDI] Estatus cancelación — UUID {} código: {} mensaje: {}",
                uuid, estatusCod, mensajeFel);

        boolean esperaAceptacion = respuesta.contains("Cancelable con aceptación")
                || respuesta.contains("EnProceso");

        // El mensaje por UUID también puede traer el "ya cancelado"
        if (mensajeFel != null && mensajeFel.toLowerCase().contains("ya se encuentra cancelado")) {
            yaEstabaCancelado = true;
        }

        if ("201".equals(estatusCod) || "202".equals(estatusCod) || yaEstabaCancelado) {
            // 201 aceptada / 202 ya estaba cancelada → marcar cancelado
            cfdi.setStatus("CANCELADO");
            cfdi.setCanceladoAt(LocalDateTime.now());
            cfdi.setCancelReason(motivo
                    + ("202".equals(estatusCod) || yaEstabaCancelado
                    ? " | SAT: previamente cancelado" : ""));
            cfdiTimbradoRepository.save(cfdi);

            // Si era una FACTURA GLOBAL, liberar sus ventas para que puedan
            // incluirse en una nueva global (Apéndice 2, caso II de la guía SAT)
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
            // 209 = "Folio Sustitución no requerido". Se manda un folio de
            // sustitución cuando el motivo no lo pide. NO se toca el estatus:
            // el CFDI sigue vigente de verdad.
            throw new RuntimeException(
                    "El SAT rechazó la cancelación (209): se envió folio de "
                            + "sustitución sin necesitarlo. Si acabas de actualizar el "
                            + "sistema, vuelve a intentar; si sigue igual, cancélalo "
                            + "desde el portal de FEL.");

        } else {
            // Código distinto de 201/202: el SAT NO canceló. NO tocar el estatus.
            throw new RuntimeException(
                    "El SAT no aceptó la cancelación (código " + estatusCod
                            + (mensajeFel != null && !mensajeFel.isBlank()
                            ? " — " + mensajeFel : "")
                            + "). El CFDI permanece VIGENTE. "
                            + "Verifica en fel.blikon.com o intenta cancelarlo desde el portal.");
        }
    }

    private String extraerEstatusCancelacion(String respuesta) {
        // 1) Código por UUID en la respuesta del WS de FEL:
        //    <a:RespuestaServicio>201</a:RespuestaServicio>
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                "<a:RespuestaServicio>\\s*(\\d{3})\\s*</a:RespuestaServicio>");
        java.util.regex.Matcher m = p.matcher(respuesta);
        if (m.find()) return m.group(1);

        // 2) Código en el acuse del SAT (viene HTML-escapado dentro de <a:Acuse>):
        //    &lt;EstatusUUID&gt;201&lt;/EstatusUUID&gt;
        p = java.util.regex.Pattern.compile(
                "EstatusUUID(?:>|&gt;)\\s*(\\d{3})\\s*(?:<|&lt;)");
        m = p.matcher(respuesta);
        if (m.find()) return m.group(1);

        // 3) Formato viejo por si FEL lo usa en alguna variante
        p = java.util.regex.Pattern.compile(
                "EstatusCancelacion[^>]*>\\s*(\\d{3})\\s*<");
        m = p.matcher(respuesta);
        if (m.find()) return m.group(1);

        return "DESCONOCIDO"; // sin código claro: NO asumir éxito
    }

    /** Extrae el <a:MensajeError> del detalle por UUID (puede venir vacío). */
    private String extraerMensajeErrorUuid(String respuesta) {
        java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                "<a:MensajeError>([^<]*)</a:MensajeError>");
        java.util.regex.Matcher m = p.matcher(respuesta);
        if (m.find()) return m.group(1).trim();
        return "";
    }

    /**
     * Traduce los errores de FEL a mensajes entendibles en el mostrador.
     * El caso más importante: SIN TIMBRES / SIN CRÉDITOS. FEL lo reporta con
     * distintas palabras según el caso (créditos, timbres, saldo, folios,
     * vigencia del paquete), así que se detecta por palabras clave.
     */
    /** Descuenta 1 crédito del contador local tras un timbrado exitoso. */
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

    /** Créditos locales disponibles (null = contador no configurado). */
    public Integer consultarCreditosLocales() {
        Empresa emp = empresaRepository.findAll().stream().findFirst().orElse(null);
        return emp != null ? emp.getFelCreditosDisponibles() : null;
    }

    /** Ajusta el contador (al recargar timbres o para corregir desfase). */
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
                        || todo.contains("agotad")            // agotado / agotados
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
        // Intentar extraer mensaje de error de FEL
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

    // ─────────────────────────────────────────────────────────────────────────
    // CONSTRUCCIÓN DEL XML SOAP — Comprobante40R + Credenciales
    // ─────────────────────────────────────────────────────────────────────────
    private String construirSoapGenerarCFDI40(Sale sale, Empresa empresa) {
        Customer cliente = sale.getCustomer();
        List<SaleItem> items = sale.getItems();

        // SAT: si el receptor es XAXX010101000 el CFDI es GLOBAL aunque sea
        // una sola venta → UN concepto con Cantidad=1 (regla CFDI40999),
        // NO un concepto por producto.
        boolean esPublicoGeneral = cliente.getRfc() != null
                && "XAXX010101000".equals(cliente.getRfc());

        BigDecimal subtotal;
        BigDecimal ivaTotal;
        BigDecimal total;
        StringBuilder conceptos = new StringBuilder();

        if (esPublicoGeneral) {
            // Un solo concepto = la venta completa (mismo criterio que la
            // factura global diaria; base por diferencia para cuadre exacto)
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
            // Factura nominativa (cliente con RFC): detalle completo por
            // producto, con claves reales del catálogo.
            // Si el receptor es PERSONA MORAL (RFC de 12 caracteres), se
            // aplica automáticamente la retención de ISR del 1.25%
            // (Art. 113-J LISR, obligatoria para emisores RESICO; los PACs
            // rechazan el timbrado si falta). Para personas físicas (RFC de
            // 13) NO se retiene nada: la factura sale igual que siempre.
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

                // Producto LIBRE: usar la descripción capturada en caja
                // (el producto genérico id -1 solo aporta las claves SAT
                // genéricas 01010101 / H87)
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
            // Total del comprobante = SubTotal + IVA trasladado − ISR retenido
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
                        // Fecha del CFDI = momento del timbrado (regla SAT 72h).
                        // La fecha en que se llevaron los productos queda en la nota.
                        LocalDateTime.now(ZoneId.of("America/Mazatlan")).format(FMT),
                        String.valueOf(empresa.getFolioActual() != null
                                ? empresa.getFolioActual() : 1),
                        empresa.getSerie(),
                        mapFormaPago(sale.getPaymentMethod()),
                        mapMetodoPago(sale.getPaymentMethod()),
                        // Si es público general, InformacionGlobal debe llevar
                        // el mes de la VENTA (importa al reemitir cross-mes)
                        sale.getCreatedAt() != null
                                ? java.time.YearMonth.from(sale.getCreatedAt())
                                : null
                )
        );
    }

    private String construirSoapGenerarCFDI40Prefactura(
            Prefactura pref, Empresa empresa) {

        // Pre-factura usa los mismos items pero viene de PrefacturaItem.
        // Los totales se calculan por SUMA de conceptos (cuadre exacto).
        BigDecimal subtotal;
        Customer cliente = pref.getCustomer();
        // Persona moral → retención ISR 1.25% automática (Art. 113-J LISR)
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
            // Para pre-factura no tenemos el Product directamente,
            // usamos los defaults SAT
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

        // Totales por suma de conceptos (cuadre exacto con lo timbrado)
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

    // Sobrecarga sin periodo: usa el mes actual (nominativas y prefacturas,
    // donde InformacionGlobal ni siquiera se emite).
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

        // IMPORTANTE: FEL/Blikon exige orden estrictamente ALFABÉTICO en todos los campos.
        // ClaveCFDI reemplaza a TipoComprobante — es el campo que FEL usa para indicar
        // el tipo de comprobante ("FAC" = Factura de Ingreso, según su ejemplo oficial)
        //
        // SAT regla CFDI40130: cuando RFC receptor = XAXX010101000 (Público General),
        // el nodo InformacionGlobal es OBLIGATORIO.
        boolean esPublicoGeneral = "XAXX010101000".equals(rfcReceptor);
        String informacionGlobal = "";
        if (esPublicoGeneral) {
            // Mes/Año de las OPERACIONES (regla SAT), no de la fecha de timbrado.
            // Importa cuando se reemite una global cancelada de un mes anterior.
            java.time.YearMonth ym = periodoGlobal != null
                    ? periodoGlobal
                    : java.time.YearMonth.now();
            // Periodicidad configurada por el dueño (DIARIA/SEMANAL/QUINCENAL/
            // MENSUAL) — el SAT solo distingue por este código, no tiene forma
            // de saber "primera o segunda quincena": eso es interno del sistema.
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

    // Concepto detallado — para facturas nominativas (cliente con RFC)
    // y prefacturas. La factura global NO pasa por aquí: usa
    // construirConceptoSimple directamente con Cantidad=1 por venta.
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

    /** RFC de 12 caracteres = persona moral; 13 = persona física. */
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
            BigDecimal isrRetenido /* null = sin retención */) {

        // Retención ISR 1.25% (solo receptor persona moral, Art. 113-J LISR).
        // Orden alfabético dentro de Impuestos: Retenciones < Traslados.
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

        // Estructura exacta del ejemplo oficial de FEL: Concepto40R con tes: en todo
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

        // MOTIVO FIJO "02" (emitido con errores, sin relación) por decisión
        // operativa: es el motivo genérico estándar y no requiere folio de
        // sustitución. El parámetro recibido se ignora a propósito.
        String motivoClave = "02";

        // FolioSustitucion: SOLO va con motivo 01 (sustitución), donde lleva el
        // UUID del CFDI que reemplaza. Con 02/03/04 el elemento NO debe ir en
        // absoluto — ni siquiera con i:nil="true".
        //
        // Ese era el bug: se mandaba <tes:FolioSustitucion i:nil="true"/> y,
        // aunque el valor va nulo, EL ELEMENTO ESTÁ PRESENTE. El SAT lo cuenta
        // como "me mandaste folio de sustitución" y rechaza con el código 209
        // ("Folio Sustitución no requerido"), que es exactamente el mensaje que
        // devolvía FEL.
        //
        // Como el motivo está fijo en "02", aquí sencillamente no se emite.
        // Si algún día se implementa la sustitución (motivo 01), este es el
        // lugar donde hay que volver a ponerlo CON el UUID que sustituye.
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
        // Formato exacto del ejemplo oficial de FEL/Blikon:
        // - parámetro = "cfdi" (no "comprobante")
        // - prefijos: soapenv, tem (tempuri), tes (datacontract)
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

    // ─────────────────────────────────────────────────────────────────────────
    // INVOCACIÓN HTTP del webservice SOAP
    // ─────────────────────────────────────────────────────────────────────────

    /** Ambiente FEL actual ("PRODUCCION" | "PRUEBAS"), leído en vivo de la BD. */
    public String obtenerAmbienteFel() {
        Empresa emp = empresaRepository.findAll().stream().findFirst().orElse(null);
        if (emp != null && emp.getFelAmbiente() != null && !emp.getFelAmbiente().isBlank()) {
            return emp.getFelAmbiente().toUpperCase();
        }
        return felAmbienteEnvFallback.toUpperCase();
    }

    /** Cambia el ambiente FEL en caliente — lo usa la Consola de Desarrollo. */
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

        // Inyectar credenciales en el envelope antes de enviar
        String xmlFinal = inyectarCredenciales(xmlBody, creds);

        // LOG DIAGNÓSTICO — muestra el XML sin la contraseña real
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

    /**
     * Inyecta las credenciales Blikon dentro del envelope SOAP.
     * Se hace aquí (no en la construcción del XML) para poder loggear
     * el XML sin exponer contraseñas.
     */
    private String inyectarCredenciales(String xmlSoap, Credenciales creds) {
        // Formato exacto del ejemplo oficial de FEL:
        // - prefijo tes: en cada campo
        // - orden: Cuenta, Password, Usuario (igual que el ejemplo)
        // - wrapper: tem:credenciales
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

    // ─────────────────────────────────────────────────────────────────────────
    // PARSEO DE LA RESPUESTA — RespuestaOperacionCR
    // ─────────────────────────────────────────────────────────────────────────
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

            // FEL puede devolver el UUID en distintos campos según la versión
            // Probamos todos los nombres posibles en orden de probabilidad
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

            // FEL devuelve el UUID dentro del XML timbrado (en el nodo tfd:TimbreFiscalDigital)
            // cuando CodigoConfirmacion viene como nil="true"
            if ((uuid == null || uuid.isBlank()) && xml != null && !xml.isBlank()) {
                uuid = extraerUuidDelXml(xml);
                log.info("[CFDI] UUID extraído del XML timbrado: {}", uuid);
            }

            // El folio también viene en el XML del SAT como atributo Folio del Comprobante
            if ((folio == null || folio.isBlank()) && xml != null && !xml.isBlank()) {
                folio = extraerFolioDelXml(xml);
            }

            // Log completo de la respuesta para diagnóstico
            log.info("[CFDI] Campos respuesta — UUID={}, Folio={}, tienePDF={}, tieneXML={}",
                    uuid, folio, pdf != null && !pdf.isBlank(), xml != null && !xml.isBlank());

            if (uuid == null || uuid.isBlank())
                throw new RuntimeException(
                        "FEL respondió éxito pero no devolvió UUID. " +
                                "Revisa el log '[CFDI] Respuesta HTTP' para ver el XML completo de FEL.");

            // Timbrado exitoso → descontar 1 del contador local de créditos
            descontarCreditoFel();

            // Incrementar folio en empresa
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
                // Con retención a PM, el Total del CFDI es menor al de la
                // venta: usar el Total real del XML timbrado si está disponible
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

    // ─────────────────────────────────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────────────────────────────────
    private Empresa obtenerEmpresa() {
        return empresaRepository.findAll().stream().findFirst()
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No hay datos de empresa configurados. " +
                                "Ve a Configuración → Empresa y completa tus datos fiscales."));
    }

    private Credenciales obtenerCredenciales(Empresa empresa) {
        // Prioridad: BD → Variables de entorno → Error
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

    /**
     * Extrae el UUID del nodo tfd:TimbreFiscalDigital dentro del XML timbrado.
     * FEL lo devuelve como: UUID="976A5587-5F26-4516-8D7D-5978336B95EA"
     */
    /** Extrae el atributo Total del XML timbrado (cfdi:Comprobante). */
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
            // Primero intentar como atributo XML
            java.util.regex.Pattern p = java.util.regex.Pattern.compile(
                    "UUID=\"([0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12})\"");
            java.util.regex.Matcher m = p.matcher(xmlTimbrado);
            if (m.find()) return m.group(1);
        } catch (Exception e) {
            log.warn("[CFDI] No se pudo extraer UUID del XML: {}", e.getMessage());
        }
        return null;
    }

    /**
     * Extrae el folio del atributo Folio del nodo cfdi:Comprobante.
     */
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
            // DEUDA = el cliente aún no pagó → "99" Por definir
            // FEL lo acepta, y el MetodoPago debe ser "PPD" (Pago en Parcialidades o Diferido)
            case "DEUDA"         -> "99";
            default              -> "01";
        };
    }

    private String mapMetodoPago(String paymentMethod) {
        // PUE = Pago en Una sola Exhibición (pagado al momento)
        // PPD = Pago en Parcialidades o Diferido (deuda, crédito)
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

    // ─────────────────────────────────────────────────────────────────────────
    // PREVIEW (sin timbrar — solo para revisar antes de enviar)
    // ─────────────────────────────────────────────────────────────────────────
    public String previewXmlSoap(Long saleId) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Venta no encontrada: " + saleId));
        Empresa empresa = obtenerEmpresa();
        // Devuelve el XML sin las credenciales para no exponerlas
        return construirSoapGenerarCFDI40(sale, empresa);
    }

    public List<CfdiTimbrado> listarVigentes() {
        return cfdiTimbradoRepository
                .findByStatusOrderByFechaTimbradoDesc("VIGENTE");
    }

    public Optional<CfdiTimbrado> buscarPorSale(Long saleId) {
        // El más reciente: con reemisiones una venta puede tener un CFDI
        // cancelado y uno vigente; findBySaleId tronaría con NonUniqueResult.
        return cfdiTimbradoRepository
                .findFirstBySaleIdOrderByFechaTimbradoDesc(saleId);
    }

    /**
     * Lista todos los CFDIs (vigentes y cancelados) con detalle completo
     * para el módulo de Facturación del frontend.
     */
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
            // ── ¿Es factura global? (no tiene venta ni prefactura ligada) ──
            boolean esGlobal = c.getSale() == null && c.getPrefactura() == null;
            m.put("esGlobal", esGlobal);
            if (esGlobal) {
                m.put("ticketsIncluidos",
                        saleRepository.countByCfdiGlobalId(c.getId()));
            }
            // Datos de la venta relacionada
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

    // ═════════════════════════════════════════════════════════════════════
    //  OBTENER EL XML TIMBRADO DE UN CFDI (para ver/descargar en el front)
    // ═════════════════════════════════════════════════════════════════════
    public String obtenerXml(String uuid) {
        CfdiTimbrado cfdi = cfdiTimbradoRepository.findByUuid(uuid)
                .orElseThrow(() -> new RuntimeException(
                        "CFDI no encontrado con UUID " + uuid));
        if (cfdi.getXmlTimbrado() == null || cfdi.getXmlTimbrado().isBlank())
            throw new RuntimeException(
                    "Este CFDI no tiene XML almacenado. Descárgalo del portal de FEL.");
        return cfdi.getXmlTimbrado();
    }

    // ═════════════════════════════════════════════════════════════════════
    //  DETALLE DE FACTURA GLOBAL — historial de tickets y productos
    //  Cadena de respaldo SAT: Factura Global → tickets → productos
    // ═════════════════════════════════════════════════════════════════════
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