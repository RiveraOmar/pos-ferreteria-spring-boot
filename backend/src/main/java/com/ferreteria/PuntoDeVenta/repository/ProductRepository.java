package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findByActiveTrue();
    List<Product> findByNameContainingIgnoreCase(String name);
    
    @Query(value = """
        SELECT * FROM products p
        WHERE
            translate(lower(COALESCE(p.name, '')),
                      'áéíóúüñ',
                      'aeiouun')
                LIKE CONCAT('%',
                    translate(lower(:term),
                              'áéíóúüñ',
                              'aeiouun'),
                    '%')

            OR translate(lower(COALESCE(p.sku, '')),
                         'áéíóúüñ',
                         'aeiouun')
                LIKE CONCAT('%',
                    translate(lower(:term),
                              'áéíóúüñ',
                              'aeiouun'),
                    '%')

            OR translate(lower(COALESCE(p.description, '')),
                         'áéíóúüñ',
                         'aeiouun')
                LIKE CONCAT('%',
                    translate(lower(:term),
                              'áéíóúüñ',
                              'aeiouun'),
                    '%')

            OR translate(lower(COALESCE(p.barcode, '')),
                         'áéíóúüñ',
                         'aeiouun')
                LIKE CONCAT('%',
                    translate(lower(:term),
                              'áéíóúüñ',
                              'aeiouun'),
                    '%')

            OR translate(lower(COALESCE(p.attributes::text, '')),
                         'áéíóúüñ',
                         'aeiouun')
                LIKE CONCAT('%',
                    translate(lower(:term),
                              'áéíóúüñ',
                              'aeiouun'),
                    '%')

            OR CAST(p.id AS text) LIKE CONCAT('%', :term, '%')
        """,
            nativeQuery = true)
    List<Product> searchByTerm(@Param("term") String term);

    
    @Query(value = "SELECT * FROM products p " +
            "WHERE p.attributes->>'codigo_truper' = :codigo",
            nativeQuery = true)
    List<Product> findByCodigoTruper(@Param("codigo") String codigo);

    
    List<Product> findByBarcode(String barcode);

    
    List<Product> findBySkuIgnoreCase(String sku);


    @Query("SELECT p FROM Product p WHERE p.active = true AND p.category.id IN :categoryIds")
    List<Product> findByCategoryIdIn(@Param("categoryIds") List<Long> categoryIds);
}