package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.CatalogoFiltros;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CatalogoFiltrosRepository extends JpaRepository<CatalogoFiltros, Long> {

    @Query("SELECT DISTINCT c.tipo FROM CatalogoFiltros c ORDER BY c.tipo")
    List<String> findDistinctTipos();

    @Query("SELECT DISTINCT c.marca FROM CatalogoFiltros c WHERE c.tipo = :tipo ORDER BY c.marca")
    List<String> findDistinctMarcasByTipo(@Param("tipo") String tipo);

    @Query("SELECT DISTINCT c.anioFin FROM CatalogoFiltros c WHERE c.tipo = :tipo AND c.marca = :marca ORDER BY c.anioFin DESC")
    List<Integer> findDistinctAniosByTipoAndMarca(@Param("tipo") String tipo, @Param("marca") String marca);

    @Query("SELECT DISTINCT c.modelo FROM CatalogoFiltros c WHERE c.tipo = :tipo AND c.marca = :marca AND :anio BETWEEN c.anioInicio AND c.anioFin ORDER BY c.modelo")
    List<String> findDistinctModelosByTipoMarcaAnio(@Param("tipo") String tipo, @Param("marca") String marca, @Param("anio") Integer anio);

    @Query("SELECT DISTINCT c.motor FROM CatalogoFiltros c WHERE c.tipo = :tipo AND c.marca = :marca AND c.modelo = :modelo AND :anio BETWEEN c.anioInicio AND c.anioFin ORDER BY c.motor")
    List<String> findDistinctMotoresByTipoMarcaModeloAnio(@Param("tipo") String tipo, @Param("marca") String marca, @Param("modelo") String modelo, @Param("anio") Integer anio);

    @Query("SELECT c FROM CatalogoFiltros c WHERE c.tipo = :tipo AND c.marca = :marca AND c.modelo = :modelo AND :anio BETWEEN c.anioInicio AND c.anioFin AND c.motor = :motor")
    List<CatalogoFiltros> findByVehiculo(@Param("tipo") String tipo, @Param("marca") String marca, @Param("modelo") String modelo, @Param("anio") Integer anio, @Param("motor") String motor);

    @Query("SELECT c FROM CatalogoFiltros c WHERE " +
            "LOWER(c.marca) LIKE LOWER(CONCAT('%',:q,'%')) OR " +
            "LOWER(c.modelo) LIKE LOWER(CONCAT('%',:q,'%')) OR " +
            "LOWER(c.motor) LIKE LOWER(CONCAT('%',:q,'%')) OR " +
            "CAST(c.anioInicio AS string) LIKE CONCAT('%',:q,'%') " +
            "ORDER BY c.marca, c.modelo, c.anioFin DESC")
    List<CatalogoFiltros> findByTextoLibre(@Param("q") String q);

    @Query(value = "SELECT cf.* FROM catalogo_filtros cf " +
            "JOIN catalogo_equivalencias ce ON ce.parte_gonher IN " +
            "(cf.filtro_aceite, cf.filtro_aceite_sin, cf.filtro_aire, cf.filtro_combustible, cf.filtro_cabina) " +
            "WHERE LOWER(ce.parte_competidor) LIKE LOWER(CONCAT('%',:parte,'%'))",
            nativeQuery = true)
    List<CatalogoFiltros> findByEquivalente(@Param("parte") String parte);
}