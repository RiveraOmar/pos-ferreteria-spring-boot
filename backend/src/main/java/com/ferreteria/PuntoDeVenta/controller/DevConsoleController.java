package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.service.DevConsoleService;
import com.ferreteria.PuntoDeVenta.service.CfdiService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  CONSOLA DE DESARROLLO — ejecuta SQL directo contra PostgreSQL
 *
 *  Equivalente en poder a pgAdmin, pensado para operar desde el navegador.
 *  Protegido en SecurityConfig: solo ROLE_ADMIN puede llegar a /api/dev/**.
 *
 *  ⚠️ Sin las validaciones de negocio del resto del sistema (no valida
 *  precios, stock, reglas fiscales, etc.) — es acceso directo a la base.
 *  Cada ejecución queda registrada en el log del backend y en la tabla
 *  dev_console_log (ver DevConsoleService) para poder auditar qué se
 *  ejecutó y cuándo.
 * ═══════════════════════════════════════════════════════════════════════════
 */
@RestController
@RequestMapping("/api/dev")
@RequiredArgsConstructor
public class DevConsoleController {

    private final DevConsoleService devConsoleService;
    private final CfdiService cfdiService;

    @Operation(summary = "Ejecutar una consulta o sentencia SQL directa")
    @PostMapping("/query")
    public ResponseEntity<?> ejecutar(@RequestBody Map<String, String> body) {
        String sql = body.get("sql");
        if (sql == null || sql.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "SQL vacío"));
        }
        try {
            return ResponseEntity.ok(devConsoleService.ejecutar(sql));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", e.getMessage() != null ? e.getMessage() : e.toString()));
        }
    }

    @Operation(summary = "Historial de consultas ejecutadas (auditoría)")
    @GetMapping("/historial")
    public ResponseEntity<?> historial() {
        return ResponseEntity.ok(devConsoleService.historial());
    }

    @Operation(summary = "Lista de tablas y sus columnas (para explorar el esquema)")
    @GetMapping("/esquema")
    public ResponseEntity<?> esquema() {
        return ResponseEntity.ok(devConsoleService.esquema());
    }

    @Operation(summary = "Ambiente FEL actual (PRODUCCION o PRUEBAS)")
    @GetMapping("/ambiente-fel")
    public ResponseEntity<?> ambienteFelActual() {
        return ResponseEntity.ok(Map.of("ambiente", cfdiService.obtenerAmbienteFel()));
    }

    @Operation(summary = "Cambiar el ambiente FEL en caliente (sin reiniciar el backend)")
    @PostMapping("/ambiente-fel")
    public ResponseEntity<?> cambiarAmbienteFel(@RequestBody Map<String, String> body) {
        try {
            String nuevo = cfdiService.cambiarAmbienteFel(body.get("ambiente"));
            return ResponseEntity.ok(Map.of("ambiente", nuevo));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of(
                    "error", e.getMessage() != null ? e.getMessage() : e.toString()));
        }
    }
}