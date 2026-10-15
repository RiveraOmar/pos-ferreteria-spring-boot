package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.dto.EstadoMasivoDTO;
import com.ferreteria.PuntoDeVenta.dto.ProductFullDetailsDTO;
import com.ferreteria.PuntoDeVenta.dto.ProductResponseDTO;
import com.ferreteria.PuntoDeVenta.model.Product;
import com.ferreteria.PuntoDeVenta.service.ProductService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.Operation;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/products")
@RequiredArgsConstructor
@CrossOrigin(origins = "*") // Ajustar según seguridad
public class ProductController {

    private final ProductService productService;

    // incluirInactivos: por defecto NO. Ventas, Faltantes y el buscador del
    // mostrador reciben solo lo que de verdad manejas. El módulo de Productos
    // lo pide en true para poder ver el catálogo dormido y activarlo.
    @GetMapping
    public List<ProductResponseDTO> getAll(
            @RequestParam(defaultValue = "false") boolean incluirInactivos) {
        return productService.getAll(incluirInactivos);
    }

    @GetMapping("/search")
    public List<ProductResponseDTO> search(
            @RequestParam String q,
            @RequestParam(defaultValue = "false") boolean incluirInactivos) {
        return productService.searchProducts(q, incluirInactivos);
    }

    @Operation(
            summary = "Borrar un producto DEFINITIVAMENTE",
            description = "Solo si esta desactivado y nunca se vendio. No hay deshacer."
    )
    @DeleteMapping("/{id}/permanente")
    public ResponseEntity<Void> borrarPermanente(@PathVariable Long id) {
        productService.borrarPermanente(id);
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Activar o desactivar varios productos de un jalon")
    @PatchMapping("/estado-masivo")
    public ResponseEntity<Map<String, Object>> cambiarEstadoMasivo(
            @RequestBody EstadoMasivoDTO request) {
        int n = productService.cambiarEstadoMasivo(request.ids(), request.activo());
        return ResponseEntity.ok(Map.of("actualizados", n, "activo", request.activo()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductResponseDTO> getById(@PathVariable Long id) {
        return ResponseEntity.ok(productService.getById(id));
    }

    // Ficha completa de solo lectura: atributos, SAT, historial de precio
    // y proveedores que surten el producto, todo en una sola llamada.
    @GetMapping("/{id}/full-details")
    public ResponseEntity<ProductFullDetailsDTO> getFullDetails(@PathVariable Long id) {
        return ResponseEntity.ok(productService.getFullDetails(id));
    }

    @PostMapping
    public ResponseEntity<ProductResponseDTO> create(@RequestBody Product product) {
        Product saved = productService.saveFullProduct(product);
        return ResponseEntity.status(HttpStatus.CREATED).body(productService.convertToDTO(saved));
    }

    // ── Sugerencia de compra: stock bajo agrupado por proveedor ──────────
    @GetMapping("/sugerencia-compra")
    public ResponseEntity<?> sugerenciaCompra() {
        return ResponseEntity.ok(productService.sugerenciaCompra());
    }

    // Catálogo de UN proveedor con recomendación (para armar su pedido)
    @GetMapping("/sugerencia-compra/proveedor/{supplierId}")
    public ResponseEntity<?> sugerenciaPorProveedor(@PathVariable Long supplierId) {
        return ResponseEntity.ok(productService.catalogoProveedorParaCompra(supplierId));
    }

    // ── Proveedores que surten este producto ─────────────────────────────
    @GetMapping("/{id}/suppliers")
    public ResponseEntity<?> proveedoresDelProducto(@PathVariable Long id) {
        return ResponseEntity.ok(productService.proveedoresDeProducto(id));
    }

    @PutMapping("/{id}/suppliers")
    public ResponseEntity<?> asignarProveedores(
            @PathVariable Long id, @RequestBody java.util.List<Long> supplierIds) {
        return ResponseEntity.ok(productService.asignarProveedores(id, supplierIds));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductResponseDTO> update(@PathVariable Long id, @RequestBody Product product) {
        Product updated = productService.updateProduct(id, product);
        return ResponseEntity.ok(productService.convertToDTO(updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        productService.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/category/{categoryId}")
    public List<ProductResponseDTO> getByCategory(@PathVariable Long categoryId) {
        return productService.getProductsByCategoryRecursive(categoryId);
    }
}