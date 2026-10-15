package com.ferreteria.PuntoDeVenta.repository;

import com.ferreteria.PuntoDeVenta.model.ProductImage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductImageRepository extends JpaRepository<ProductImage, Long> {

    /** Fotos de un producto, ya ordenadas (la principal primero). */
    List<ProductImage> findByProductIdOrderByOrdenAsc(Long productId);

    long countByProductId(Long productId);

    void deleteByProductId(Long productId);
}