package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SupplierRepository extends JpaRepository<Supplier, Long> {

    List<Supplier> findByActiveOrderByCompanyName(boolean active);

    @Query(value = """
    SELECT * FROM suppliers
    WHERE (
        translate(lower(COALESCE(company_name, '')),
                  'áéíóúüñ',
                  'aeiouun')
            LIKE CONCAT('%',
                translate(lower(CAST(:term AS text)),
                          'áéíóúüñ',
                          'aeiouun'),
                '%')

        OR translate(lower(COALESCE(contact_name, '')),
                     'áéíóúüñ',
                     'aeiouun')
            LIKE CONCAT('%',
                translate(lower(CAST(:term AS text)),
                          'áéíóúüñ',
                          'aeiouun'),
                '%')

        OR translate(lower(COALESCE(phone_number, '')),
                     'áéíóúüñ',
                     'aeiouun')
            LIKE CONCAT('%',
                translate(lower(CAST(:term AS text)),
                          'áéíóúüñ',
                          'aeiouun'),
                '%')

        OR translate(lower(COALESCE(rfc, '')),
                     'áéíóúüñ',
                     'aeiouun')
            LIKE CONCAT('%',
                translate(lower(CAST(:term AS text)),
                          'áéíóúüñ',
                          'aeiouun'),
                '%')

        OR translate(lower(COALESCE(city, '')),
                     'áéíóúüñ',
                     'aeiouun')
            LIKE CONCAT('%',
                translate(lower(CAST(:term AS text)),
                          'áéíóúüñ',
                          'aeiouun'),
                '%')
    )
    AND active = :active
    ORDER BY company_name
    LIMIT 200
    """, nativeQuery = true)
    List<Supplier> search(
            @Param("term") String term,
            @Param("active") boolean active);
}