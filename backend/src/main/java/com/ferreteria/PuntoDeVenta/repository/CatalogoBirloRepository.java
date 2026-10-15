package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.CatalogoBirlo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.math.BigDecimal;
import java.util.List;

public interface CatalogoBirloRepository extends JpaRepository<CatalogoBirlo, String> {

    // Búsqueda por Ø de estría con tolerancia (el vernier nunca es exacto)
    @Query("""
        SELECT b FROM CatalogoBirlo b
        WHERE b.estriaMm BETWEEN :mmMin AND :mmMax
        ORDER BY b.estriaMm, b.codigo
        """)
    List<CatalogoBirlo> findByEstriaMmEntre(@Param("mmMin") BigDecimal mmMin,
                                            @Param("mmMax") BigDecimal mmMax);

    List<CatalogoBirlo> findByRoscaContainingIgnoreCaseOrderByEstriaMm(String rosca);
    List<CatalogoBirlo> findByCodigoIn(List<String> codigos);
}