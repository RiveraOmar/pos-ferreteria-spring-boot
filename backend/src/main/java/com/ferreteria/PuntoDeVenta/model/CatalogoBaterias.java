package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "catalogo_baterias")
@Data
public class CatalogoBaterias {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String marca;

    @Column(nullable = false)
    private String modelo;

    @Column(name = "anio_rango", nullable = false)
    private String anioRango; // Almacena valores del PDF como "2013-2022" o "1992-2007"

    @Column(name = "bateria_recomendada", nullable = false)
    private String bateriaRecomendada; // Ej: "47", "75/86"

    @Column(name = "alt")
    private String bateriaAlternativa;

    private String notas;
}