package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;

public record DebtRequestDTO(
        Long customerId,
        Long saleId,
        BigDecimal totalAmount,
        String notes
) {}