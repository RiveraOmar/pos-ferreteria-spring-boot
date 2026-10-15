package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SaleRepository extends JpaRepository<Sale, Long> {

    List<Sale> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
    List<Sale> findTop50ByOrderByCreatedAtDesc();

    List<Sale> findByCustomerIdAndCreatedAtBetweenAndStatus(
            Long customerId,
            LocalDateTime inicio,
            LocalDateTime fin,
            String status);

   
    @Query("""
    SELECT s FROM Sale s
    WHERE s.customer.id = :customerId
      AND s.status = 'COMPLETED'
      AND s.createdAt >= :inicio
      AND s.createdAt <= :fin
      AND (s.incluidoFacturaGlobal IS NULL OR s.incluidoFacturaGlobal = FALSE)
    ORDER BY s.createdAt ASC
    """)
    List<Sale> findPendientesGlobal(
            @Param("customerId") Long customerId,
            @Param("inicio") LocalDateTime inicio,
            @Param("fin") LocalDateTime fin);

    List<Sale> findByCfdiGlobalIdOrderByCreatedAtAsc(Long cfdiGlobalId);
    long countByCfdiGlobalId(Long cfdiGlobalId);

    
    @Query(value = "SELECT nextval('seq_ticket_folio')", nativeQuery = true)
    Long siguienteFolioTicket();

    @Query(value = """
    SELECT s.* FROM sales s
    LEFT JOIN customers c ON c.id = s.customer_id
    WHERE s.created_at >= :inicio
      AND s.created_at <= :fin
      AND (:status = 'TODOS' OR s.status = :status)
      AND (
           :texto = ''

        OR translate(lower(COALESCE(s.invoice_number, '')),
                     'áéíóúüñ',
                     'aeiouun')
           LIKE CONCAT('%',
               translate(lower(:texto),
                         'áéíóúüñ',
                         'aeiouun'),
               '%')

        OR translate(lower(COALESCE(c.full_name, '')),
                     'áéíóúüñ',
                     'aeiouun')
           LIKE CONCAT('%',
               translate(lower(:texto),
                         'áéíóúüñ',
                         'aeiouun'),
               '%')

        OR translate(lower(COALESCE(c.rfc, '')),
                     'áéíóúüñ',
                     'aeiouun')
           LIKE CONCAT('%',
               translate(lower(:texto),
                         'áéíóúüñ',
                         'aeiouun'),
               '%')
      )
    ORDER BY s.created_at DESC
    LIMIT 200
    """, nativeQuery = true)
    List<Sale> buscarConFiltros(
            @Param("inicio") LocalDateTime inicio,
            @Param("fin") LocalDateTime fin,
            @Param("status") String status,
            @Param("texto") String texto);
}