package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.dto.CategoryDTO;
import com.ferreteria.PuntoDeVenta.model.Category;
import com.ferreteria.PuntoDeVenta.service.CategoryService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService categoryService;

    @Operation(summary = "Obtener categorías raíz")
    @GetMapping
    public ResponseEntity<List<CategoryDTO>> getRootCategories() {
        return ResponseEntity.ok(categoryService.getRootCategories());
    }

    @Operation(summary = "Obtener categorías hijas")
    @GetMapping("/{id}")
    public ResponseEntity<List<CategoryDTO>> getChildrenCategories(@PathVariable Long id) {
        return ResponseEntity.ok(categoryService.getChildren(id));
    }

    @Operation(summary = "Búsqueda por filtro (ID o Nombre)")
    @GetMapping("/search")
    public ResponseEntity<?> searchCategories(
            @RequestParam(required = false) Long id,
            @RequestParam(required = false) String name) {
        if (id != null) {
            return ResponseEntity.ok(List.of(categoryService.findById(id)));
        }
        if (name != null) {
            return ResponseEntity.ok(categoryService.searchByName(name));
        }
        return ResponseEntity.badRequest().body("Debe proporcionar un ID o un nombre.");
    }

    @Operation(summary = "Alta de Categoría raíz")
    @PostMapping
    public ResponseEntity<Category> createCategory(@RequestBody Category category) {
        return new ResponseEntity<>(categoryService.saveCategory(category), HttpStatus.CREATED);
    }

    @Operation(summary = "Alta de Subcategoría")
    @PostMapping("/{parentId}")
    public ResponseEntity<Category> createChildrenCategory(
            @PathVariable Long parentId,
            @RequestBody Category subcategory) {
        return new ResponseEntity<>(categoryService.saveSubcategory(parentId, subcategory), HttpStatus.CREATED);
    }

    @Operation(summary = "Cambiar estado (Activar/Desactivar)")
    @PutMapping("/{id}/status")
    public ResponseEntity<Void> changeStatus(@PathVariable Long id, @RequestParam boolean active) {
        categoryService.updateStatus(id, active);
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Obtener todas las categorías activas (lista plana)")
    @GetMapping("/all")
    public ResponseEntity<List<CategoryDTO>> getAllCategories() {
        return ResponseEntity.ok(categoryService.getAllActive());
    }
}