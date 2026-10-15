package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.model.ConfiguracionFacturacion;
import com.ferreteria.PuntoDeVenta.model.Periodicidad;
import com.ferreteria.PuntoDeVenta.service.ConfiguracionFacturacionService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/configuracion/facturacion")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class ConfiguracionFacturacionController {

    private final ConfiguracionFacturacionService service;

    @Operation(summary = "Periodicidad actual de la factura global")
    @GetMapping
    public ResponseEntity<Map<String, Object>> obtener() {
        ConfiguracionFacturacion c = service.obtener();
        return ResponseEntity.ok(aMapa(c));
    }

    @Operation(summary = "Catálogo de periodicidades disponibles (para el selector del front)")
    @GetMapping("/opciones")
    public ResponseEntity<?> opciones() {
        return ResponseEntity.ok(java.util.Arrays.stream(Periodicidad.values())
                .map(p -> {
                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("valor",       p.name());
                    m.put("nombre",      p.getNombre());
                    m.put("descripcion", p.getDescripcion());
                    m.put("codigoSat",   p.getCodigoSat());
                    return m;
                }).toList());
    }

    @Operation(summary = "Cambiar la periodicidad de la factura global — solo ADMIN")
    @PutMapping
    public ResponseEntity<?> actualizar(
            @RequestBody Map<String, Object> body, Authentication auth) {
        try {
            Object periodicidadRaw = body.get("periodicidad");
            Periodicidad nueva = null;
            if (periodicidadRaw != null && !periodicidadRaw.toString().isBlank())
                nueva = Periodicidad.valueOf(periodicidadRaw.toString().trim().toUpperCase());

            Boolean autoHabilitado = null;
            Object autoRaw = body.get("autoTimbradoHabilitado");
            if (autoRaw instanceof Boolean b) autoHabilitado = b;

            String usuario = (auth != null) ? auth.getName() : "desconocido";
            ConfiguracionFacturacion c = service.actualizar(nueva, autoHabilitado, usuario);

            Map<String, Object> r = aMapa(c);
            r.put("mensaje", "Periodicidad actualizada a " + c.getPeriodicidad().getNombre()
                    + ". Los cambios aplican de inmediato.");
            return ResponseEntity.ok(r);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("error",
                    "Periodicidad inválida. Usa: DIARIA, SEMANAL, QUINCENAL o MENSUAL."));
        }
    }

    private Map<String, Object> aMapa(ConfiguracionFacturacion c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("periodicidad",             c.getPeriodicidad().name());
        m.put("periodicidadNombre",       c.getPeriodicidad().getNombre());
        m.put("periodicidadDescripcion",  c.getPeriodicidad().getDescripcion());
        m.put("periodicidadLetra",        c.getPeriodicidad().getLetra());
        m.put("codigoSat",                c.getPeriodicidad().getCodigoSat());
        m.put("autoTimbradoHabilitado",   c.isAutoTimbradoHabilitado());
        m.put("actualizadoEn",  c.getActualizadoEn() != null ? c.getActualizadoEn().toString() : null);
        m.put("actualizadoPor", c.getActualizadoPor());
        return m;
    }
}
