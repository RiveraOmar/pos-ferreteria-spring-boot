package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.CatalogoAutoAplicacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface CatalogoAutoRepository extends JpaRepository<CatalogoAutoAplicacion, Long> {

    @Query("SELECT DISTINCT a.marca FROM CatalogoAutoAplicacion a ORDER BY a.marca")
    List<String> marcas();

    @Query("SELECT DISTINCT a.modelo FROM CatalogoAutoAplicacion a "
            + "WHERE a.marca = ?1 ORDER BY a.modelo")
    List<String> modelosDeMarca(String marca);

    List<CatalogoAutoAplicacion>
    findByMarcaIgnoreCaseAndModeloContainingIgnoreCaseOrderByModeloAscAnioDesdeAsc(
            String marca, String modelo);

    List<CatalogoAutoAplicacion>
    findByParteIgnoreCaseOrderByMarcaAscModeloAsc(String parte);

    List<CatalogoAutoAplicacion>
    findByModeloContainingIgnoreCaseOrderByMarcaAscModeloAsc(String modelo);
}