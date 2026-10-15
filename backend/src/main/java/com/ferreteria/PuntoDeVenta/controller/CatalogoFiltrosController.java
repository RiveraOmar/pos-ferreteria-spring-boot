package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.model.CatalogoFiltros;
import com.ferreteria.PuntoDeVenta.repository.CatalogoFiltrosRepository;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/catalogo-filtros")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class CatalogoFiltrosController {

    private final CatalogoFiltrosRepository repo;

    // ── Selects en cascada ────────────────────────────────────────────────────

    @Operation(summary = "Lista de tipos de vehículo")
    @GetMapping("/tipos")
    public ResponseEntity<List<String>> getTipos() {
        return ResponseEntity.ok(repo.findDistinctTipos());
    }

    @Operation(summary = "Marcas filtradas por tipo")
    @GetMapping("/marcas")
    public ResponseEntity<List<String>> getMarcas(@RequestParam String tipo) {
        return ResponseEntity.ok(repo.findDistinctMarcasByTipo(tipo));
    }

    @Operation(summary = "Años filtrados por tipo y marca")
    @GetMapping("/anios")
    public ResponseEntity<List<Integer>> getAnios(
            @RequestParam String tipo,
            @RequestParam String marca) {
        return ResponseEntity.ok(repo.findDistinctAniosByTipoAndMarca(tipo, marca));
    }

    @Operation(summary = "Modelos filtrados por tipo, marca y año")
    @GetMapping("/modelos")
    public ResponseEntity<List<String>> getModelos(
            @RequestParam String tipo,
            @RequestParam String marca,
            @RequestParam Integer anio) {
        return ResponseEntity.ok(repo.findDistinctModelosByTipoMarcaAnio(tipo, marca, anio));
    }

    @Operation(summary = "Motores filtrados por tipo, marca, modelo y año")
    @GetMapping("/motores")
    public ResponseEntity<List<String>> getMotores(
            @RequestParam String tipo,
            @RequestParam String marca,
            @RequestParam String modelo,
            @RequestParam Integer anio) {
        return ResponseEntity.ok(
                repo.findDistinctMotoresByTipoMarcaModeloAnio(tipo, marca, modelo, anio));
    }

    // ── Búsquedas ─────────────────────────────────────────────────────────────

    @Operation(summary = "Buscar por vehículo completo")
    @GetMapping("/buscar")
    public ResponseEntity<List<CatalogoFiltros>> buscarPorVehiculo(
            @RequestParam String tipo,
            @RequestParam String marca,
            @RequestParam String modelo,
            @RequestParam Integer anio,
            @RequestParam String motor) {
        return ResponseEntity.ok(repo.findByVehiculo(tipo, marca, modelo, anio, motor));
    }

    @Operation(summary = "Búsqueda dinámica por texto libre")
    @GetMapping("/buscar/dinamico")
    public ResponseEntity<List<CatalogoFiltros>> buscarDinamico(
            @RequestParam String q) {
        if (q == null || q.trim().length() < 2) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(repo.findByTextoLibre(q.trim()));
    }

    @Operation(summary = "Búsqueda por parte de competidor (equivalencias)")
    @GetMapping("/buscar/equivalente")
    public ResponseEntity<List<CatalogoFiltros>> buscarEquivalente(
            @RequestParam String parte) {
        if (parte == null || parte.trim().length() < 2) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(repo.findByEquivalente(parte.trim()));
    }

    // ── CRUD admin ────────────────────────────────────────────────────────────

    @Operation(summary = "Agregar entrada al catálogo")
    @PostMapping
    public ResponseEntity<CatalogoFiltros> crear(@RequestBody CatalogoFiltros filtro) {
        return ResponseEntity.ok(repo.save(filtro));
    }

    @Operation(summary = "Editar entrada del catálogo")
    @PutMapping("/{id}")
    public ResponseEntity<CatalogoFiltros> editar(
            @PathVariable Long id, @RequestBody CatalogoFiltros filtro) {
        filtro.setId(id);
        return ResponseEntity.ok(repo.save(filtro));
    }

    @Operation(summary = "Eliminar entrada del catálogo")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        repo.deleteById(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Estadísticas del catálogo")
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> stats() {
        return ResponseEntity.ok(Map.of(
                "totalRegistros", repo.count(),
                "totalMarcas",    repo.findDistinctTipos().size()
        ));
    }
}