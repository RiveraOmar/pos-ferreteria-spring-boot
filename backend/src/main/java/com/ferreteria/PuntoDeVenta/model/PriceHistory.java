package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "price_history")
@Data
@Builder // Útil para crear historiales rápidamente en el service
@NoArgsConstructor
@AllArgsConstructor
public class PriceHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY) // Lazy para mejor rendimiento
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(name = "old_price", precision = 19, scale = 2)
    private BigDecimal oldPrice;

    @Column(name = "new_price", precision = 19, scale = 2, nullable = false)
    private BigDecimal newPrice;

    @Column(name = "change_date", nullable = false)
    private LocalDateTime changeDate;

    // Método que se ejecuta automáticamente antes de insertar
    @PrePersist
    protected void onCreate() {
        if (this.changeDate == null) {
            this.changeDate = LocalDateTime.now();
        }
    }
}