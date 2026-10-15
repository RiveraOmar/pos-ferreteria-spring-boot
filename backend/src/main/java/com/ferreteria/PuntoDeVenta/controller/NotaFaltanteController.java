package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.model.NotaFaltante;
import com.ferreteria.PuntoDeVenta.service.NotaFaltanteService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Libreta de apuntes de Faltantes: notas de texto libre para cosas que
 * hacen falta pero no están dadas de alta como producto en el sistema.
 */
@RestController
@RequestMapping("/api/notas-faltantes")
@RequiredArgsConstructor
public class NotaFaltanteController {

    private final NotaFaltanteService service;

    @Operation(summary = "Listar todas las notas, más nueva primero")
    @GetMapping
    public List<NotaFaltante> listar() {
        return service.listar();
    }

    @Operation(summary = "Agregar una nota a la libreta")
    @PostMapping
    public ResponseEntity<?> crear(@RequestBody Map<String, String> body) {
        try {
            return ResponseEntity.ok(service.crear(body.get("texto"), body.get("autor")));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Marcar una nota como resuelta o pendiente")
    @PatchMapping("/{id}/resuelta")
    public ResponseEntity<?> marcarResuelta(@PathVariable Long id,
                                             @RequestBody Map<String, Boolean> body) {
        try {
            boolean resuelta = Boolean.TRUE.equals(body.get("resuelta"));
            return ResponseEntity.ok(service.marcarResuelta(id, resuelta));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", e.getMessage() != null ? e.getMessage() : e.toString()));
        }
    }

    @Operation(summary = "Borrar una nota de la libreta")
    @DeleteMapping("/{id}")
    public ResponseEntity<?> eliminar(@PathVariable Long id) {
        try {
            service.eliminar(id);
            return ResponseEntity.ok(Map.of("eliminada", id));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", e.getMessage() != null ? e.getMessage() : e.toString()));
        }
    }
}