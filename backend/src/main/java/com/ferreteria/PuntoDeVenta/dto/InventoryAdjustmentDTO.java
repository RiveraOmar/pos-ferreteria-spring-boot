package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;

/**
 * Lo que manda el frontend para ajustar el stock.
 *
 * Se envía la cantidad REAL contada, no la diferencia. Es a propósito: quien
 * está frente al anaquel cuenta piezas ("hay 7"), no calcula restas ("quita
 * 3"). Pedirle la diferencia es pedirle que haga una cuenta de cabeza, y ahí
 * es donde se equivoca.
 */
public record InventoryAdjustmentDTO(
        BigDecimal cantidadReal,   // lo que de verdad hay en el anaquel
        String     motivo,         // CONTEO_FISICO, MERMA, ROBO, ...
        String     nota            // opcional: el detalle
) {}