package com.ferreteria.PuntoDeVenta.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonManagedReference;
import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "sales")
@Data
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Sale {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "invoice_number")
    private String invoiceNumber;

    // ── Quién compró ──────────────────────────────────────
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "customer_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
    private Customer customer;

    // ── Quién vendió (empleado) ───────────────────────────
    // Por ahora lo dejamos como String simple hasta tener tabla de empleados
    @Column(name = "seller_name", length = 100)
    private String sellerName;

    @Column(name = "total_amount", precision = 12, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "tax_amount", precision = 12, scale = 2)
    private BigDecimal taxAmount;

    @Column(name = "payment_method", length = 30)
    private String paymentMethod; // EFECTIVO, TARJETA, TRANSFERENCIA

    @Column(name = "amount_received", precision = 12, scale = 2)
    private BigDecimal amountReceived; // cuánto pagó

    @Column(name = "change_given", precision = 12, scale = 2)
    private BigDecimal changeGiven; // cambio entregado

    private String status; // COMPLETED, CANCELLED

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "cancelled_at")
    private LocalDateTime cancelledAt;

    @Column(name = "cancel_reason")
    private String cancelReason;

    @Column(name = "incluido_factura_global")
    private Boolean incluidoFacturaGlobal = false;

    // ── Trazabilidad: a QUÉ factura global pertenece esta venta ──────────
    // Permite reconstruir la cadena: Factura Global → tickets → productos,
    // que es el respaldo que pide el SAT en auditorías (guía CFDI global).
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cfdi_global_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler",
            "sale", "prefactura", "xmlTimbrado", "pdfBase64"})
    private CfdiTimbrado cfdiGlobal;

    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<SaleItem> items = new ArrayList<>();
}