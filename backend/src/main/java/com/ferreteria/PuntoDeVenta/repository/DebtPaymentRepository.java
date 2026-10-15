package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.DebtPayment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface DebtPaymentRepository extends JpaRepository<DebtPayment, Long> {
    List<DebtPayment> findByDebtIdOrderByPaymentDateDesc(Long debtId);
}