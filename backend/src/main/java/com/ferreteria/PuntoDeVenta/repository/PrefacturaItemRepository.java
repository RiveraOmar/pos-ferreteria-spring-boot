    package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.PrefacturaItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PrefacturaItemRepository extends JpaRepository<PrefacturaItem, Long> {

    long countByProductId(Long productId);
}