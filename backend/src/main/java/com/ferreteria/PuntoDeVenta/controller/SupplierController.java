package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.dto.SupplierDTO;
import com.ferreteria.PuntoDeVenta.dto.SupplierProductDTO;
import com.ferreteria.PuntoDeVenta.dto.SupplierRequestDTO;
import com.ferreteria.PuntoDeVenta.service.SupplierService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/suppliers")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*",
        methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT,
                RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class SupplierController {

    private final SupplierService supplierService;

    @GetMapping
    public List<SupplierDTO> listar(
            @RequestParam(defaultValue = "true") boolean active) {
        return supplierService.listar(active);
    }

    @GetMapping("/search")
    public List<SupplierDTO> buscar(
            @RequestParam String term,
            @RequestParam(defaultValue = "true") boolean active) {
        return supplierService.buscar(term, active);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SupplierDTO> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(supplierService.obtener(id));
    }

    @PostMapping
    public ResponseEntity<SupplierDTO> crear(@Valid @RequestBody SupplierRequestDTO req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(supplierService.crear(req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<SupplierDTO> actualizar(
            @PathVariable Long id, @Valid @RequestBody SupplierRequestDTO req) {
        return ResponseEntity.ok(supplierService.actualizar(id, req));
    }

    @PatchMapping("/{id}/active")
    public ResponseEntity<Void> cambiarEstado(
            @PathVariable Long id, @RequestBody Map<String, Boolean> body) {
        supplierService.cambiarEstado(id, body.getOrDefault("active", true));
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/products")
    public List<SupplierProductDTO> productosDelProveedor(@PathVariable Long id) {
        return supplierService.productosDelProveedor(id);
    }

    @RequestMapping(value = "/**", method = RequestMethod.OPTIONS)
    public ResponseEntity<?> options() {
        return ResponseEntity.ok().build();
    }
}