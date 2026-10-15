package com.ferreteria.PuntoDeVenta.model;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "customers")
@Data
public class Customer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "full_name", nullable = false)
    private String fullName;

    private String rfc;
    private String email;

    @Column(name = "phone_number")
    private String phoneNumber;

    private String address;
    private String city;

    @Column(name = "customer_type")
    private String customerType;

    @Column(name = "discount_rate")
    private BigDecimal discountRate;

    @Column(name = "created_at")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;

    private Boolean active;

    // ── Datos fiscales SAT / CFDI ─────────────────────────────
    @Column(name = "razon_social", length = 300)
    private String razonSocial;

    @Column(name = "regimen_fiscal", length = 5)
    private String regimenFiscal;

    @Column(name = "uso_cfdi", length = 10)
    private String usoCfdi;

    @Column(name = "codigo_postal", length = 10)
    private String codigoPostal;

    @Column(name = "sat_pais", length = 5)
    private String satPais;
    // ─────────────────────────────────────────────────────────

    @OneToMany(mappedBy = "customer")
    @JsonIgnore
    private List<Sale> sales;
}