package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * Configuración de la Factura Global — UNA SOLA FILA (id=1) que el dueño
 * cambia desde el front en Facturación → Configurar periodicidad, sin tocar
 * archivos ni reiniciar el servidor.
 */
@Entity
@Table(name = "configuracion_facturacion")
@Data
public class ConfiguracionFacturacion {

    @Id
    private Long id; // siempre 1 — fila única

    @Enumerated(EnumType.STRING)
    @Column(name = "periodicidad", nullable = false, length = 20)
    private Periodicidad periodicidad = Periodicidad.MENSUAL;

    @Column(name = "auto_timbrado_habilitado", nullable = false)
    private boolean autoTimbradoHabilitado = true;

    @Column(name = "actualizado_en")
    private LocalDateTime actualizadoEn;

    @Column(name = "actualizado_por", length = 100)
    private String actualizadoPor;
}
