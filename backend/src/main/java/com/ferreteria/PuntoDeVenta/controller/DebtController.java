package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.dto.DebtRequestDTO;
import com.ferreteria.PuntoDeVenta.dto.DebtResponseDTO;
import com.ferreteria.PuntoDeVenta.dto.PaymentRequestDTO;
import com.ferreteria.PuntoDeVenta.service.DebtService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import com.ferreteria.PuntoDeVenta.dto.DebtPaymentDTO;
import com.ferreteria.PuntoDeVenta.dto.AgregarItemsDebtDTO;
@RestController
@RequestMapping("/api/debts")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class DebtController {

    private final DebtService debtService;


    @Operation(summary = "Historial de pagos de una deuda")
    @GetMapping("/{debtId}/payments")
    public ResponseEntity<List<DebtPaymentDTO>> getPayments(@PathVariable Long debtId) {
        return ResponseEntity.ok(debtService.getPaymentHistory(debtId));
    }


    @Operation(summary = "Listar deudas pendientes")
    @GetMapping
    public List<DebtResponseDTO> getAllPending() {
        return debtService.getAllPending();
    }

    @Operation(summary = "Deudas de un cliente")
    @GetMapping("/customer/{customerId}")
    public List<DebtResponseDTO> getByCustomer(@PathVariable Long customerId) {
        return debtService.getByCustomer(customerId);
    }

    @Operation(summary = "Libreta de fiado de un cliente: productos y abonos juntos, cronológico")
    @GetMapping("/customer/{customerId}/libreta")
    public List<com.ferreteria.PuntoDeVenta.dto.LibretaEntryDTO> getLibreta(@PathVariable Long customerId) {
        return debtService.getLibretaCliente(customerId);
    }

    @Operation(summary = "Total adeudado por cliente")
    @GetMapping("/customer/{customerId}/total")
    public ResponseEntity<Map<String, BigDecimal>> getTotalByCustomer(@PathVariable Long customerId) {
        return ResponseEntity.ok(Map.of("total", debtService.getTotalDebtByCustomer(customerId)));
    }

    @Operation(summary = "Registrar nueva deuda")
    @PostMapping
    public ResponseEntity<DebtResponseDTO> create(@RequestBody DebtRequestDTO request) {
        return ResponseEntity.ok(debtService.createDebt(request));
    }

    @Operation(summary = "Registrar pago a una deuda")
    @PostMapping("/{debtId}/pay")
    public ResponseEntity<DebtResponseDTO> pay(
            @PathVariable Long debtId,
            @RequestBody PaymentRequestDTO request) {
        return ResponseEntity.ok(debtService.applyPayment(debtId, request));
    }

    @Operation(summary = "Agregar productos a una nota de fiado existente")
    @PostMapping("/{debtId}/agregar-items")
    public ResponseEntity<DebtResponseDTO> agregarItems(
            @PathVariable Long debtId,
            @RequestBody AgregarItemsDebtDTO request) {
        return ResponseEntity.ok(debtService.agregarItems(debtId, request));
    }
}