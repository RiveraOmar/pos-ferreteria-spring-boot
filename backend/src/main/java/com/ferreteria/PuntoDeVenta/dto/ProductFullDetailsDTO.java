package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;


public record ProductFullDetailsDTO(
        Long id,
        String sku,
        String name,
        String description,
        BigDecimal price,
        BigDecimal currentStock,
        Map<String, Object> attributes,
        CategorySlimDTO category,
        boolean active,
        BigDecimal minStockLevel,
        String imagenUrl,
        String unitLabel,           
        boolean allowDecimal,       
        String barcode,             
        String locationRack,        
        LocalDateTime createdAt,    
        LocalDateTime updatedAt,   

        String satClaveProdServ,
        String satClaveUnidad,
        String satObjetoImp,

        List<PriceChangeDTO> priceHistory,

        List<SupplierForProductDTO> suppliers,

        Boolean compraPorBolsa,
        Integer piezasPorBolsa,
        BigDecimal costoBolsa,
        BigDecimal precioBolsa
) {
    public record CategorySlimDTO(Long id, String name) {}

    public record PriceChangeDTO(
            LocalDateTime changeDate,
            String direction  
    ) {}

    public record SupplierForProductDTO(
            Long supplierId,
            String companyName,
            String phoneNumber,
            String supplierSku,
            LocalDateTime lastPurchaseAt
    ) {}
}