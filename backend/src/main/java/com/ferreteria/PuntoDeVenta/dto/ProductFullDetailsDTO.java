package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Ficha completa de solo lectura para un producto: datos generales, SAT,
 * historial de cambios de precio, y proveedores que lo surten.
 * Pensada para el botón "Ver detalles" en Productos y en Ventas — una sola
 * llamada en vez de cuatro, así abrir la ficha es instantáneo.
 *
 * IMPORTANTE: no expone el costo en texto plano (mismo criterio de seguridad
 * que ProductResponseDTO) — el historial de precio solo muestra fechas y si
 * subió o bajó, nunca el monto exacto, para no filtrar el margen al vendedor.
 */
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
        String unitLabel,           // etiqueta amigable derivada de satClaveUnidad (pza, kg, m...)
        boolean allowDecimal,       // si acepta cantidades fraccionarias
        String barcode,             // código de barras, null si no tiene
        String locationRack,        // ubicación física en bodega (ej: "Pasillo A, Estante 3")
        LocalDateTime createdAt,    // cuándo se dio de alta el producto
        LocalDateTime updatedAt,    // última edición (lo mantiene un trigger de BD)

        // ── SAT / CFDI ────────────────────────────────────────────────────────
        String satClaveProdServ,
        String satClaveUnidad,
        String satObjetoImp,

        // ── Historial de precio (solo fechas y dirección del cambio) ───────────
        List<PriceChangeDTO> priceHistory,

        // ── Proveedores que surten este producto ───────────────────────────────
        List<SupplierForProductDTO> suppliers,

        // ── Compra por bolsa / venta por pieza ─────────────────────────────────
        Boolean compraPorBolsa,
        Integer piezasPorBolsa,
        BigDecimal costoBolsa,
        BigDecimal precioBolsa
) {
    public record CategorySlimDTO(Long id, String name) {}

    public record PriceChangeDTO(
            LocalDateTime changeDate,
            String direction   // "SUBIO" | "BAJO" | "SIN_CAMBIO_PREVIO" — sin exponer el monto
    ) {}

    public record SupplierForProductDTO(
            Long supplierId,
            String companyName,
            String phoneNumber,
            String supplierSku,
            LocalDateTime lastPurchaseAt
    ) {}
}