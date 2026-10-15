package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.dto.InventoryAdjustmentDTO;
import com.ferreteria.PuntoDeVenta.dto.InventoryRequestDTO;
import com.ferreteria.PuntoDeVenta.dto.StockMasivoDTO;
import com.ferreteria.PuntoDeVenta.service.InventoryService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/inventory")
@RequiredArgsConstructor
public class InventoryController {

    private final InventoryService inventoryService;

    @Operation(
            summary = "Restock",
            description = "Permite agregar cantidad a un producto en el inventario"
    )
    @PostMapping("/{productId}")
    public ResponseEntity<Map<String, String>> restock(
            @PathVariable Long productId,
            @RequestBody InventoryRequestDTO request) {

        inventoryService.addStock(productId, request);
        return ResponseEntity.ok(Map.of("message", "Inventario actualizado correctamente"));
    }

    @Operation(summary = "Consultar stock de un producto")
    @GetMapping("/{productId}")
    public ResponseEntity<?> getStock(@PathVariable Long productId) {
        return inventoryService.getStockStatus(productId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @Operation(
            summary = "Ajustar stock",
            description = "Corrige el stock a la cantidad REAL contada. Sirve para "
                    + "bajar y para subir. Queda registrado el motivo y quien lo hizo."
    )
    @PostMapping("/{productId}/ajuste")
    public ResponseEntity<Map<String, String>> ajustar(
            @PathVariable Long productId,
            @RequestBody InventoryAdjustmentDTO request) {

        var ajuste = inventoryService.adjustStock(productId, request);
        return ResponseEntity.ok(Map.of(
                "message",    "Inventario ajustado",
                "antes",      String.valueOf(ajuste.getCantidadAntes()),
                "despues",    String.valueOf(ajuste.getCantidadDespues()),
                "diferencia", String.valueOf(ajuste.getDiferencia())
        ));
    }

    @Operation(summary = "Historial de ajustes de un producto")
    @GetMapping("/{productId}/ajustes")
    public ResponseEntity<?> historial(@PathVariable Long productId) {
        return ResponseEntity.ok(inventoryService.historialAjustes(productId));
    }

    @Operation(
            summary = "Cargar existencias a TODO el catálogo",
            description = "Deja todos los productos con la misma cantidad de "
                    + "piezas (ej. 100) y da de alta el renglón de inventario "
                    + "a los que no lo tenían. Con soloEnCero=true (default) "
                    + "respeta los productos que ya traen existencias. Cada "
                    + "cambio queda en la bitácora de ajustes."
    )
    @PostMapping("/stock-masivo")
    public ResponseEntity<?> stockMasivo(@RequestBody StockMasivoDTO request) {
        try {
            return ResponseEntity.ok(
                    inventoryService.establecerStockMasivo(request));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest()
                    .body(java.util.Map.of("error", e.getMessage()));
        }
    }
}