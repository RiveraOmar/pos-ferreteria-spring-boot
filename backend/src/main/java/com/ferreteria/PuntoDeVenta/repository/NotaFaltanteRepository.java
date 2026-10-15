package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.NotaFaltante;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NotaFaltanteRepository extends JpaRepository<NotaFaltante, Long> {
    List<NotaFaltante> findByResuelta(Boolean resuelta);
    List<NotaFaltante> findAllByOrderByCreatedAtDesc();
}