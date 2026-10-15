package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.dto.DailyReportDTO;
import com.ferreteria.PuntoDeVenta.service.ReportService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;
    @Operation(
            summary = "Obtener reporte contable diario",
            description ="Numero de ventas\n" +
                         "Total vendido\n" +
                         "Lo que te costó esa mercancía\n" +
                         "Ganancia real (Revenue - Cost)\n"+
                         "lista de productos mas vendidos"
    )
    @GetMapping
    public DailyReportDTO getDailyReport(
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return reportService.generateDailyReport(date.atStartOfDay());

    }

}