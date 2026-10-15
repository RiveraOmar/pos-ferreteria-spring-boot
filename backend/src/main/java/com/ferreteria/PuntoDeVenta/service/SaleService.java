package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.dto.SaleRequestDTO;
import com.ferreteria.PuntoDeVenta.dto.SaleResponseDTO;
import com.ferreteria.PuntoDeVenta.exception.InsufficientStockException;
import com.ferreteria.PuntoDeVenta.exception.ResourceNotFoundException;
import com.ferreteria.PuntoDeVenta.model.*;
import com.ferreteria.PuntoDeVenta.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class SaleService {

    private final SaleRepository saleRepository;
    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final CustomerRepository customerRepository;
    private final CfdiTimbradoRepository cfdiTimbradoRepository;
    private final ConfiguracionFacturacionService configuracionFacturacionService;

    private static final Long PUBLIC_CUSTOMER_ID = 1L;
    private static final String CLAVE_PROD_SERV_DEFAULT = "01010101";
    private static final String CLAVE_UNIDAD_DEFAULT     = "H87"; // Pieza
    private static final String OBJETO_IMP_DEFAULT       = "02";  // Sí objeto de impuesto

    @Transactional
    public SaleResponseDTO processFullSale(SaleRequestDTO request) {

        Long customerId = (request.customerId() != null)
                ? request.customerId() : PUBLIC_CUSTOMER_ID;

        Customer customer = customerRepository.findById(customerId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cliente no encontrado: " + customerId));

        Sale sale = new Sale();
       sale.setInvoiceNumber(String.format("INV-%06d",
                saleRepository.siguienteFolioTicket()));
        sale.setCustomer(customer);                         

       BigDecimal factorDescuento = BigDecimal.ONE;
        if (customer.getDiscountRate() != null) {
            BigDecimal pct = customer.getDiscountRate();
            if (pct.compareTo(BigDecimal.ZERO) > 0
                    && pct.compareTo(new BigDecimal("100")) < 0) {
                factorDescuento = BigDecimal.ONE.subtract(
                        pct.divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP));
                log.info("[VENTA] Descuento de cliente {}: {}%", customer.getId(), pct);
            }
        }
        sale.setSellerName("dueno");                         
        sale.setCreatedAt(LocalDateTime.now());
        sale.setStatus("COMPLETED");
        sale.setPaymentMethod(
                request.paymentMethod() != null ? request.paymentMethod() : "EFECTIVO");

        List<SaleItem> saleItems = new ArrayList<>();
        BigDecimal runningTax     = BigDecimal.ZERO;
        BigDecimal runningBase    = BigDecimal.ZERO;

        for (SaleRequestDTO.ItemRequest itemReq : request.items()) {
            boolean esLibre = itemReq.productId() != null && itemReq.productId() == -1L;

            Product product;
            if (esLibre) {
                product = productRepository.findById(-1L)
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Producto genérico no configurado (SKU: LIBRE)"));
            } else {
                Inventory inventory = inventoryRepository
                        .findByProductIdWithLock(itemReq.productId())
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Inventario no encontrado para producto: "
                                        + itemReq.productId()));

                product = inventory.getProduct();

                if (inventory.getStockActual().compareTo(itemReq.quantity()) < 0) {
                    throw new InsufficientStockException(
                            "Stock insuficiente: " + product.getName()
                                    + ". Disponible: " + inventory.getStockActual());
                }
                inventory.setStockActual(inventory.getStockActual().subtract(itemReq.quantity()));
                inventoryRepository.save(inventory);
            }

            BigDecimal qty = itemReq.quantity();

            if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException(
                        "Cantidad inválida para " + product.getName()
                                + ": debe ser mayor a 0.");
            }

            BigDecimal unitPrice = (itemReq.customPrice() != null
                    && itemReq.customPrice().compareTo(BigDecimal.ZERO) > 0)
                    ? itemReq.customPrice()
                    : product.getListPrice();



            if (factorDescuento.compareTo(BigDecimal.ONE) < 0) {
                unitPrice = unitPrice.multiply(factorDescuento)
                        .setScale(2, RoundingMode.HALF_UP);
            }

            if (unitPrice.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException(
                        "El precio final de " + product.getName() + " quedó en $"
                                + unitPrice + ". Revisa el precio manual o el "
                                + "descuento del cliente.");
            }

            BigDecimal taxRate = product.getTaxRate() != null
                    ? product.getTaxRate() : new BigDecimal("0.16");

            BigDecimal itemTotal = unitPrice.multiply(qty);
            BigDecimal divisor   = BigDecimal.ONE.add(taxRate);
            BigDecimal itemTax   = itemTotal.multiply(taxRate)
                    .divide(divisor, 2, RoundingMode.HALF_UP);
            BigDecimal itemBase  = itemTotal.subtract(itemTax);

            SaleItem si = new SaleItem();
            si.setSale(sale);
            si.setProduct(product);
            si.setCustomName(esLibre && itemReq.customName() != null
                    ? itemReq.customName().trim() : null);
            si.setQuantity(itemReq.quantity());
            si.setUnitPrice(unitPrice);
            si.setCostAtSale(product.getCostPrice() != null
                    ? product.getCostPrice() : BigDecimal.ZERO);
            si.setAddedAt(LocalDateTime.now());

            runningTax  = runningTax.add(itemTax);
            runningBase = runningBase.add(itemBase);
            saleItems.add(si);
        }

        BigDecimal total = runningBase.add(runningTax);
        sale.setItems(saleItems);
        sale.setTaxAmount(runningTax);
        sale.setTotalAmount(total);

        if (request.amountReceived() != null) {
            sale.setAmountReceived(request.amountReceived());
            sale.setChangeGiven(request.amountReceived().subtract(total)
                    .max(BigDecimal.ZERO));
        }

        return toDTO(saleRepository.save(sale));
    }

    @Transactional
    public SaleResponseDTO cancelSale(Long saleId, String reason) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Venta no encontrada: " + saleId));

        if ("CANCELLED".equals(sale.getStatus())) {
            throw new RuntimeException("La venta ya está cancelada.");
        }

        cfdiTimbradoRepository
                .findFirstBySaleIdAndStatusNotOrderByFechaTimbradoDesc(saleId, "CANCELADO")
                .ifPresent(cfdi -> {
                    throw new IllegalStateException(
                            "Esta venta tiene una factura timbrada VIGENTE (UUID: "
                                    + cfdi.getUuid() + "). Cancela primero el CFDI ante el "
                                    + "SAT; si no, quedaría una factura de una venta que ya "
                                    + "no existe.");
                });

        if (Boolean.TRUE.equals(sale.getIncluidoFacturaGlobal())) {
            throw new IllegalStateException(
                    "Esta venta está incluida en una factura GLOBAL vigente. "
                            + "Cancela primero la factura global en el módulo de "
                            + "Facturación (eso liberará sus ventas) y luego "
                            + "cancela esta venta.");
        }

        for (SaleItem item : sale.getItems()) {
            if (item.getProduct() == null) continue;   // renglon huerfano
            if (Long.valueOf(-1L).equals(item.getProduct().getId())) continue;
            inventoryRepository.findByProductId(item.getProduct().getId())
                    .ifPresent(inv -> {
                        inv.setStockActual(inv.getStockActual().add(item.getQuantity()));
                        inventoryRepository.save(inv);
                    });
        }

        sale.setStatus("CANCELLED");
        sale.setCancelledAt(LocalDateTime.now());
        sale.setCancelReason(reason);

        return toDTO(saleRepository.save(sale));
    }


    @Transactional(readOnly = true)
    public List<SaleResponseDTO> getSalesByIds(List<Long> ids) {
        return saleRepository.findAllById(ids).stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<Sale> obtenerVentasPendientesGlobal() {
        return obtenerVentasPendientesGlobal(periodoActualConfigurado());
    }

    public com.ferreteria.PuntoDeVenta.util.PeriodoFiscal periodoActualConfigurado() {
        return com.ferreteria.PuntoDeVenta.util.PeriodoFiscal.actual(
                configuracionFacturacionService.periodicidadActual());
    }

    @Transactional(readOnly = true)
    public List<Sale> obtenerVentasPendientesGlobal(
            com.ferreteria.PuntoDeVenta.util.PeriodoFiscal periodo) {

        com.ferreteria.PuntoDeVenta.util.PeriodoFiscal p =
                (periodo != null) ? periodo : periodoActualConfigurado();

        List<Sale> ventasDelPeriodo = saleRepository
                .findPendientesGlobal(PUBLIC_CUSTOMER_ID, p.inicio(), p.fin())
                .stream()
                .filter(v -> !cfdiTimbradoRepository
                        .existsBySaleIdAndStatusNot(v.getId(), "CANCELADO"))
                .collect(Collectors.toList());

        com.ferreteria.PuntoDeVenta.util.PeriodoFiscal ventana = p;
        int pasos = p.tipo().getVentanaRezagados();
        for (int i = 0; i < pasos; i++)
            ventana = ventana.anterior();

        List<Sale> ventasAnteriores = saleRepository
                .findPendientesGlobal(PUBLIC_CUSTOMER_ID,
                        ventana.inicio(), p.inicio().minusSeconds(1))
                .stream()
                .filter(v -> !cfdiTimbradoRepository
                        .existsBySaleIdAndStatusNot(v.getId(), "CANCELADO"))
                .collect(Collectors.toList());

        List<Sale> ventas = new java.util.ArrayList<>(ventasAnteriores);
        ventas.addAll(ventasDelPeriodo);
        return ventas;
    }

    public Map<String, Object> getVentasPublicoGeneralHoy() {
        return getVentasPublicoGeneralPeriodo(periodoActualConfigurado());
    }

    public Map<String, Object> getVentasPublicoGeneralPeriodo(
            com.ferreteria.PuntoDeVenta.util.PeriodoFiscal periodo) {
        com.ferreteria.PuntoDeVenta.util.PeriodoFiscal q =
                (periodo != null) ? periodo : periodoActualConfigurado();
        java.time.YearMonth mes = q.mesFiscal();
        List<Sale> ventas = obtenerVentasPendientesGlobal(q);

        Map<String, Map<String, Object>> productosAgrupados = new LinkedHashMap<>();
        BigDecimal totalGeneral = BigDecimal.ZERO;

        for (Sale v : ventas) {
            for (SaleItem item : v.getItems()) {
                if (item.getProduct() == null) continue;
                String key    = item.getProduct().getSku();
                String nombre = item.getProduct().getName();

                String claveProducto = item.getProduct().getSatClaveProdServ();
                claveProducto = (claveProducto != null && !claveProducto.isBlank())
                        ? claveProducto : CLAVE_PROD_SERV_DEFAULT;

                String claveUnidad = item.getProduct().getSatClaveUnidad();
                claveUnidad = (claveUnidad != null && !claveUnidad.isBlank())
                        ? claveUnidad : CLAVE_UNIDAD_DEFAULT;

                String objetoImpuesto = item.getProduct().getSatObjetoImp();
                objetoImpuesto = (objetoImpuesto != null && !objetoImpuesto.isBlank())
                        ? objetoImpuesto : OBJETO_IMP_DEFAULT;

                if (productosAgrupados.containsKey(key)) {
                    Map<String, Object> p = productosAgrupados.get(key);
                    BigDecimal qty = ((BigDecimal) p.get("cantidad")).add(item.getQuantity());
                    p.put("cantidad", qty);
                    p.put("importe",
                            item.getUnitPrice().multiply(qty));
                } else {
                    Map<String, Object> p = new LinkedHashMap<>();
                    p.put("sku",             key);
                    p.put("nombre",          nombre);
                    p.put("claveProducto",   claveProducto);
                    p.put("claveUnidad",     claveUnidad);
                    p.put("objetoImpuesto",  objetoImpuesto);
                    p.put("cantidad",        item.getQuantity());
                    p.put("valorUnitario",   item.getUnitPrice());
                    p.put("importe",
                            item.getUnitPrice().multiply(item.getQuantity()));
                    productosAgrupados.put(key, p);
                }
                totalGeneral = totalGeneral.add(
                        item.getUnitPrice().multiply(item.getQuantity()));
            }
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("fecha",          LocalDate.now().toString());
        result.put("periodo",        q.toString());                     
        result.put("periodicidad",   q.tipo().name());                  
        result.put("codigoSat",      q.tipo().getCodigoSat());          
        result.put("etiquetaPeriodo", q.etiqueta());                    
        result.put("anio",           mes.getYear());
        result.put("mes",            String.format("%02d", mes.getMonthValue()));
        result.put("totalVentas",    ventas.size());
        result.put("totalImporte",   totalGeneral);
        result.put("conceptos",      new ArrayList<>(productosAgrupados.values()));
        result.put("saleIds",        ventas.stream().map(Sale::getId).collect(Collectors.toList()));

        result.put("ventas", ventas.stream().map(v -> {
            com.ferreteria.PuntoDeVenta.util.PeriodoFiscal qVenta =
                    v.getCreatedAt() != null
                            ? com.ferreteria.PuntoDeVenta.util.PeriodoFiscal
                            .deLocalDateTime(q.tipo(), v.getCreatedAt()) : null;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("id",      v.getId());
            m.put("folio",   v.getInvoiceNumber());
            m.put("fecha",   v.getCreatedAt() != null ? v.getCreatedAt().toString() : "");
            m.put("total",   v.getTotalAmount());
            m.put("periodo", qVenta != null ? qVenta.toString() : "");
            m.put("esDelPeriodo", q.equals(qVenta));
            m.put("esDeHoy",      q.equals(qVenta));
            return m;
        }).collect(Collectors.toList()));
        result.put("rfcReceptor",    "XAXX010101000");
        result.put("razonReceptor",  "PUBLICO EN GENERAL");
        result.put("regimenReceptor","616");
        result.put("usoCfdi",        "S01");
        return result;
    }

    @Transactional
    public Map<String, Object> marcarFacturaGlobal(List<Long> saleIds) {
        List<Sale> ventas = saleRepository.findAllById(saleIds);
        ventas.forEach(v -> v.setIncluidoFacturaGlobal(true));
        saleRepository.saveAll(ventas);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("marcadas", ventas.size());
        result.put("fecha",    LocalDate.now().toString());
        return result;
    }



    @Transactional(readOnly = true)
    public List<SaleResponseDTO> getRecentSales(int limit) {
        return saleRepository.findTop50ByOrderByCreatedAtDesc()
                .stream().limit(limit).map(this::toDTO)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SaleResponseDTO> buscarConFiltros(
            LocalDateTime inicio, LocalDateTime fin,
            String status, String texto) {

        LocalDateTime inicioFinal = inicio != null ? inicio : LocalDateTime.of(2020, 1, 1, 0, 0);
        LocalDateTime finFinal    = fin    != null ? fin    : LocalDateTime.now();
        String statusFinal        = (status != null && !status.isBlank()) ? status : "TODOS";
        String textoFinal         = (texto  != null) ? texto.trim() : "";

        return saleRepository.buscarConFiltros(inicioFinal, finFinal, statusFinal, textoFinal)
                .stream().map(this::toDTO)
                .collect(Collectors.toList());
    }


    private SaleResponseDTO toDTO(Sale sale) {
        List<SaleResponseDTO.SaleItemDTO> items = sale.getItems().stream()
                .map(i -> {
                    Product prod = i.getProduct();
                    String nombre;
                    if (i.getCustomName() != null && !i.getCustomName().isBlank())
                        nombre = i.getCustomName();
                    else if (prod != null)
                        nombre = prod.getName();
                    else
                        nombre = "(producto ya no disponible)";

                    return new SaleResponseDTO.SaleItemDTO(
                            prod != null ? prod.getId() : null,
                            nombre,
                            i.getQuantity(),
                            i.getUnitPrice(),
                            i.getCostAtSale(),
                            i.getAddedAt(),
                            i.getLlevadoPor());
                })
                .collect(Collectors.toList());

        return new SaleResponseDTO(
                sale.getId(),
                sale.getInvoiceNumber(),
                sale.getTotalAmount(),
                sale.getTaxAmount(),
                sale.getAmountReceived(),
                sale.getChangeGiven(),
                sale.getPaymentMethod(),
                sale.getStatus(),
                sale.getCreatedAt(),
                sale.getCustomer() != null ? sale.getCustomer().getFullName() : "Público General",
                sale.getCustomer() != null ? sale.getCustomer().getRfc() : null,
                items
        );
    }

    @Transactional
    public BigDecimal addItemsToSale(Long saleId, List<SaleRequestDTO.ItemRequest> items,
                                     String llevadoPor) {
        Sale sale = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Venta no encontrada: " + saleId));

        if (!"DEUDA".equals(sale.getPaymentMethod())) {
            throw new IllegalStateException(
                    "Solo se pueden agregar productos a notas de fiado (DEUDA).");
        }

       BigDecimal factorDescuento = BigDecimal.ONE;
        Customer clienteNota = sale.getCustomer();
        if (clienteNota != null && clienteNota.getDiscountRate() != null) {
            BigDecimal pct = clienteNota.getDiscountRate();
            if (pct.compareTo(BigDecimal.ZERO) > 0
                    && pct.compareTo(new BigDecimal("100")) < 0) {
                factorDescuento = BigDecimal.ONE.subtract(
                        pct.divide(new BigDecimal("100"), 4, RoundingMode.HALF_UP));
            }
        }

        BigDecimal deltaTax  = BigDecimal.ZERO;
        BigDecimal deltaBase = BigDecimal.ZERO;

        for (SaleRequestDTO.ItemRequest itemReq : items) {
            boolean esLibre = itemReq.productId() != null && itemReq.productId() == -1L;

            Product product;
            if (esLibre) {
                product = productRepository.findById(-1L)
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Producto genérico no configurado (SKU: LIBRE)"));
            } else {
                Inventory inventory = inventoryRepository
                        .findByProductIdWithLock(itemReq.productId())
                        .orElseThrow(() -> new ResourceNotFoundException(
                                "Inventario no encontrado para producto: "
                                        + itemReq.productId()));
                product = inventory.getProduct();

                if (inventory.getStockActual().compareTo(itemReq.quantity()) < 0) {
                    throw new InsufficientStockException(
                            "Stock insuficiente: " + product.getName()
                                    + ". Disponible: " + inventory.getStockActual());
                }
                inventory.setStockActual(
                        inventory.getStockActual().subtract(itemReq.quantity()));
                inventoryRepository.save(inventory);
            }

            BigDecimal qty = itemReq.quantity();

            if (qty == null || qty.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException(
                        "Cantidad inválida para " + product.getName()
                                + ": debe ser mayor a 0.");
            }

            BigDecimal unitPrice = (itemReq.customPrice() != null
                    && itemReq.customPrice().compareTo(BigDecimal.ZERO) > 0)
                    ? itemReq.customPrice()
                    : product.getListPrice();



            if (factorDescuento.compareTo(BigDecimal.ONE) < 0) {
                unitPrice = unitPrice.multiply(factorDescuento)
                        .setScale(2, RoundingMode.HALF_UP);
            }
if (unitPrice.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException(
                        "El precio final de " + product.getName() + " quedó en $"
                                + unitPrice + ". Revisa el precio manual o el "
                                + "descuento del cliente.");
            }

            BigDecimal taxRate = product.getTaxRate() != null
                    ? product.getTaxRate() : new BigDecimal("0.16");

            BigDecimal itemTotal = unitPrice.multiply(qty);
            BigDecimal divisor   = BigDecimal.ONE.add(taxRate);
            BigDecimal itemTax   = itemTotal.multiply(taxRate)
                    .divide(divisor, 2, RoundingMode.HALF_UP);
            BigDecimal itemBase  = itemTotal.subtract(itemTax);

            SaleItem si = new SaleItem();
            si.setSale(sale);
            si.setProduct(product);
            si.setCustomName(esLibre && itemReq.customName() != null
                    ? itemReq.customName().trim() : null);
            si.setQuantity(qty);
            si.setUnitPrice(unitPrice);
            si.setCostAtSale(product.getCostPrice() != null
                    ? product.getCostPrice() : BigDecimal.ZERO);
            si.setAddedAt(LocalDateTime.now());
            si.setLlevadoPor(llevadoPor != null && !llevadoPor.isBlank()
                    ? llevadoPor : null);
            sale.getItems().add(si);

            deltaTax  = deltaTax.add(itemTax);
            deltaBase = deltaBase.add(itemBase);
        }

        BigDecimal delta = deltaBase.add(deltaTax);
        sale.setTaxAmount(sale.getTaxAmount().add(deltaTax));
        sale.setTotalAmount(sale.getTotalAmount().add(delta));
        saleRepository.save(sale);
        return delta;
    }

    @Transactional
    public void descartarDeGlobal(Long saleId) {
        Sale v = saleRepository.findById(saleId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Venta no encontrada: " + saleId));
        if (v.getCfdiGlobal() != null)
            throw new IllegalStateException(
                    "Esta venta ya está dentro de una factura global timbrada.");
        if (cfdiTimbradoRepository.existsBySaleIdAndStatusNot(saleId, "CANCELADO"))
            throw new IllegalStateException(
                    "Esta venta tiene factura nominativa vigente; no aplica.");
        v.setIncluidoFacturaGlobal(true);   
        saleRepository.save(v);
        log.info("[GLOBAL] Venta {} ({}) DESCARTADA del flujo de factura global",
                v.getId(), v.getInvoiceNumber());
    }

    
    @Transactional
    public int descartarAntiguasDeGlobal() {
        return descartarAntiguasDeGlobal(periodoActualConfigurado());
    }

    @Transactional
    public int descartarAntiguasDeGlobal(
            com.ferreteria.PuntoDeVenta.util.PeriodoFiscal periodo) {
        com.ferreteria.PuntoDeVenta.util.PeriodoFiscal p =
                (periodo != null) ? periodo : periodoActualConfigurado();
        List<Sale> pendientes = obtenerVentasPendientesGlobal(p);
        int n = 0;
        for (Sale v : pendientes) {
            if (v.getCreatedAt() != null) {
                com.ferreteria.PuntoDeVenta.util.PeriodoFiscal pv =
                        com.ferreteria.PuntoDeVenta.util.PeriodoFiscal
                                .deLocalDateTime(p.tipo(), v.getCreatedAt());
                if (pv.compareTo(p) < 0) {
                    v.setIncluidoFacturaGlobal(true);
                    n++;
                }
            }
        }
        saleRepository.saveAll(pendientes);
        log.info("[GLOBAL] {} venta(s) de periodos anteriores a {} descartadas "
                + "del flujo de global", n, p);
        return n;
    }

}