package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.Prefactura;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PrefacturaRepository extends JpaRepository<Prefactura, Long> {

    List<Prefactura> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    List<Prefactura> findByStatusInOrderByCreatedAtDesc(List<String> statuses);

    @Query("SELECT p FROM Prefactura p WHERE p.status NOT IN ('EMITIDA','CANCELADA') ORDER BY p.createdAt DESC")
    List<Prefactura> findAllActivas();

    @Query("SELECT p FROM Prefactura p WHERE p.customer.id = :cid AND p.status NOT IN ('EMITIDA','CANCELADA') ORDER BY p.createdAt DESC")
    List<Prefactura> findActivasByCliente(@Param("cid") Long customerId);
}