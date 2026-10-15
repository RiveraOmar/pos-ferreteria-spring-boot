package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record PrefacturaDTO(
        Long id,
        Long customerId,
        String customerName,
        String customerRfc,
        String folio,
        String status,
        BigDecimal subtotal,
        BigDecimal taxAmount,
        BigDecimal total,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<PrefacturaItemDTO> items
) {
    public record PrefacturaItemDTO(
            Long id,
            Long productId,
            String productName,
            String productSku,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal subtotal
    ) {}
}