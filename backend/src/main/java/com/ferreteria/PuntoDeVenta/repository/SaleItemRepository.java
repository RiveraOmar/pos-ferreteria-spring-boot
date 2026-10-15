package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.SaleItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

/**
 * Solo se usa para UNA cosa: saber si un producto ya aparece en alguna venta,
 * antes de dejar borrarlo. Los renglones de venta se leen normalmente desde
 * la venta que los contiene (Sale), no desde aqui.
 */
@Repository
public interface SaleItemRepository extends JpaRepository<SaleItem, Long> {

    long countByProductId(Long productId);
}