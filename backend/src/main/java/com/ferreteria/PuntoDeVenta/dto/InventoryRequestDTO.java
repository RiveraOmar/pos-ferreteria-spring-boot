package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;

public record InventoryRequestDTO(
        BigDecimal quantityToAdd,   
        BigDecimal newCostPrice,
        BigDecimal newListPrice,
        String location,
        Boolean allowLoss           
) {}