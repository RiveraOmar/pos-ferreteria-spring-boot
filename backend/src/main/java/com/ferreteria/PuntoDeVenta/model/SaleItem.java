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

    // ── Producto LIBRE: descripción capturada en caja ────────────────────
    // Los libres usan el producto genérico (id -1, SKU "LIBRE"); sin este
    // campo, la descripción real ("Manguera 1/2") se perdía y el ticket,
    // el historial y las facturas mostraban solo "LIBRE".
    @Column(name = "custom_name", length = 200)
    private String customName;

    // BigDecimal para soportar fracciones (metros, kg, gramos, litros...)
    @Column(precision = 10, scale = 3)
    private BigDecimal quantity;

    private BigDecimal unitPrice;
    private BigDecimal costAtSale;
    private BigDecimal taxAmountPerUnit;
    private BigDecimal totalTaxItem;

    // ── Trazabilidad por producto (libreta de fiado) ──
    // Fecha en que se llevó ESTE producto (puede diferir de la fecha de la
    // nota cuando se agregan productos después) y quién lo llevó.
    @Column(name = "added_at")
    private LocalDateTime addedAt;

    @Column(name = "llevado_por", length = 150)
    private String llevadoPor;
}