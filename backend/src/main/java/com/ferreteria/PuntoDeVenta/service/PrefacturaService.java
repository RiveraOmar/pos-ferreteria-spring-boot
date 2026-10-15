package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.dto.PrefacturaDTO;
import com.ferreteria.PuntoDeVenta.dto.PrefacturaRequestDTO;
import com.ferreteria.PuntoDeVenta.exception.ResourceNotFoundException;
import com.ferreteria.PuntoDeVenta.model.*;
import com.ferreteria.PuntoDeVenta.repository.CustomerRepository;
import com.ferreteria.PuntoDeVenta.repository.InventoryRepository;
import com.ferreteria.PuntoDeVenta.repository.PrefacturaRepository;
import com.ferreteria.PuntoDeVenta.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PrefacturaService {

    private final PrefacturaRepository prefacturaRepository;
    private final CustomerRepository   customerRepository;
    private final ProductRepository    productRepository;
    private final InventoryRepository  inventoryRepository;

    @Transactional
    public PrefacturaDTO crear(PrefacturaRequestDTO req) {
        Customer customer = customerRepository.findById(req.customerId())
                .orElseThrow(() -> new ResourceNotFoundException("Cliente no encontrado"));

        validarStock(req.items());

        Prefactura p = new Prefactura();
        p.setCustomer(customer);
        p.setFolio("PRE-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase());
        p.setStatus("BORRADOR");
        p.setNotes(req.notes());
        p.setCreatedAt(LocalDateTime.now());
        p.setUpdatedAt(LocalDateTime.now());

        agregarItems(p, req.items());
        calcularTotales(p);

        descontarStock(p.getItems());

        return toDTO(prefacturaRepository.save(p));
    }

    @Transactional
    public PrefacturaDTO actualizar(Long id, PrefacturaRequestDTO req) {
        Prefactura p = prefacturaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Prefactura no encontrada"));

        if (p.getStatus().equals("EMITIDA") || p.getStatus().equals("CANCELADA")) {
            throw new RuntimeException("No se puede editar una prefactura " + p.getStatus());
        }

        devolverStock(p.getItems());

        validarStock(req.items());

        p.getItems().clear();
        p.setNotes(req.notes());
        agregarItems(p, req.items());
        calcularTotales(p);
        p.setUpdatedAt(LocalDateTime.now());

        descontarStock(p.getItems());

        return toDTO(prefacturaRepository.save(p));
    }

    @Transactional
    public PrefacturaDTO cambiarEstado(Long id, String nuevoStatus) {
        Prefactura p = prefacturaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Prefactura no encontrada"));

        if (p.getStatus().equals("CANCELADA")) {
            throw new RuntimeException("Esta prefactura ya está cancelada.");
        }
        if (p.getStatus().equals("EMITIDA") && nuevoStatus.equals("CANCELADA")) {
            throw new RuntimeException("No se puede cancelar una prefactura ya emitida. Genera una nota de crédito.");
        }

        if (nuevoStatus.equals("CANCELADA")) {
            devolverStock(p.getItems());
        }

        p.setStatus(nuevoStatus);
        p.setUpdatedAt(LocalDateTime.now());
        return toDTO(prefacturaRepository.save(p));
    }

    @Transactional(readOnly = true)
    public List<PrefacturaDTO> listarActivas() {
        return prefacturaRepository.findAllActivas().stream()
                .map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<PrefacturaDTO> listarPorCliente(Long customerId) {
        return prefacturaRepository.findByCustomerIdOrderByCreatedAtDesc(customerId)
                .stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PrefacturaDTO obtener(Long id) {
        return toDTO(prefacturaRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Prefactura no encontrada")));
    }

    private void validarStock(List<PrefacturaRequestDTO.ItemRequest> items) {
        if (items == null) return;
        for (var ir : items) {
            if (ir.productId() == null) continue;
            Product producto = productRepository.findById(ir.productId()).orElse(null);
            if (producto == null) continue;
            BigDecimal stockActual = inventoryRepository.findByProductId(ir.productId())
                    .map(Inventory::getStockActual).orElse(BigDecimal.ZERO);
            if (stockActual.compareTo(ir.quantity()) < 0) {
                throw new RuntimeException(
                        "Stock insuficiente para \"" + producto.getName() + "\". " +
                                "Disponible: " + stockActual + ", solicitado: " + ir.quantity());
            }
        }
    }

    private void descontarStock(List<PrefacturaItem> items) {
        for (PrefacturaItem item : items) {
            if (item.getProduct() == null) continue;
            inventoryRepository.findByProductId(item.getProduct().getId())
                    .ifPresent(inv -> {
                        inv.setStockActual(inv.getStockActual().subtract(item.getQuantity()));
                        inventoryRepository.save(inv);
                    });
        }
    }

    private void devolverStock(List<PrefacturaItem> items) {
        for (PrefacturaItem item : items) {
            if (item.getProduct() == null) continue;
            inventoryRepository.findByProductId(item.getProduct().getId())
                    .ifPresent(inv -> {
                        inv.setStockActual(inv.getStockActual().add(item.getQuantity()));
                        inventoryRepository.save(inv);
                    });
        }
    }

    private void agregarItems(Prefactura p, List<PrefacturaRequestDTO.ItemRequest> itemsReq) {
        if (itemsReq == null) return;
        for (var ir : itemsReq) {
            PrefacturaItem item = new PrefacturaItem();
            item.setPrefactura(p);
            item.setProductName(ir.productName());
            item.setProductSku(ir.productSku());
            item.setQuantity(ir.quantity());
            item.setUnitPrice(ir.unitPrice());
            item.setSubtotal(ir.unitPrice().multiply(ir.quantity()));
            if (ir.productId() != null) {
                productRepository.findById(ir.productId()).ifPresent(item::setProduct);
            }
            p.getItems().add(item);
        }
    }

    private void calcularTotales(Prefactura p) {
        BigDecimal totalConIva = p.getItems().stream()
                .map(PrefacturaItem::getSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal sinIva = totalConIva.divide(new BigDecimal("1.16"), 2, RoundingMode.HALF_UP);
        BigDecimal iva    = totalConIva.subtract(sinIva).setScale(2, RoundingMode.HALF_UP);
        p.setSubtotal(sinIva);
        p.setTaxAmount(iva);
        p.setTotal(totalConIva);
    }

    private PrefacturaDTO toDTO(Prefactura p) {
        List<PrefacturaDTO.PrefacturaItemDTO> items = p.getItems().stream()
                .map(i -> new PrefacturaDTO.PrefacturaItemDTO(
                        i.getId(),
                        i.getProduct() != null ? i.getProduct().getId() : null,
                        i.getProductName(),
                        i.getProductSku(),
                        i.getQuantity(),
                        i.getUnitPrice(),
                        i.getSubtotal()
                )).collect(Collectors.toList());

        return new PrefacturaDTO(
                p.getId(),
                p.getCustomer().getId(),
                p.getCustomer().getFullName(),
                p.getCustomer().getRfc(),
                p.getFolio(),
                p.getStatus(),
                p.getSubtotal(),
                p.getTaxAmount(),
                p.getTotal(),
                p.getNotes(),
                p.getCreatedAt(),
                p.getUpdatedAt(),
                items
        );
    }
}