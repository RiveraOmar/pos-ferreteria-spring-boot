package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.PriceHistory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PriceHistoryRepository extends JpaRepository<PriceHistory, Long> {

    // Opcional: Por si después quieres ver el historial de un producto específico
    List<PriceHistory> findByProductIdOrderByChangeDateDesc(Long productId);

    // Se usa al borrar un producto de forma permanente: el historial de
    // precios cuelga de el y no tiene valor fiscal propio.
    void deleteByProductId(Long productId);
}