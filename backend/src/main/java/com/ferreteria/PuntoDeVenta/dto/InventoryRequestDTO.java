package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;

public record InventoryRequestDTO(
        BigDecimal quantityToAdd,   // BigDecimal: permite agregar 0.5 metros, 250.5 gramos, etc.
        BigDecimal newCostPrice,
        BigDecimal newListPrice,
        String location,
        Boolean allowLoss           // true = el usuario confirmó vender por debajo del costo
) {}