package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.dto.PurchaseOrderDTO;
import com.ferreteria.PuntoDeVenta.dto.PurchaseOrderRequestDTO;
import com.ferreteria.PuntoDeVenta.exception.ResourceNotFoundException;
import com.ferreteria.PuntoDeVenta.model.*;
import com.ferreteria.PuntoDeVenta.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PurchaseOrderService {

    private final PurchaseOrderRepository    purchaseOrderRepository;
    private final SupplierRepository          supplierRepository;
    private final ProductRepository           productRepository;
    private final InventoryRepository         inventoryRepository;
    private final SupplierProductRepository   supplierProductRepository;
    private final PriceHistoryRepository      priceHistoryRepository;

    // ─── Registrar compra: SUBE el stock, ACTUALIZA el costo del producto ─────
    @Transactional
    public PurchaseOrderDTO registrar(PurchaseOrderRequestDTO req) {
        Supplier supplier = supplierRepository.findById(req.supplierId())
                .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado"));

        PurchaseOrder po = new PurchaseOrder();
        po.setSupplier(supplier);
        po.setFolio("OC-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        po.setStatus("RECIBIDA");
        po.setInvoiceNumber(req.invoiceNumber());
        po.setNotes(req.notes());
        po.setCreatedAt(LocalDateTime.now());

        BigDecimal subtotal = BigDecimal.ZERO;

        for (var itemReq : req.items()) {
            Product product = productRepository.findById(itemReq.productId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Producto no encontrado: " + itemReq.productId()));

            BigDecimal itemSubtotal = itemReq.unitCost().multiply(itemReq.quantity())
                    .setScale(2, RoundingMode.HALF_UP);
            subtotal = subtotal.add(itemSubtotal);

            PurchaseOrderItem item = new PurchaseOrderItem();
            item.setPurchaseOrder(po);
            item.setProduct(product);
            item.setProductName(product.getName());
            item.setProductSku(product.getSku());
            item.setQuantity(itemReq.quantity());
            item.setUnitCost(itemReq.unitCost());
            item.setSubtotal(itemSubtotal);
            po.getItems().add(item);

            // ── 1. SUBIR STOCK ───────────────────────────────────────────────
            Inventory inv = inventoryRepository.findByProductIdWithLock(product.getId())
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Sin registro de inventario para: " + product.getName()));
            inv.setStockActual(inv.getStockActual().add(itemReq.quantity()));
            inv.setLastRestock(LocalDateTime.now());
            inventoryRepository.save(inv);

            // ── 2. VALIDAR: el costo nuevo nunca puede superar el precio de venta ──
            // Se compara contra el precio que el producto VA A TENER después de esta
            // compra: si mandaste newListPrice, contra ese; si no, contra el que ya
            // tenía guardado. Así evitamos que un producto quede vendiéndose a pérdida
            // de forma silenciosa cuando solo se sube el costo sin tocar el precio.
            BigDecimal precioVentaResultante = itemReq.newListPrice() != null
                    ? itemReq.newListPrice()
                    : product.getListPrice();

            if (precioVentaResultante != null
                    && itemReq.unitCost().compareTo(precioVentaResultante) > 0) {
                throw new RuntimeException(
                        "El nuevo costo de \"" + product.getName() + "\" ($"
                                + itemReq.unitCost() + ") es mayor al precio de venta actual ($"
                                + precioVentaResultante + "). Captura también el nuevo precio "
                                + "de venta para este producto.");
            }

            // ── 3. ACTUALIZAR COSTO (siempre) Y PRECIO DE VENTA (si se indicó) ──
            if (product.getCostPrice() == null ||
                    product.getCostPrice().compareTo(itemReq.unitCost()) != 0) {
                PriceHistory h = new PriceHistory();
                h.setProduct(product);
                h.setOldPrice(product.getCostPrice());
                h.setNewPrice(itemReq.unitCost());
                h.setChangeDate(LocalDateTime.now());
                priceHistoryRepository.save(h);
            }
            product.setCostPrice(itemReq.unitCost());

            // El precio de venta es opcional: si el dueño lo capturó en la compra,
            // se actualiza junto con el costo. Si no, el precio de venta no se toca.
            if (itemReq.newListPrice() != null) {
                product.setListPrice(itemReq.newListPrice());
                // Antes aquí también se subía minPrice al nuevo precio. Se
                // quitó: era una de las formas de dejar el producto invendible
                // más adelante, cuando el precio bajara por otro lado.
            }
            productRepository.save(product);

            // ── 3. GUARDAR RELACIÓN PROVEEDOR-PRODUCTO (para comparar precios) ─
            SupplierProduct sp = supplierProductRepository
                    .findBySupplierIdAndProductId(supplier.getId(), product.getId())
                    .orElseGet(() -> {
                        SupplierProduct nuevo = new SupplierProduct();
                        nuevo.setSupplier(supplier);
                        nuevo.setProduct(product);
                        return nuevo;
                    });
            sp.setLastCost(itemReq.unitCost());
            sp.setLastPurchaseAt(LocalDateTime.now());
            supplierProductRepository.save(sp);
        }

        // El costo no lleva IVA desglosado en este sistema (se maneja como compra directa)
        po.setSubtotal(subtotal);
        po.setTaxAmount(BigDecimal.ZERO);
        po.setTotal(subtotal);

        return toDTO(purchaseOrderRepository.save(po));
    }

    @Transactional
    public PurchaseOrderDTO cancelar(Long id, String motivo) {
        PurchaseOrder po = purchaseOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Orden no encontrada"));

        if ("CANCELADA".equals(po.getStatus())) {
            throw new RuntimeException("Esta orden ya está cancelada.");
        }

        // Revertir el stock que se había sumado
        for (PurchaseOrderItem item : po.getItems()) {
            inventoryRepository.findByProductId(item.getProduct().getId())
                    .ifPresent(inv -> {
                        BigDecimal nuevoStock = inv.getStockActual().subtract(item.getQuantity());
                        // No permitir stock negativo al cancelar — si ya se vendió, se queda en 0
                        inv.setStockActual(nuevoStock.max(BigDecimal.ZERO));
                        inventoryRepository.save(inv);
                    });
        }

        po.setStatus("CANCELADA");
        po.setCancelledAt(LocalDateTime.now());
        po.setCancelReason(motivo);
        return toDTO(purchaseOrderRepository.save(po));
    }

    @Transactional(readOnly = true)
    public List<PurchaseOrderDTO> listarRecientes() {
        return purchaseOrderRepository.findTop50ByOrderByCreatedAtDesc().stream()
                .map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PurchaseOrderDTO> porProveedor(Long supplierId) {
        return purchaseOrderRepository.findBySupplierIdOrderByCreatedAtDesc(supplierId).stream()
                .map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PurchaseOrderDTO obtener(Long id) {
        return toDTO(purchaseOrderRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Orden no encontrada")));
    }

    @Transactional(readOnly = true)
    public List<PurchaseOrderDTO> buscarConFiltros(
            LocalDateTime inicio, LocalDateTime fin, String status) {
        LocalDateTime inicioFinal = inicio != null ? inicio : LocalDateTime.of(2020,1,1,0,0);
        LocalDateTime finFinal    = fin    != null ? fin    : LocalDateTime.now();
        String statusFinal        = (status != null && !status.isBlank()) ? status : "TODOS";
        return purchaseOrderRepository.buscarConFiltros(inicioFinal, finFinal, statusFinal)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    private PurchaseOrderDTO toDTO(PurchaseOrder po) {
        List<PurchaseOrderDTO.ItemDTO> items = po.getItems().stream()
                .map(i -> new PurchaseOrderDTO.ItemDTO(
                        i.getId(), i.getProduct().getId(), i.getProductName(),
                        i.getProductSku(), i.getQuantity(), i.getUnitCost(), i.getSubtotal()
                )).collect(Collectors.toList());

        return new PurchaseOrderDTO(
                po.getId(), po.getSupplier().getId(), po.getSupplier().getCompanyName(),
                po.getFolio(), po.getStatus(), po.getSubtotal(), po.getTaxAmount(),
                po.getTotal(), po.getInvoiceNumber(), po.getNotes(), po.getCreatedAt(), items
        );
    }
}