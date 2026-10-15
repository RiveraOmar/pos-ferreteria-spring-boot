package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

@Entity
@Table(name = "catalogo_birlos")
@Data
public class CatalogoBirlo {

    @Id
    private String codigo;                 

    private String tipo;                   
    private String lado;                   

    @Column(name = "estria_pulg")
    private BigDecimal estriaPulg;         

    @Column(name = "estria_mm")
    private BigDecimal estriaMm;           

    private String rosca;                 
    private String largo;                  
    private String medida;                 

    @Column(name = "pagina_catalogo")
    private Integer paginaCatalogo;
}