package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "catalogo_birlos_aplicaciones")
@Data
public class CatalogoBirloAplicacion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String  marca;        
    private String  aplicacion;   
    private Boolean delantero;
    private Boolean trasero;
    private String  anio;         
    private String  codigo;       
    private String  tuercas;      
    private Integer pagina;       
}