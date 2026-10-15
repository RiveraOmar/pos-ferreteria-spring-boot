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

    // ── COMPRA POR BOLSA/CAJA, VENTA POR PIEZA ──────────────────────────────
    // Ej: bolsa de 100 tornillos a $150 → costo por pieza $1.50.
    // El inventario se lleva en PIEZAS; estos campos son informativos y
    // sirven para calcular el costo por pieza al registrar la compra.
    @Column(name = "compra_por_bolsa")
    private Boolean compraPorBolsa = false;

    @Column(name = "piezas_por_bolsa")
    private Integer piezasPorBolsa;          // ej. 100

    @Column(name = "costo_bolsa", precision = 12, scale = 2)
    private BigDecimal costoBolsa;           // ej. 150.00

    @Column(name = "precio_bolsa", precision = 12, scale = 2)
    private BigDecimal precioBolsa;          // venta de la bolsa completa (más barata
    // que sumar pieza por pieza) — ej. 200.00

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

    // BigDecimal: el stock mínimo de alerta también debe soportar fracciones
    // (ej. "avísame si quedan menos de 2.5 kg")
    @Column(name = "min_stock_level", precision = 10, scale = 3)
    private BigDecimal minStockLevel;

    // ── Campos SAT / CFDI ─────────────────────────────────────
    @Column(name = "sat_clave_prod_serv", length = 20)
    private String satClaveProdServ;

    @Column(name = "sat_clave_unidad", length = 20)
    private String satClaveUnidad;

    @Column(name = "sat_objeto_imp", length = 5)
    private String satObjetoImp;
    // ─────────────────────────────────────────────────────────


    @Column(name = "imagen_url", columnDefinition = "TEXT")
    private String imagenUrl;

    // ── Código de barras opcional ─────────────────────────────────────────────
    // NULL para productos sin código físico (tornillería suelta, productos que
    // se venden por kg/m/L). Listo para cuando agregues un escáner.
    @Column(name = "barcode", length = 50)
    private String barcode;

    // ── Auditoría ──────────────────────────────────────────────────────────────
    // Estos campos ya existían en la tabla SQL desde el inicio (DEFAULT
    // CURRENT_TIMESTAMP) pero el backend nunca los mapeaba. createdAt es
    // insertable=true/updatable=false porque solo se fija una vez. updatedAt
    // lo mantiene un trigger de PostgreSQL — no depende de que el código Java
    // se acuerde de tocarlo en cada update().
    @Column(name = "created_at", insertable = true, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;
}