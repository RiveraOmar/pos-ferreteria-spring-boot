package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record DebtResponseDTO(
        Long id,
        Long customerId,
        String customerName,
        String customerPhone,
        Long saleId,
        String invoiceNumber,
        BigDecimal totalAmount,
        BigDecimal paidAmount,
        BigDecimal remainingAmount,
        String status,
        String notes,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {}