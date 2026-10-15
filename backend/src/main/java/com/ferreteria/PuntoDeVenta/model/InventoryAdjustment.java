package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;


@Entity
@Table(name = "inventory_adjustments")
@Data
@NoArgsConstructor
public class InventoryAdjustment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "cantidad_antes", nullable = false, precision = 10, scale = 3)
    private BigDecimal cantidadAntes;

    @Column(name = "cantidad_despues", nullable = false, precision = 10, scale = 3)
    private BigDecimal cantidadDespues;

    
    @Column(name = "diferencia", nullable = false, precision = 10, scale = 3)
    private BigDecimal diferencia;

    @Column(name = "motivo", nullable = false, length = 40)
    private String motivo;

    @Column(name = "nota", length = 300)
    private String nota;

    @Column(name = "usuario", length = 100)
    private String usuario;

    @Column(name = "fecha", nullable = false)
    private LocalDateTime fecha = LocalDateTime.now();
}