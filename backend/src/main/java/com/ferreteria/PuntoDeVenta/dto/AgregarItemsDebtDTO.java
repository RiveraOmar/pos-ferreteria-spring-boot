package com.ferreteria.PuntoDeVenta.dto;

import java.util.List;

/**
 * Petición para agregar productos a una nota de fiado existente.
 * items: mismos campos que al crear una venta (productId, quantity, customPrice)
 * nota:  texto opcional de quién llevó el producto; se ANEXA a la nota
 *        existente de la deuda (no la reemplaza).
 */
public record AgregarItemsDebtDTO(
        List<SaleRequestDTO.ItemRequest> items,
        String nota
) {}