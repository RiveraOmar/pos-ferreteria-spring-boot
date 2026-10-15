package com.ferreteria.PuntoDeVenta.dto;

import java.math.BigDecimal;
import java.util.Map;

public record DailyReportDTO(
        Long totalSalesCount,
        BigDecimal grossRevenue,  
        BigDecimal totalCost,    
        BigDecimal netProfit,    
        Map<String, BigDecimal> topProducts 
) {}