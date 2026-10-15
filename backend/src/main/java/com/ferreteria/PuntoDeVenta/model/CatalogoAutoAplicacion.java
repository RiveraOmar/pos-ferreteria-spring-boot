package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;

/** Aplicación automotriz: qué parte (banda, bomba, tensor...) lleva un vehículo. */
@Entity
@Table(name = "catalogo_auto_aplicaciones")
@Data
public class CatalogoAutoAplicacion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String marca;       // TOYOTA, HONDA, FORD...
    private String modelo;      // COROLLA, CIVIC...
    private String version;     // "Sedán 2.0"
    private String motor;       // código de motor
    private String cilindrada;
    private String kw;
    @Column(name = "anio_desde") private String anioDesde;
    @Column(name = "anio_hasta") private String anioHasta;
    private String articulo;    // "Banda Micro-V — Alternador"
    private String parte;       // número de parte Gates
}