package com.ferreteria.PuntoDeVenta.dto;

import java.util.List;


public record AgregarItemsDebtDTO(
        List<SaleRequestDTO.ItemRequest> items,
        String nota
) {}