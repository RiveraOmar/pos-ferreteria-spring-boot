package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.dto.PrefacturaDTO;
import com.ferreteria.PuntoDeVenta.dto.PrefacturaRequestDTO;
import com.ferreteria.PuntoDeVenta.service.PrefacturaService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/prefacturas")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*",
        methods = {RequestMethod.GET, RequestMethod.POST,
                RequestMethod.PUT, RequestMethod.PATCH,
                RequestMethod.DELETE, RequestMethod.OPTIONS})
public class PrefacturaController {

    private final PrefacturaService prefacturaService;

    @Operation(summary = "Listar todas las prefacturas activas")
    @GetMapping
    public List<PrefacturaDTO> listarActivas() {
        return prefacturaService.listarActivas();
    }

    @Operation(summary = "Listar prefacturas de un cliente")
    @GetMapping("/customer/{customerId}")
    public List<PrefacturaDTO> porCliente(@PathVariable Long customerId) {
        return prefacturaService.listarPorCliente(customerId);
    }

    @Operation(summary = "Obtener una prefactura por ID")
    @GetMapping("/{id}")
    public PrefacturaDTO obtener(@PathVariable Long id) {
        return prefacturaService.obtener(id);
    }

    @Operation(summary = "Crear nueva prefactura")
    @PostMapping
    public ResponseEntity<PrefacturaDTO> crear(@RequestBody PrefacturaRequestDTO req) {
        return ResponseEntity.ok(prefacturaService.crear(req));
    }

    @Operation(summary = "Actualizar prefactura")
    @PutMapping("/{id}")
    public ResponseEntity<PrefacturaDTO> actualizar(
            @PathVariable Long id,
            @RequestBody PrefacturaRequestDTO req) {
        return ResponseEntity.ok(prefacturaService.actualizar(id, req));
    }

    @Operation(summary = "Cambiar estado de prefactura")
    @PatchMapping("/{id}/status")
    public ResponseEntity<PrefacturaDTO> cambiarEstado(
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(prefacturaService.cambiarEstado(id, body.get("status")));
    }

    @RequestMapping(value = "/**", method = RequestMethod.OPTIONS)
    public ResponseEntity<?> options() {
        return ResponseEntity.ok().build();
    }
}