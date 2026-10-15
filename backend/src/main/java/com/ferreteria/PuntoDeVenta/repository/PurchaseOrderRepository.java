package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.PurchaseOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PurchaseOrderRepository extends JpaRepository<PurchaseOrder, Long> {

    List<PurchaseOrder> findTop50ByOrderByCreatedAtDesc();

    List<PurchaseOrder> findBySupplierIdOrderByCreatedAtDesc(Long supplierId);

    @Query("""
        SELECT po FROM PurchaseOrder po
        WHERE po.createdAt BETWEEN :inicio AND :fin
        AND (:status = 'TODOS' OR po.status = :status)
        ORDER BY po.createdAt DESC
        """)
    List<PurchaseOrder> buscarConFiltros(
            @Param("inicio") LocalDateTime inicio,
            @Param("fin") LocalDateTime fin,
            @Param("status") String status);

    @Query("""
        SELECT COALESCE(SUM(po.total), 0) FROM PurchaseOrder po
        WHERE po.supplier.id = :supplierId AND po.status = 'RECIBIDA'
        """)
    BigDecimal totalGastadoPorProveedor(@Param("supplierId") Long supplierId);

    @Query("""
        SELECT COUNT(po) FROM PurchaseOrder po
        WHERE po.supplier.id = :supplierId AND po.status = 'RECIBIDA'
        """)
    Integer totalComprasPorProveedor(@Param("supplierId") Long supplierId);
}