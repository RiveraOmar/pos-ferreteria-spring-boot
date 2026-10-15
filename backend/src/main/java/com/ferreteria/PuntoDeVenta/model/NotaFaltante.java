package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;


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