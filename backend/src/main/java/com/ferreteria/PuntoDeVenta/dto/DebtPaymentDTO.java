package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record DebtPaymentDTO(
        Long id,
        BigDecimal amount,
        String notes,
        LocalDateTime paymentDate
) {}