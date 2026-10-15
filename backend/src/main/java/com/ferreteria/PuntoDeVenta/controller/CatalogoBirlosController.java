package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.model.CatalogoBirlo;
import com.ferreteria.PuntoDeVenta.model.CatalogoBirloAplicacion;
import com.ferreteria.PuntoDeVenta.repository.CatalogoBirloAplicacionRepository;
import com.ferreteria.PuntoDeVenta.repository.CatalogoBirloRepository;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

/**
 * ═══════════════════════════════════════════════════════════════════════
 *  CATÁLOGO DE BIRLOS — Internacionales León
 *  Tres formas de buscar, igual que en el mostrador:
 *    1. Por VEHÍCULO  (marca + modelo)   → qué birlo lleva
 *    2. Por MEDIDA    (Ø estría mm/pulg) → qué códigos coinciden
 *    3. Por CÓDIGO    (BRxx-xxx)         → especificación + aplicaciones
 * ═══════════════════════════════════════════════════════════════════════
 */
@RestController
@RequestMapping("/api/catalogo-birlos")
@RequiredArgsConstructor
public class CatalogoBirlosController {

    private final CatalogoBirloRepository birloRepo;
    private final CatalogoBirloAplicacionRepository appRepo;

    @Operation(summary = "Marcas disponibles en el catálogo")
    @GetMapping("/marcas")
    public List<String> marcas() {
        return appRepo.marcas();
    }

    @Operation(summary = "Buscar por vehículo (marca opcional + texto del modelo)")
    @GetMapping("/aplicaciones")
    public List<Map<String, Object>> aplicaciones(
            @RequestParam(required = false) String marca,
            @RequestParam(required = false, defaultValue = "") String q) {

        List<CatalogoBirloAplicacion> apps =
                (marca == null || marca.isBlank())
                        ? appRepo.findByAplicacionContainingIgnoreCaseOrderByMarcaAscAplicacionAsc(q)
                        : appRepo.findByMarcaIgnoreCaseAndAplicacionContainingIgnoreCaseOrderByAplicacion(
                        marca, q);

        // Adjuntar la especificación de cada código en UNA sola consulta
        List<String> codigos = apps.stream()
                .map(CatalogoBirloAplicacion::getCodigo).distinct().toList();
        Map<String, CatalogoBirlo> specs = birloRepo.findByCodigoIn(codigos)
                .stream().collect(Collectors.toMap(CatalogoBirlo::getCodigo, b -> b));

        return apps.stream().map(a -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("marca",      a.getMarca());
            m.put("aplicacion", a.getAplicacion());
            m.put("delantero",  a.getDelantero());
            m.put("trasero",    a.getTrasero());
            m.put("anio",       a.getAnio());
            m.put("codigo",     a.getCodigo());
            m.put("tuercas",    a.getTuercas());
            m.put("pagina",     a.getPagina());
            CatalogoBirlo s = specs.get(a.getCodigo());
            if (s != null) {
                m.put("medida",     s.getMedida());
                m.put("rosca",      s.getRosca());
                m.put("largo",      s.getLargo());
                m.put("estriaMm",   s.getEstriaMm());
                m.put("estriaPulg", s.getEstriaPulg());
                m.put("tipo",       s.getTipo());
            }
            return m;
        }).toList();
    }

    @Operation(summary = "Buscar por Ø de estría (mm) con tolerancia, y/o por rosca")
    @GetMapping("/por-medida")
    public List<Map<String, Object>> porMedida(
            @RequestParam(required = false) BigDecimal estriaMm,
            @RequestParam(required = false, defaultValue = "0.40") BigDecimal toleranciaMm,
            @RequestParam(required = false) String rosca) {

        List<CatalogoBirlo> base;
        if (estriaMm != null) {
            base = birloRepo.findByEstriaMmEntre(
                    estriaMm.subtract(toleranciaMm), estriaMm.add(toleranciaMm));
        } else if (rosca != null && !rosca.isBlank()) {
            base = birloRepo.findByRoscaContainingIgnoreCaseOrderByEstriaMm(rosca);
        } else {
            return List.of();
        }
        if (estriaMm != null && rosca != null && !rosca.isBlank()) {
            String r = rosca.toLowerCase();
            base = base.stream()
                    .filter(b -> b.getRosca() != null
                            && b.getRosca().toLowerCase().contains(r))
                    .toList();
        }
        final BigDecimal buscado = estriaMm;
        return base.stream().map(b -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("codigo",     b.getCodigo());
            m.put("tipo",       b.getTipo());
            m.put("lado",       b.getLado());
            m.put("estriaMm",   b.getEstriaMm());
            m.put("estriaPulg", b.getEstriaPulg());
            m.put("rosca",      b.getRosca());
            m.put("largo",      b.getLargo());
            m.put("medida",     b.getMedida());
            m.put("pagina",     b.getPaginaCatalogo());
            if (buscado != null)
                m.put("desviacionMm",
                        b.getEstriaMm().subtract(buscado).abs());
            return m;
        }).toList();
    }

    @Operation(summary = "Ficha de un código: especificación + todas sus aplicaciones")
    @GetMapping("/codigo/{codigo}")
    public ResponseEntity<?> porCodigo(@PathVariable String codigo) {
        String cod = codigo.trim().toUpperCase();
        Map<String, Object> out = new LinkedHashMap<>();
        birloRepo.findById(cod).ifPresent(b -> out.put("especificacion", b));
        List<CatalogoBirloAplicacion> apps =
                appRepo.findByCodigoOrderByMarcaAscAplicacionAsc(cod);
        out.put("aplicaciones", apps);
        if (out.get("especificacion") == null && apps.isEmpty())
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "Código no encontrado: " + cod));
        return ResponseEntity.ok(out);
    }
}