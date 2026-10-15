package com.ferreteria.PuntoDeVenta.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.hypersistence.utils.hibernate.type.json.JsonBinaryType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.Type;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@Entity
@Table(name = "products")
@Data
@NoArgsConstructor
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 50)
    private String sku;

    @Column(nullable = false, length = 200)
    private String name;

    private String description;

    @Column(name = "list_price", precision = 12, scale = 2)
    private BigDecimal listPrice;

    @Column(name = "cost_price", precision = 12, scale = 2)
    private BigDecimal costPrice;

    @Column(name = "min_price", precision = 12, scale = 2)
    private BigDecimal minPrice;

    
    @Column(name = "compra_por_bolsa")
    private Boolean compraPorBolsa = false;

    @Column(name = "piezas_por_bolsa")
    private Integer piezasPorBolsa;          

    @Column(name = "costo_bolsa", precision = 12, scale = 2)
    private BigDecimal costoBolsa;          

    @Column(name = "precio_bolsa", precision = 12, scale = 2)
    private BigDecimal precioBolsa;         

    @Type(JsonBinaryType.class)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> attributes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "category_id")
    private Category category;

    @Column(name = "tax_rate", precision = 5, scale = 4)
    private BigDecimal taxRate;

    @Column(name = "is_active")
    private boolean active = true;

    
    @Column(name = "min_stock_level", precision = 10, scale = 3)
    private BigDecimal minStockLevel;

    @Column(name = "sat_clave_prod_serv", length = 20)
    private String satClaveProdServ;

    @Column(name = "sat_clave_unidad", length = 20)
    private String satClaveUnidad;

    @Column(name = "sat_objeto_imp", length = 5)
    private String satObjetoImp;


    @Column(name = "imagen_url", columnDefinition = "TEXT")
    private String imagenUrl;

   
    @Column(name = "barcode", length = 50)
    private String barcode;

   
    @Column(name = "created_at", insertable = true, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}