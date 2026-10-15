package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;

/** Aplicación vehicular de un birlo (marca/modelo/años → código). */
@Entity
@Table(name = "catalogo_birlos_aplicaciones")
@Data
public class CatalogoBirloAplicacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String  marca;        // CHRYSLER, FORD, GM, ... EXTRAPESADO
    private String  aplicacion;   // modelo/uso: "ATOS BY DODGE", "EJE ROCKWELL"
    private Boolean delantero;
    private Boolean trasero;
    private String  anio;         // "05/13", "TODOS" o vacío
    private String  codigo;       // BRxx-xxxYZ (puede no tener especificación)
    private String  tuercas;      // tuercas compatibles
    private Integer pagina;       // página impresa del catálogo
}