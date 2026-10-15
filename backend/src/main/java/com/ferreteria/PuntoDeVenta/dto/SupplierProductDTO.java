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
        BigDecimal currentListPrice,  // precio de venta actual del producto, para validar costo-vs-venta al re-comprar
        String satClaveUnidad,        // clave SAT del producto, para saber si acepta fracciones (kg, m, L...)
        String productImageUrl        // foto del producto, para reconocerlo rápido en el listado de compras
) {}