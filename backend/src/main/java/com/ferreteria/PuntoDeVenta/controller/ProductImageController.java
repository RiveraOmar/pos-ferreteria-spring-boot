package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.model.ProductImage;
import com.ferreteria.PuntoDeVenta.service.ProductImageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Galería de fotos de un producto.
 *   GET    /api/products/{id}/imagenes            → lista (principal primero)
 *   POST   /api/products/{id}/imagenes            → agrega { url, titulo }
 *   DELETE /api/products/{id}/imagenes/{imgId}    → borra (también el archivo)
 *   PATCH  /api/products/{id}/imagenes/{imgId}/principal → la vuelve principal
 */
@RestController
@RequestMapping("/api/products/{productId}/imagenes")
@RequiredArgsConstructor
public class ProductImageController {

    private final ProductImageService service;

    public record NuevaImagenDTO(String url, String titulo) {}

    @GetMapping
    public ResponseEntity<List<ProductImage>> listar(@PathVariable Long productId) {
        return ResponseEntity.ok(service.listar(productId));
    }

    @PostMapping
    public ResponseEntity<?> agregar(@PathVariable Long productId,
                                     @RequestBody NuevaImagenDTO req) {
        if (req.url() == null || req.url().isBlank())
            return ResponseEntity.badRequest().body(Map.of("error", "Falta la URL de la imagen"));
        try {
            return ResponseEntity.ok(service.agregar(productId, req.url().trim(), req.titulo()));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/{imageId}")
    public ResponseEntity<?> eliminar(@PathVariable Long productId,
                                      @PathVariable Long imageId) {
        try {
            service.eliminar(productId, imageId);
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    public record TituloDTO(String titulo) {}

    @PatchMapping("/{imageId}/titulo")
    public ResponseEntity<?> renombrar(@PathVariable Long productId,
                                       @PathVariable Long imageId,
                                       @RequestBody TituloDTO req) {
        try {
            service.renombrar(productId, imageId, req.titulo());
            return ResponseEntity.ok(Map.of("ok", true));
        } catch (IllegalStateException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PatchMapping("/{imageId}/principal")
    public ResponseEntity<?> marcarPrincipal(@PathVariable Long productId,
                                             @PathVariable Long imageId) {
        service.marcarPrincipal(productId, imageId);
        return ResponseEntity.ok(Map.of("ok", true));
    }
}