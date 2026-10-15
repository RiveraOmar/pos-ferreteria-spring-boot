package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.Customer;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface CustomerRepository extends JpaRepository<Customer, Long> {

    @Query("SELECT cu FROM Customer cu WHERE cu.active = true")
    List<Customer> findAllActive();

    @Query("SELECT cu FROM Customer cu WHERE cu.fullName LIKE %:name% AND cu.active = true")
    List<Customer> findByNameActive(@Param("name") String name);

    @Modifying
    @Transactional
    @Query("UPDATE Customer cu SET cu.active = :status WHERE cu.id = :id")
    void updateActiveStatus(@Param("id") Long id, @Param("status") boolean status);

    // ─── phone_number es el nombre real de la columna en la BD ───────────────
    @Query(value = """
    SELECT * FROM customers
    WHERE (
        translate(lower(COALESCE(full_name, '')),
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

        OR translate(lower(COALESCE(email, '')),
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
    )
    AND active = true
    ORDER BY full_name
    LIMIT 200
    """, nativeQuery = true)
    List<Customer> findByNameLoose(@Param("term") String term);




    @Query(value = """
    SELECT * FROM customers
    WHERE (
        translate(lower(COALESCE(full_name, '')),
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

        OR translate(lower(COALESCE(email, '')),
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
    )
    AND active = false
    ORDER BY full_name
    LIMIT 200
    """, nativeQuery = true)
    List<Customer> findByNameInactiveLoose(@Param("term") String term);
}