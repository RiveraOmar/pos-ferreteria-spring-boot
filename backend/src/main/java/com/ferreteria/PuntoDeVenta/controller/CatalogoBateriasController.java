package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.model.CatalogoBaterias;
import com.ferreteria.PuntoDeVenta.repository.CatalogoBateriasRepository;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/catalogo-baterias")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CatalogoBateriasController {

    private final CatalogoBateriasRepository repo;

    @Operation(summary = "Lista de marcas de vehículos")
    @GetMapping("/marcas")
    public ResponseEntity<List<String>> getMarcas() {
        return ResponseEntity.ok(repo.findDistinctMarcas());
    }

    @Operation(summary = "Modelos filtrados por marca")
    @GetMapping("/modelos")
    public ResponseEntity<List<String>> getModelos(@RequestParam String marca) {
        return ResponseEntity.ok(repo.findDistinctModelosByMarca(marca));
    }

    @Operation(summary = "Rangos de años filtrados por marca y modelo")
    @GetMapping("/anios")
    public ResponseEntity<List<String>> getAnios(
            @RequestParam String marca,
            @RequestParam String modelo) {
        return ResponseEntity.ok(repo.findAniosByMarcaAndModelo(marca, modelo));
    }

    @Operation(summary = "Buscar batería por vehículo exacto")
    @GetMapping("/buscar")
    public ResponseEntity<List<CatalogoBaterias>> buscarPorVehiculo(
            @RequestParam String marca,
            @RequestParam String modelo,
            @RequestParam String anioRango) {
        return ResponseEntity.ok(repo.findByVehiculoCompleto(marca, modelo, anioRango));
    }

    @Operation(summary = "Búsqueda dinámica de baterías por texto libre")
    @GetMapping("/buscar/dinamico")
    public ResponseEntity<List<CatalogoBaterias>> buscarDinamico(@RequestParam String q) {
        if (q == null || q.trim().length() < 2) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(repo.findByTextoLibre(q.trim()));
    }
    @Operation(summary = "Agregar entrada al catálogo de baterías")
    @PostMapping
    public ResponseEntity<CatalogoBaterias> crear(@RequestBody CatalogoBaterias bateria) {
        return ResponseEntity.ok(repo.save(bateria));
    }

    @Operation(summary = "Eliminar entrada del catálogo")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Estadísticas del catálogo de baterías")
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(Map.of(
                "totalRegistros", repo.count()
        ));
    }
}