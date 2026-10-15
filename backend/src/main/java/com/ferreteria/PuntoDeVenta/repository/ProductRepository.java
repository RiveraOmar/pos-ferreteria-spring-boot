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
    // Búsqueda por UNA palabra, en TODO lo que identifica a un producto.
    //
    // Es consulta NATIVA (no JPQL) a propósito: 'attributes' es una columna
    // jsonb y JPQL no sabe mirar dentro. Con ::text el JSON se vuelve texto y
    // se puede buscar ahí el código de Truper, la marca o la familia.
    // Por eso los nombres son de COLUMNA (imagen_url, sat_...), no de campo Java.
    //
    // El filtrado por las demás palabras lo hace el servicio (ver searchProducts).
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

    // Código interno de Truper (vive en attributes->>'codigo_truper').
    // Coincidencia exacta: es el código que viene en su catálogo impreso.
    @Query(value = "SELECT * FROM products p " +
            "WHERE p.attributes->>'codigo_truper' = :codigo",
            nativeQuery = true)
    List<Product> findByCodigoTruper(@Param("codigo") String codigo);

    // Coincidencia exacta de código de barras: el lector manda el código completo
    // y debe encontrarlo aunque sea largo.
    List<Product> findByBarcode(String barcode);

    // SKU exacto sin importar mayúsculas: si escribes "pet-15x" quieres ESE
    // producto, no todo lo que contenga ese texto.
    List<Product> findBySkuIgnoreCase(String sku);


    @Query("SELECT p FROM Product p WHERE p.active = true AND p.category.id IN :categoryIds")
    List<Product> findByCategoryIdIn(@Param("categoryIds") List<Long> categoryIds);
}