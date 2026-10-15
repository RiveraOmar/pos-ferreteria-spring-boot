package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * Una foto de un producto. Un producto puede tener varias (frente,
 * especificaciones, etiqueta...). La de orden 0 es la PRINCIPAL: es la que se
 * ve en listas, ventas y tickets, y se refleja en Product.imagenUrl para que
 * todo el código existente siga funcionando igual.
 *
 * Nota de diseño: aquí NO se guarda la imagen en sí, solo su URL. El archivo
 * vive en la carpeta de uploads del servidor (ver UploadController). Guardar
 * archivos binarios en la base de datos la haría lenta y pesada de respaldar.
 */
@Entity
@Table(name = "product_images")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class ProductImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "product_id", nullable = false)
    private Long productId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String url;

    /** Etiqueta opcional: "Frente", "Especificaciones", "Etiqueta"... */
    @Column(length = 80)
    private String titulo;

    /** 0 = principal. El resto se muestran en la galería en este orden. */
    @Column(nullable = false)
    private Integer orden = 0;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
        if (orden == null) orden = 0;
    }
}