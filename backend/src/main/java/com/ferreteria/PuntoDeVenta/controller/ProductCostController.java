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