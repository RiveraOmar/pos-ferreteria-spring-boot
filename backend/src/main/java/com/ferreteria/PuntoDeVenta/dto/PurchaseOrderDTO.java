package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record PurchaseOrderDTO(
        Long id,
        Long supplierId,
        String supplierName,
        String folio,
        String status,
        BigDecimal subtotal,
        BigDecimal taxAmount,
        BigDecimal total,
        String invoiceNumber,
        String notes,
        LocalDateTime createdAt,
        List<ItemDTO> items
) {
    public record ItemDTO(
            Long id,
            Long productId,
            String productName,
            String productSku,
            BigDecimal quantity,
            BigDecimal unitCost,
            BigDecimal subtotal
    ) {}
}