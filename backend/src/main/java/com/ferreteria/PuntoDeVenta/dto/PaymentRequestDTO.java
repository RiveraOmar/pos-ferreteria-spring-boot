package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;

public record PaymentRequestDTO(
        BigDecimal amount,
        String notes
) {}