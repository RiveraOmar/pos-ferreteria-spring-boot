package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "empresa")
@Data
public class Empresa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 13)
    private String rfc;

    @Column(name = "razon_social", nullable = false, length = 300)
    private String razonSocial;

    @Column(name = "regimen_fiscal", nullable = false, length = 5)
    private String regimenFiscal;

    @Column(name = "codigo_postal", nullable = false, length = 10)
    private String codigoPostal;

    @Column(length = 5)
    private String serie;

    @Column(name = "folio_actual")
    private Integer folioActual;

    
    @Column(name = "fel_usuario", length = 50)
    private String felUsuario;

    @Column(name = "fel_cuenta", length = 50)
    private String felCuenta;

    @Column(name = "fel_password", length = 100)
    private String felPassword;

   
    @Column(name = "fel_ambiente", length = 20)
    private String felAmbiente = "PRODUCCION";

    @Column(name = "fel_pin", length = 20)
    private String felPin;

   
    @Column(name = "fel_creditos_disponibles")
    private Integer felCreditosDisponibles;
    @Column(name = "direccion", length = 300)
    private String direccion;

    @Column(name = "colonia", length = 100)
    private String colonia;

    @Column(name = "municipio", length = 100)
    private String municipio;

    @Column(name = "estado", length = 50)
    private String estado;

    @Column(name = "telefono", length = 20)
    private String telefono;
}