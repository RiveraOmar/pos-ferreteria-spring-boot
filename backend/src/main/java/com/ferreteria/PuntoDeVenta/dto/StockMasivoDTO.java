package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;

/**
 * Carga masiva de existencias a TODO el catálogo.
 *
 * @param cantidad          existencia que quedará en cada producto (ej. 100).
 * @param soloEnCero        true = solo toca los que están en 0 o sin registro
 *                          de inventario; los que ya tienen piezas contadas
 *                          NO se pisan. Es el modo seguro y el default.
 * @param incluirInactivos  true = también los productos dados de baja.
 * @param motivo            queda en la bitácora de ajustes (obligatorio en
 *                          los ajustes individuales, aquí se pone un default).
 */
public record StockMasivoDTO(
        BigDecimal cantidad,
        Boolean soloEnCero,
        Boolean incluirInactivos,
        String motivo
) {}
