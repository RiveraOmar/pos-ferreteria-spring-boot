package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record SupplierProductDTO(
        Long id,
        Long supplierId,
        String supplierName,
        Long productId,
        String productName,
        String productSku,
        String supplierSku,
        BigDecimal lastCost,
        LocalDateTime lastPurchaseAt,
        BigDecimal currentListPrice,  
        String satClaveUnidad,       
        String productImageUrl        
) {}