package com.ferreteria.PuntoDeVenta.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "sale_items")
@Data
public class SaleItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JsonIgnoreProperties("items")
    @JoinColumn(name = "sale_id")
    private Sale sale;

    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    
    @Column(name = "custom_name", length = 200)
    private String customName;

    @Column(precision = 10, scale = 3)
    private BigDecimal quantity;

    private BigDecimal unitPrice;
    private BigDecimal costAtSale;
    private BigDecimal taxAmountPerUnit;
    private BigDecimal totalTaxItem;

    @Column(name = "added_at")
    private LocalDateTime addedAt;

    @Column(name = "llevado_por", length = 150)
    private String llevadoPor;
}