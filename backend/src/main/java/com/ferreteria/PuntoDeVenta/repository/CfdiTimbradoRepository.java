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

    
    boolean existsBySaleIdAndStatusNot(Long saleId, String status);
    boolean existsByPrefacturaIdAndStatusNot(Long prefacturaId, String status);
    Optional<CfdiTimbrado> findFirstBySaleIdAndStatusNotOrderByFechaTimbradoDesc(
            Long saleId, String status);
    
    Optional<CfdiTimbrado> findFirstBySaleIdOrderByFechaTimbradoDesc(Long saleId);
}