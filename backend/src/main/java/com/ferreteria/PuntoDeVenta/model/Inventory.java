package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "inventory")
@Data
@NoArgsConstructor
public class Inventory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "stock_actual", nullable = false, precision = 10, scale = 3)
    private BigDecimal stockActual = BigDecimal.ZERO;

    @Column(name = "stock_minimo", nullable = false, precision = 10, scale = 3)
    private BigDecimal stockMinimo = new BigDecimal("5");

    @Column(name = "location_rack")
    private String locationRack;

    @Column(name = "last_restock")
    private LocalDateTime lastRestock;

    public boolean isLowStock() {
        return this.stockActual.compareTo(this.stockMinimo) <= 0;
    }
}