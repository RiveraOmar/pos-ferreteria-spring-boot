package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record SaleResponseDTO(
        Long id,
        String invoiceNumber,
        BigDecimal totalAmount,
        BigDecimal taxAmount,
        BigDecimal amountReceived,
        BigDecimal changeGiven,
        String paymentMethod,
        String status,
        LocalDateTime createdAt,
        String customerName,
        String customerRfc,
        List<SaleItemDTO> items
) {
    public record SaleItemDTO(
            Long productId,
            String productName,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal costAtSale,
            LocalDateTime addedAt,   
            String llevadoPor       
    ) {}
}