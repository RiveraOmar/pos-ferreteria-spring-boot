package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.util.Map;

public record ProductResponseDTO(
        Long id,
        String sku,
        String name,
        String description,
        BigDecimal price,
        String costCode,
        BigDecimal currentStock,    
        Map<String, Object> attributes,
        CategorySlimDTO category,
        boolean active,
        BigDecimal minStockLevel,  
        String barcode,            

        String satClaveProdServ,
        String satClaveUnidad,      
        String satObjetoImp,
        String imagenUrl,
        String locationRack,   
        Boolean compraPorBolsa,
        Integer piezasPorBolsa,
        BigDecimal precioBolsa
) {
    public record CategorySlimDTO(Long id, String name) {}
}