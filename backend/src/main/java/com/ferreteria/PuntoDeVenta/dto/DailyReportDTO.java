package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.util.Map;

public record DailyReportDTO(
        Long totalSalesCount,
        BigDecimal grossRevenue,   // Total vendido
        BigDecimal totalCost,      // Lo que te costó esa mercancía
        BigDecimal netProfit,     // Ganancia real (Revenue - Cost)
        Map<String, BigDecimal> topProducts // Los más vendidos
) {}