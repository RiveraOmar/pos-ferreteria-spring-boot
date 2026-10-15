package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;


public record InventoryAdjustmentDTO(
        BigDecimal cantidadReal,   
        String     motivo,         
        String     nota            
) {}