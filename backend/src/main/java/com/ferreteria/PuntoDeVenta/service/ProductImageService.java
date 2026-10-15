package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.model.Product;
import com.ferreteria.PuntoDeVenta.model.ProductImage;
import com.ferreteria.PuntoDeVenta.repository.ProductImageRepository;
import com.ferreteria.PuntoDeVenta.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;


@Slf4j
@Service
@RequiredArgsConstructor
public class ProductImageService {

    private final ProductImageRepository imageRepository;
    private final ProductRepository productRepository;

    @Value("${app.uploads.dir:uploads}")
    private String uploadsDir;

    public static final int MAX_FOTOS = 6;

    public List<ProductImage> listar(Long productId) {
        return imageRepository.findByProductIdOrderByOrdenAsc(productId);
    }

    @Transactional
    public ProductImage agregar(Long productId, String url, String titulo) {
        Product product = productRepository.findById(productId)
                .orElseThrow(() -> new RuntimeException("Producto no encontrado: " + productId));

        long actuales = imageRepository.countByProductId(productId);
        if (actuales >= MAX_FOTOS)
            throw new IllegalStateException(
                    "Este producto ya tiene " + MAX_FOTOS + " fotos (el máximo). "
                            + "Borra alguna para agregar otra.");

        ProductImage img = new ProductImage();
        img.setProductId(productId);
        img.setUrl(url);
        img.setTitulo(titulo != null && !titulo.isBlank() ? titulo.trim() : null);
        img.setOrden((int) actuales);   
        img = imageRepository.save(img);

        if (actuales == 0) sincronizarPrincipal(product, url);

        return img;
    }

    @Transactional
    public void eliminar(Long productId, Long imageId) {
        ProductImage img = imageRepository.findById(imageId)
                .orElseThrow(() -> new RuntimeException("Foto no encontrada"));
        if (!img.getProductId().equals(productId))
            throw new IllegalStateException("Esa foto no pertenece a este producto.");

        imageRepository.delete(img);
        borrarArchivo(img.getUrl());

        List<ProductImage> resto = imageRepository.findByProductIdOrderByOrdenAsc(productId);
        for (int i = 0; i < resto.size(); i++) {
            resto.get(i).setOrden(i);
        }
        imageRepository.saveAll(resto);

        productRepository.findById(productId).ifPresent(p ->
                sincronizarPrincipal(p, resto.isEmpty() ? null : resto.get(0).getUrl()));
    }

    @Transactional
    public void marcarPrincipal(Long productId, Long imageId) {
        List<ProductImage> fotos = imageRepository.findByProductIdOrderByOrdenAsc(productId);
        ProductImage elegida = fotos.stream()
                .filter(f -> f.getId().equals(imageId))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Foto no encontrada en este producto"));

        elegida.setOrden(0);
        int i = 1;
        for (ProductImage f : fotos) {
            if (!f.getId().equals(imageId)) f.setOrden(i++);
        }
        imageRepository.saveAll(fotos);

        productRepository.findById(productId).ifPresent(p ->
                sincronizarPrincipal(p, elegida.getUrl()));
    }

    @Transactional
    public void renombrar(Long productId, Long imageId, String titulo) {
        ProductImage img = imageRepository.findById(imageId)
                .orElseThrow(() -> new RuntimeException("Foto no encontrada"));
        if (!img.getProductId().equals(productId))
            throw new IllegalStateException("Esa foto no pertenece a este producto.");
        img.setTitulo(titulo != null && !titulo.isBlank()
                ? titulo.trim().substring(0, Math.min(80, titulo.trim().length()))
                : null);
        imageRepository.save(img);
    }

    private void sincronizarPrincipal(Product product, String url) {
        product.setImagenUrl(url);
        productRepository.save(product);
    }

    private void borrarArchivo(String url) {
        try {
            if (url == null || !url.startsWith("/uploads/")) return; // URL externa: no se toca
            String nombre = url.substring("/uploads/".length());
            if (nombre.contains("/") || nombre.contains("\\") || nombre.contains(".."))
                return; // seguridad: nada de rutas raras
            Path archivo = Paths.get(uploadsDir).toAbsolutePath().normalize().resolve(nombre);
            if (Files.deleteIfExists(archivo))
                log.info("[IMG] Archivo borrado: {}", nombre);
        } catch (Exception e) {
            log.warn("[IMG] No se pudo borrar el archivo de {}: {}", url, e.getMessage());
        }
    }
}