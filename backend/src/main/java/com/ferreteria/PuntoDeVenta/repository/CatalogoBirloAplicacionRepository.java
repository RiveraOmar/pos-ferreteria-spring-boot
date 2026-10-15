package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.CatalogoBirloAplicacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface CatalogoBirloAplicacionRepository
        extends JpaRepository<CatalogoBirloAplicacion, Long> {

    @Query("SELECT DISTINCT a.marca FROM CatalogoBirloAplicacion a ORDER BY a.marca")
    List<String> marcas();

    List<CatalogoBirloAplicacion>
    findByMarcaIgnoreCaseAndAplicacionContainingIgnoreCaseOrderByAplicacion(
            String marca, String aplicacion);

    List<CatalogoBirloAplicacion>
    findByAplicacionContainingIgnoreCaseOrderByMarcaAscAplicacionAsc(String aplicacion);

    List<CatalogoBirloAplicacion> findByCodigoOrderByMarcaAscAplicacionAsc(String codigo);
}