package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;


@Entity
@Table(name = "configuracion_facturacion")
@Data
public class ConfiguracionFacturacion {

    @Id
    private Long id;

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
