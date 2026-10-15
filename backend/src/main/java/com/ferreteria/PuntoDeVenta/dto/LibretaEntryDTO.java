package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record LibretaEntryDTO(
        String tipo,          
        LocalDateTime fecha,
        String descripcion,   
        String detalle,       
        BigDecimal monto,     
        String folioTicket,   
        Long debtId,          
        String debtStatus     
) {}