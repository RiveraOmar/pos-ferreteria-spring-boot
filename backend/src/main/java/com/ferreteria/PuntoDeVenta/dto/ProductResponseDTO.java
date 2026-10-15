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
        BigDecimal currentStock,    // BigDecimal: puede ser 10.5 metros, 250.0 gramos
        Map<String, Object> attributes,
        CategorySlimDTO category,
        boolean active,
        BigDecimal minStockLevel,   // Fix: Product.minStockLevel ya es BigDecimal, no Integer
        String barcode,             // código de barras, null si no tiene — usado en el modal de edición

        // ── Campos SAT / CFDI ─────────────────────────────────────────────────
        String satClaveProdServ,
        String satClaveUnidad,      // Clave SAT → determina si acepta decimales
        String satObjetoImp,
        // ─────────────────────────────────────────────────────────────────────
        String imagenUrl,
        String locationRack,   // ubicación física: pasillo/estante
        Boolean compraPorBolsa,
        Integer piezasPorBolsa,
        BigDecimal precioBolsa
) {
    public record CategorySlimDTO(Long id, String name) {}
}