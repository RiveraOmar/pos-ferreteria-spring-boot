package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.dto.SupplierDTO;
import com.ferreteria.PuntoDeVenta.dto.SupplierProductDTO;
import com.ferreteria.PuntoDeVenta.dto.SupplierRequestDTO;
import com.ferreteria.PuntoDeVenta.exception.ResourceNotFoundException;
import com.ferreteria.PuntoDeVenta.model.Supplier;
import com.ferreteria.PuntoDeVenta.repository.PurchaseOrderRepository;
import com.ferreteria.PuntoDeVenta.repository.SupplierProductRepository;
import com.ferreteria.PuntoDeVenta.repository.SupplierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SupplierService {

    private final SupplierRepository supplierRepository;
    private final PurchaseOrderRepository purchaseOrderRepository;
    private final SupplierProductRepository supplierProductRepository;

    @Transactional(readOnly = true)
    public List<SupplierProductDTO> productosDelProveedor(Long supplierId) {
        return supplierProductRepository.findBySupplierIdOrderByLastPurchaseAtDesc(supplierId)
                .stream()
                .map(sp -> new SupplierProductDTO(
                        sp.getId(),
                        sp.getSupplier().getId(),
                        sp.getSupplier().getCompanyName(),
                        sp.getProduct().getId(),
                        sp.getProduct().getName(),
                        sp.getProduct().getSku(),
                        sp.getSupplierSku(),
                        sp.getLastCost(),
                        sp.getLastPurchaseAt(),
                        sp.getProduct().getListPrice(),
                        sp.getProduct().getSatClaveUnidad(),
                        sp.getProduct().getImagenUrl()
                ))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SupplierDTO> listar(boolean active) {
        return supplierRepository.findByActiveOrderByCompanyName(active).stream()
                .map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<SupplierDTO> buscar(String term, boolean active) {
        return supplierRepository.search(term, active).stream()
                .map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public SupplierDTO obtener(Long id) {
        return toDTO(supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado")));
    }

    @Transactional
    public SupplierDTO crear(SupplierRequestDTO req) {
        Supplier s = new Supplier();
        mapear(s, req);
        return toDTO(supplierRepository.save(s));
    }

    @Transactional
    public SupplierDTO actualizar(Long id, SupplierRequestDTO req) {
        Supplier s = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado"));
        mapear(s, req);
        return toDTO(supplierRepository.save(s));
    }

    @Transactional
    public void cambiarEstado(Long id, boolean active) {
        Supplier s = supplierRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Proveedor no encontrado"));
        s.setActive(active);
        supplierRepository.save(s);
    }

    private void mapear(Supplier s, SupplierRequestDTO req) {
        s.setCompanyName(req.companyName().trim());
        s.setContactName(req.contactName());
        s.setPhoneNumber(req.phoneNumber());
        s.setEmail(req.email());
        s.setAddress(req.address());
        s.setCity(req.city());
        s.setRfc(req.rfc() != null ? req.rfc().toUpperCase().trim() : null);
        s.setNotes(req.notes());
    }

    private SupplierDTO toDTO(Supplier s) {
        Integer compras = purchaseOrderRepository.totalComprasPorProveedor(s.getId());
        var totalGastado = purchaseOrderRepository.totalGastadoPorProveedor(s.getId());
        return new SupplierDTO(
                s.getId(), s.getCompanyName(), s.getContactName(),
                s.getPhoneNumber(), s.getEmail(), s.getAddress(),
                s.getCity(), s.getRfc(), s.getNotes(), s.isActive(),
                s.getCreatedAt(), compras, totalGastado
        );
    }
}