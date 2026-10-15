package com.ferreteria.PuntoDeVenta.dto;

import java.util.List;

public record EstadoMasivoDTO(
        List<Long> ids,
        boolean    activo
) {}