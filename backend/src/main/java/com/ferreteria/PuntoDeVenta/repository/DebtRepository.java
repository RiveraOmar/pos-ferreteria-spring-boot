package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.Debt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DebtRepository extends JpaRepository<Debt, Long> {

    List<Debt> findByCustomerIdOrderByCreatedAtDesc(Long customerId);

    List<Debt> findByStatusInOrderByCreatedAtDesc(List<String> statuses);

    @Query("SELECT d FROM Debt d WHERE d.status IN ('PENDING','PARTIAL') ORDER BY d.createdAt DESC")
    List<Debt> findAllPending();

    @Query("SELECT SUM(d.remainingAmount) FROM Debt d WHERE d.customer.id = :customerId AND d.status IN ('PENDING','PARTIAL')")
    java.math.BigDecimal sumRemainingByCustomer(@Param("customerId") Long customerId);
}