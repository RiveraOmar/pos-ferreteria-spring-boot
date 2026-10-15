package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record CustomerResponseDTO(
        Long id,
        String fullName,
        String rfc,
        String email,
        String phoneNumber,
        String customerType,
        BigDecimal discountRate,
        LocalDateTime createdAt,
        Boolean active,
        String address,
        String city,

        // ── Datos fiscales SAT ───────────────────────────────
        String razonSocial,
        String regimenFiscal,
        String usoCfdi,
        String codigoPostal,
        String satPais
        // ────────────────────────────────────────────────────
) {}