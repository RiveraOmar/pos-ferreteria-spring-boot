package com.ferreteria.PuntoDeVenta.controller;

import jakarta.validation.Valid;
import com.ferreteria.PuntoDeVenta.dto.SaleRequestDTO;
import com.ferreteria.PuntoDeVenta.dto.SaleResponseDTO;
import com.ferreteria.PuntoDeVenta.service.SaleService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/sales")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SaleController {

    private final SaleService saleService;

    @Operation(summary = "Procesar venta")
    @PostMapping
    public ResponseEntity<SaleResponseDTO> checkout(
            @Valid @RequestBody SaleRequestDTO request) {
        return ResponseEntity.ok(saleService.processFullSale(request));
    }

    @Operation(summary = "Cancelar venta y regresar stock")
    @PostMapping("/{id}/cancel")
    public ResponseEntity<SaleResponseDTO> cancel(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(
                saleService.cancelSale(id, body.getOrDefault("reason", "Sin motivo")));
    }

    @Operation(summary = "Últimas 50 ventas")
    @GetMapping("/recent")
    public ResponseEntity<List<SaleResponseDTO>> recent() {
        return ResponseEntity.ok(saleService.getRecentSales(50));
    }


    @Operation(summary = "Obtener varias ventas por IDs")
    @GetMapping("/by-ids")
    public ResponseEntity<List<SaleResponseDTO>> getByIds(
            @RequestParam List<Long> ids) {
        return ResponseEntity.ok(saleService.getSalesByIds(ids));
    }

    @Operation(summary = "Búsqueda avanzada de ventas con filtros")
    @GetMapping("/search")
    public ResponseEntity<List<SaleResponseDTO>> search(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime inicio,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fin,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String texto) {
        return ResponseEntity.ok(
                saleService.buscarConFiltros(inicio, fin, status, texto));
    }

    /**
     * Ventas DEL PERIODO pendientes de factura global. El periodo es
     * autodescriptivo — trae su propia periodicidad — formato "LETRA:FECHA":
     *   D:2026-08-29  → un día              S:2026-08-24  → una semana
     *   Q:2026-08-16  → una quincena        M:2026-08-01  → un mes
     * Si no se manda, se usa el periodo ACTUAL según la periodicidad que
     * el dueño tenga configurada (Facturación → Configurar periodicidad).
     */
    @Operation(summary = "Ventas del periodo para factura global (periodicidad configurable)")
    @GetMapping("/publico-general/periodo")
    public ResponseEntity<Map<String, Object>> ventasPublicoGeneralPeriodo(
            @RequestParam(required = false) String periodo) {
        return ResponseEntity.ok(
                saleService.getVentasPublicoGeneralPeriodo(parsePeriodo(periodo)));
    }

    @Operation(summary = "Alias — periodo actual según la periodicidad configurada")
    @GetMapping("/publico-general/hoy")
    public ResponseEntity<Map<String, Object>> ventasPublicoGeneralHoy() {
        return ResponseEntity.ok(saleService.getVentasPublicoGeneralHoy());
    }

    /** Descarta una venta del flujo de factura global (deja de ser pendiente). */
    @PatchMapping("/{id}/descartar-global")
    public ResponseEntity<?> descartarDeGlobal(@PathVariable Long id) {
        saleService.descartarDeGlobal(id);
        return ResponseEntity.ok(Map.of("descartada", id));
    }

    /** Descarta TODAS las pendientes de PERIODOS ANTERIORES al indicado. */
    @PatchMapping("/descartar-global-anteriores")
    public ResponseEntity<?> descartarAnteriores(
            @RequestParam(required = false) String periodo) {
        int n = saleService.descartarAntiguasDeGlobal(parsePeriodo(periodo));
        return ResponseEntity.ok(Map.of("descartadas", n));
    }

    /** "Q:2026-08-16" (o vacío) → PeriodoFiscal según la config actual si falta. */
    private com.ferreteria.PuntoDeVenta.util.PeriodoFiscal parsePeriodo(String periodo) {
        if (periodo == null || periodo.isBlank())
            return saleService.periodoActualConfigurado();
        return com.ferreteria.PuntoDeVenta.util.PeriodoFiscal.parse(periodo);
    }

    @Operation(summary = "Marcar ventas como incluidas en factura global ya generada")
    @PostMapping("/publico-general/marcar-facturado")
    public ResponseEntity<Map<String, Object>> marcarFacturaGlobal(
            @RequestBody Map<String, List<Long>> body) {
        List<Long> saleIds = body.getOrDefault("saleIds", List.of());
        return ResponseEntity.ok(saleService.marcarFacturaGlobal(saleIds));
    }

}