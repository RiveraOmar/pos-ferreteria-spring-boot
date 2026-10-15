package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Un ajuste manual de inventario: cuando el stock del sistema no coincide con
 * lo que hay en el anaquel y alguien lo corrige a mano.
 *
 * Existe por una razón concreta: bajar el stock sin dejar rastro sería la
 * forma más limpia de tapar un faltante. Aquí queda cuánto había, cuánto
 * quedó, por qué y quién lo hizo. Nunca se borra ni se edita.
 */
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

    /** Negativa cuando se bajó stock. Se guarda calculada para no tener que
     *  restarla en cada consulta del reporte de mermas. */
    @Column(name = "diferencia", nullable = false, precision = 10, scale = 3)
    private BigDecimal diferencia;

    /** CONTEO_FISICO, MERMA, ROBO, ERROR_CAPTURA, DEVOLUCION_PROVEEDOR, OTRO */
    @Column(name = "motivo", nullable = false, length = 40)
    private String motivo;

    @Column(name = "nota", length = 300)
    private String nota;

    @Column(name = "usuario", length = 100)
    private String usuario;

    @Column(name = "fecha", nullable = false)
    private LocalDateTime fecha = LocalDateTime.now();
}