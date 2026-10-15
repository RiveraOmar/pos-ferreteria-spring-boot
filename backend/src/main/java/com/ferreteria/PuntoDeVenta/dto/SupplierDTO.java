package com.ferreteria.PuntoDeVenta.dto;

import java.time.LocalDateTime;

public record SupplierDTO(
        Long id,
        String companyName,
        String contactName,
        String phoneNumber,
        String email,
        String address,
        String city,
        String rfc,
        String notes,
        boolean active,
        LocalDateTime createdAt,
        Integer totalCompras,        // cuántas órdenes de compra tiene este proveedor
        java.math.BigDecimal totalGastado  // suma histórica gastada con este proveedor
) {}