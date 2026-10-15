package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.InventoryAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface InventoryAdjustmentRepository
        extends JpaRepository<InventoryAdjustment, Long> {

    List<InventoryAdjustment> findByProductIdOrderByFechaDesc(Long productId);
}