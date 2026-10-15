package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.util.List;

public record PrefacturaRequestDTO(
        Long customerId,
        String notes,
        List<ItemRequest> items
) {
    public record ItemRequest(
            Long productId,
            String productName,
            String productSku,
            BigDecimal quantity,
            BigDecimal unitPrice
    ) {}
}