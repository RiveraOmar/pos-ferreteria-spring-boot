package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

/**
 * Una nota de la "libreta de apuntes" de Faltantes: algo que hace falta
 * pero que NO está dado de alta en el catálogo de productos — para
 * encargarlo a alguien, preguntarle a un proveedor, o simplemente no
 * olvidarlo. Texto libre, sin ligar a ningún producto.
 */
@Entity
@Table(name = "notas_faltantes")
@Data
public class NotaFaltante {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 300)
    private String texto;

    private String autor;   // quién la anotó (opcional, texto libre)

    @Column(nullable = false)
    private Boolean resuelta = false;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(name = "resolved_at")
    private LocalDateTime resolvedAt;
}