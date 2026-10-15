package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.ConfiguracionFacturacion;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConfiguracionFacturacionRepository
        extends JpaRepository<ConfiguracionFacturacion, Long> {
}
