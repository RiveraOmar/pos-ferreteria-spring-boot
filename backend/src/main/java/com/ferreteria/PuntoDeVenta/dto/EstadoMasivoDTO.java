package com.ferreteria.PuntoDeVenta.dto;

import java.util.List;

/** Activar o desactivar varios productos a la vez. */
public record EstadoMasivoDTO(
        List<Long> ids,
        boolean    activo
) {}