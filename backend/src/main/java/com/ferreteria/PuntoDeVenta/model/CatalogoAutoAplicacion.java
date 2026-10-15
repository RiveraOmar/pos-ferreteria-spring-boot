package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "catalogo_auto_aplicaciones")
@Data
public class CatalogoAutoAplicacion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String marca;      
    private String modelo;      
    private String version;     
    private String motor;       
    private String cilindrada;
    private String kw;
    @Column(name = "anio_desde") private String anioDesde;
    @Column(name = "anio_hasta") private String anioHasta;
    private String articulo;    
    private String parte;      
}