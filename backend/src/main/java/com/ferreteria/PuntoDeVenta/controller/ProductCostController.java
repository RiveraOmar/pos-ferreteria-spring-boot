package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * Costo del producto — SOLO PARA EL DUEÑO (rol ADMIN).
 *
 * Por qué existe este endpoint aparte:
 * ProductResponseDTO y ProductFullDetailsDTO NO incluyen el costo a propósito,
 * porque esos endpoints los puede llamar un vendedor (rol SELLER) y filtrarían
 * el margen de ganancia. Pero el dueño sí necesita ver el costo al editar un
 * producto. La solución no es abrir el costo a todos, sino tener una puerta
 * aparte con llave: este endpoint exige rol ADMIN.
 *
 * Así el formulario de edición precarga el costo si lo abre el dueño, y lo
 * deja vacío (sin cambiarlo al guardar) si lo abre un empleado.
 */
@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
public class ProductCostController {

    private final ProductRepository productRepository;

    @GetMapping("/{id}/costo")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> obtenerCosto(@PathVariable Long id) {
        return productRepository.findById(id)
                .map(p -> {
                    Map<String, Object> r = new HashMap<>();
                    r.put("costPrice", p.getCostPrice());
                    return ResponseEntity.ok(r);
                })
                .orElse(ResponseEntity.notFound().build());
    }
}