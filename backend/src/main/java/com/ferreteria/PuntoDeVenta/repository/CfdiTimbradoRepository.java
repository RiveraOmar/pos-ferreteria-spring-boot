package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.CfdiTimbrado;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface CfdiTimbradoRepository extends JpaRepository<CfdiTimbrado, Long> {

    Optional<CfdiTimbrado> findByUuid(String uuid);
    Optional<CfdiTimbrado> findBySaleId(Long saleId);
    Optional<CfdiTimbrado> findByPrefacturaId(Long prefacturaId);
    List<CfdiTimbrado> findByStatusOrderByFechaTimbradoDesc(String status);
    List<CfdiTimbrado> findAllByOrderByFechaTimbradoDesc();
    boolean existsBySaleId(Long saleId);
    boolean existsByPrefacturaId(Long prefacturaId);

    // ── Métodos que DISTINGUEN CFDIs cancelados ──────────────────────────
    // Un CFDI CANCELADO no debe bloquear la re-facturación de su venta:
    // cancelar y reemitir es el procedimiento normal del SAT (Apéndice 2).
    // Los métodos sin filtro de status de arriba tratan un CFDI cancelado
    // igual que uno vigente — usarlos para validar "¿ya tiene factura?"
    // dejaba ventas atrapadas para siempre.
    boolean existsBySaleIdAndStatusNot(Long saleId, String status);
    boolean existsByPrefacturaIdAndStatusNot(Long prefacturaId, String status);
    Optional<CfdiTimbrado> findFirstBySaleIdAndStatusNotOrderByFechaTimbradoDesc(
            Long saleId, String status);
    // El más reciente sin importar status — evita NonUniqueResultException
    // cuando una venta tiene un CFDI cancelado y uno vigente (reemisión).
    Optional<CfdiTimbrado> findFirstBySaleIdOrderByFechaTimbradoDesc(Long saleId);
}