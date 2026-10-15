package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;

/** Especificación de un birlo del catálogo Internacionales León. */
@Entity
@Table(name = "catalogo_birlos")
@Data
public class CatalogoBirlo {

    @Id
    private String codigo;                 // BR20-069RP

    private String tipo;                   // E = Estría, H = Hombro
    private String lado;                   // R = Derecho, L = Izquierdo

    @Column(name = "estria_pulg")
    private BigDecimal estriaPulg;         // Ø de estría en pulgadas

    @Column(name = "estria_mm")
    private BigDecimal estriaMm;           // Ø de estría en milímetros

    private String rosca;                  // 'M12 x 1.5' o '1/2"-20 hilos'
    private String largo;                  // '45.50 mm' o '1.968"'
    private String medida;                 // texto completo del catálogo

    @Column(name = "pagina_catalogo")
    private Integer paginaCatalogo;
}