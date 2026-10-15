package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.CatalogoBaterias;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CatalogoBateriasRepository extends JpaRepository<CatalogoBaterias, Long> {

    // 1. Obtener todas las marcas distintas
    @Query("SELECT DISTINCT c.marca FROM CatalogoBaterias c ORDER BY c.marca")
    List<String> findDistinctMarcas();

    // 2. Obtener modelos filtrados por marca
    @Query("SELECT DISTINCT c.modelo FROM CatalogoBaterias c WHERE c.marca = :marca ORDER BY c.modelo")
    List<String> findDistinctModelosByMarca(@Param("marca") String marca);

    // 3. Obtener los años (o rangos) correspondientes a esa marca y modelo
    @Query("SELECT DISTINCT c.anioRango FROM CatalogoBaterias c WHERE c.marca = :marca AND c.modelo = :modelo")
    List<String> findAniosByMarcaAndModelo(@Param("marca") String marca, @Param("modelo") String modelo);

    // 4. Búsqueda exacta por vehículo seleccionado en los selectores
    @Query("SELECT c FROM CatalogoBaterias c WHERE c.marca = :marca AND c.modelo = :modelo AND c.anioRango = :anioRango")
    List<CatalogoBaterias> findByVehiculoCompleto(
            @Param("marca") String marca,
            @Param("modelo") String modelo,
            @Param("anioRango") String anioRango);

    // 5. Búsqueda Dinámica (por si el usuario escribe un año individual como "2015" o el nombre del carro)
    // Usa split_part para partir el string "2013-2022" y evaluar si el año buscado está en medio
    @Query(value = "SELECT * FROM catalogo_baterias WHERE " +
            "LOWER(marca) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
            "LOWER(modelo) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
            "LOWER(bateria_recomendada) LIKE LOWER(CONCAT('%', :q, '%')) OR " +
            "LOWER(alt) LIKE LOWER(CONCAT('%', :q, '%')) OR " +  // <--- AQUÍ ESTÁ EL CAMBIO
            "(CAST(:q AS TEXT) ~ '^[0-9]+$' AND " +
            "CAST(:q AS INTEGER) BETWEEN " +
            "CAST(SPLIT_PART(anio_rango, '-', 1) AS INTEGER) AND " +
            "CAST(SPLIT_PART(anio_rango, '-', 2) AS INTEGER)) " +
            "ORDER BY marca, modelo", nativeQuery = true)
    List<CatalogoBaterias> findByTextoLibre(@Param("q") String q);
}