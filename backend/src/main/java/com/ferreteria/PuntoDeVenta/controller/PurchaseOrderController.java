package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.dto.PurchaseOrderDTO;
import com.ferreteria.PuntoDeVenta.dto.PurchaseOrderRequestDTO;
import com.ferreteria.PuntoDeVenta.service.PurchaseOrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/purchase-orders")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*",
        methods = {RequestMethod.GET, RequestMethod.POST, RequestMethod.PUT,
                RequestMethod.PATCH, RequestMethod.DELETE, RequestMethod.OPTIONS})
public class PurchaseOrderController {

    private final PurchaseOrderService purchaseOrderService;

    @GetMapping("/recent")
    public List<PurchaseOrderDTO> recientes() {
        return purchaseOrderService.listarRecientes();
    }

    @GetMapping("/supplier/{supplierId}")
    public List<PurchaseOrderDTO> porProveedor(@PathVariable Long supplierId) {
        return purchaseOrderService.porProveedor(supplierId);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PurchaseOrderDTO> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(purchaseOrderService.obtener(id));
    }

    @GetMapping("/search")
    public List<PurchaseOrderDTO> buscar(
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime inicio,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime fin,
            @RequestParam(required = false) String status) {
        return purchaseOrderService.buscarConFiltros(inicio, fin, status);
    }

    @PostMapping
    public ResponseEntity<PurchaseOrderDTO> registrar(
            @Valid @RequestBody PurchaseOrderRequestDTO req) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(purchaseOrderService.registrar(req));
    }

    @PatchMapping("/{id}/cancel")
    public ResponseEntity<PurchaseOrderDTO> cancelar(
            @PathVariable Long id, @RequestBody Map<String, String> body) {
        return ResponseEntity.ok(
                purchaseOrderService.cancelar(id, body.get("reason")));
    }

    @RequestMapping(value = "/**", method = RequestMethod.OPTIONS)
    public ResponseEntity<?> options() {
        return ResponseEntity.ok().build();
    }
}