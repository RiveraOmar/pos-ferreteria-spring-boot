package com.ferreteria.PuntoDeVenta.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "cfdi_timbrados")
@Data
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class CfdiTimbrado {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sale_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer","handler"})
    private Sale sale;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "prefactura_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer","handler"})
    private Prefactura prefactura;

    @Column(nullable = false, unique = true, length = 40)
    private String uuid;

    @Column(length = 5)
    private String serie;

    @Column(length = 20)
    private String folio;

    @Column(name = "fecha_timbrado", nullable = false)
    private LocalDateTime fechaTimbrado = LocalDateTime.now();

    @Column(name = "xml_timbrado", columnDefinition = "TEXT")
    private String xmlTimbrado;

    @Column(name = "pdf_base64", columnDefinition = "TEXT")
    private String pdfBase64;

    @Column(name = "cbb_url", length = 500)
    private String cbbUrl;

    @Column(name = "rfc_receptor", length = 13)
    private String rfcReceptor;

    @Column(name = "nombre_receptor", length = 300)
    private String nombreReceptor;

    @Column(precision = 12, scale = 2)
    private BigDecimal total;

    @Column(nullable = false, length = 20)
    private String status = "VIGENTE";

    @Column(name = "cancelado_at")
    private LocalDateTime canceladoAt;

    @Column(name = "cancel_reason")
    private String cancelReason;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();
}