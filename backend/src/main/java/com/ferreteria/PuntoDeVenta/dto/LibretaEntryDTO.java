package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Una línea de la "libreta de fiado" de un cliente: puede ser un CARGO
 * (un producto que se llevó) o un ABONO (un pago que hizo). Se muestran
 * todas juntas, ordenadas por fecha, como una libreta de apuntes real —
 * sin tener que entrar a cada venta para ver qué incluía.
 */
public record LibretaEntryDTO(
        String tipo,          // "CARGO" | "ABONO"
        LocalDateTime fecha,
        String descripcion,   // nombre del producto, o "Abono a cuenta"
        String detalle,       // "3 x $45.00" para cargos; nota para abonos
        BigDecimal monto,     // siempre positivo; el tipo dice si suma o resta
        String folioTicket,   // INV-000123 (null en abonos)
        Long debtId,          // a qué nota de fiado pertenece
        String debtStatus     // PENDING | PARTIAL | PAID de esa nota
) {}