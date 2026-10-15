package com.ferreteria.PuntoDeVenta.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

public record PurchaseOrderRequestDTO(
        @NotNull(message = "El proveedor es obligatorio")
        Long supplierId,

        String invoiceNumber,
        String notes,

        @NotEmpty(message = "La orden debe tener al menos un producto")
        List<ItemRequest> items
) {
    public record ItemRequest(
            @NotNull(message = "El producto es obligatorio")
            Long productId,

            @NotNull
            @DecimalMin(value = "0.001", message = "La cantidad debe ser mayor a 0")
            BigDecimal quantity,

            @NotNull
            @DecimalMin(value = "0.01", message = "El costo unitario debe ser mayor a 0")
            BigDecimal unitCost,

           
            @DecimalMin(value = "0.01", message = "El precio de venta debe ser mayor a 0")
            BigDecimal newListPrice
    ) {
        public ItemRequest {
            if (newListPrice != null && unitCost != null
                    && newListPrice.compareTo(unitCost) < 0) {
                throw new IllegalArgumentException(
                        "El precio de venta no puede ser menor al costo de compra.");
            }
        }
    }
}