package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.SupplierProduct;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface SupplierProductRepository extends JpaRepository<SupplierProduct, Long> {

    List<SupplierProduct> findBySupplierIdOrderByLastPurchaseAtDesc(Long supplierId);

    List<SupplierProduct> findByProductIdOrderByLastCostAsc(Long productId);

    Optional<SupplierProduct> findBySupplierIdAndProductId(Long supplierId, Long productId);

    // Al borrar un producto se sueltan sus proveedores ligados.
    void deleteByProductId(Long productId);
}