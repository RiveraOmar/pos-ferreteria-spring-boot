package com.ferreteria.PuntoDeVenta.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

public record SaleRequestDTO(
        Long customerId,

        @NotEmpty(message = "La venta debe tener al menos un producto")
        List<ItemRequest> items,

        String paymentMethod,

        @DecimalMin(value = "0.00", message = "El monto recibido no puede ser negativo")
        BigDecimal amountReceived
) {
    public record ItemRequest(
            @NotNull(message = "El producto es obligatorio")
            Long productId,

            // BigDecimal: soporta enteros (1, 2) y fracciones (0.5, 1.75, 250.0)
            @NotNull(message = "La cantidad es obligatoria")
            @DecimalMin(value = "0.001", message = "La cantidad debe ser mayor a 0")
            BigDecimal quantity,

            @DecimalMin(value = "0.01", message = "El precio personalizado debe ser mayor a 0")
            BigDecimal customPrice,

            // Solo para producto LIBRE (productId = -1): descripción real
            // capturada en caja. Nulo para productos de catálogo.
            String customName
    ) {}
}