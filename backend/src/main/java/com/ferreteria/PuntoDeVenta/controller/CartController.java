package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.dto.ProductResponseDTO;
import com.ferreteria.PuntoDeVenta.model.Product;
import com.ferreteria.PuntoDeVenta.repository.ProductRepository;
import com.ferreteria.PuntoDeVenta.service.InventoryService;
import com.ferreteria.PuntoDeVenta.Util.PriceEncoder;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;

@RestController
@RequestMapping("/api/cart")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
@Tag(name = "Carrito", description = "Operaciones de preventa y validación de stock")
public class CartController {

    private final InventoryService inventoryService;
    private final ProductRepository productRepository;

    @Operation(
            summary = "Validar y obtener producto para el carrito",
            description = "Verifica stock disponible y retorna los datos del producto procesados (incluyendo código de costo)."
    )
    @GetMapping("/add/{productId}")
    public ResponseEntity<?> addToCart(
            @PathVariable Long productId,
            @RequestParam BigDecimal quantity) {

        boolean canAdd = inventoryService.hasEnoughStock(productId, quantity);

        if (!canAdd) {
            return ResponseEntity.badRequest()
                    .body("No se puede agregar al carrito: Stock insuficiente.");
        }

        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Producto no encontrado con ID: " + productId));

        ProductResponseDTO.CategorySlimDTO categoryDTO = null;
        if (product.getCategory() != null) {
            categoryDTO = new ProductResponseDTO.CategorySlimDTO(
                    product.getCategory().getId(),
                    product.getCategory().getName()
            );
        }

        ProductResponseDTO response = new ProductResponseDTO(
                product.getId(),
                product.getSku(),
                product.getName(),
                product.getDescription(),
                product.getListPrice(),
                product.getCostPrice() != null
                        ? PriceEncoder.encode(product.getCostPrice())
                        : "0000",
                inventoryService.getStockStatus(productId)
                        .map(inv -> inv.getStockActual())
                        .orElse(BigDecimal.ZERO),
                product.getAttributes(),
                categoryDTO,
                product.isActive(),
                product.getMinStockLevel(),
                product.getBarcode(),
                product.getSatClaveProdServ(),
                product.getSatClaveUnidad(),
                product.getSatObjetoImp(),
                product.getImagenUrl(),
                inventoryService.getStockStatus(productId)
                        .map(inv -> inv.getLocationRack())
                        .orElse(null),
                product.getCompraPorBolsa(),
                product.getPiezasPorBolsa(),
                product.getPrecioBolsa()
        );

        return ResponseEntity.ok(response);
    }
}