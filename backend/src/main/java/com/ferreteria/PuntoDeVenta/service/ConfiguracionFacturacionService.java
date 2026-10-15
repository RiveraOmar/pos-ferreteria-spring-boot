package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.model.ConfiguracionFacturacion;
import com.ferreteria.PuntoDeVenta.model.Periodicidad;
import com.ferreteria.PuntoDeVenta.repository.ConfiguracionFacturacionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

/**
 * Configuración de la Factura Global — fila única (id=1). Se lee en cada
 * timbrado/consulta, así que un cambio del dueño en el front aplica de
 * inmediato, sin reiniciar el servidor.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ConfiguracionFacturacionService {

    private static final Long ID_UNICO = 1L;

    private final ConfiguracionFacturacionRepository repository;

    /** Si no existe la fila (instalación nueva), la crea con MENSUAL por default. */
    @Transactional
    public ConfiguracionFacturacion obtener() {
        return repository.findById(ID_UNICO).orElseGet(() -> {
            ConfiguracionFacturacion c = new ConfiguracionFacturacion();
            c.setId(ID_UNICO);
            c.setPeriodicidad(Periodicidad.MENSUAL);
            c.setAutoTimbradoHabilitado(true);
            c.setActualizadoEn(LocalDateTime.now());
            c.setActualizadoPor("sistema (default inicial)");
            log.info("[CONFIG-FACTURACION] Sin configuración previa — se crea "
                    + "con periodicidad MENSUAL por default.");
            return repository.save(c);
        });
    }

    public Periodicidad periodicidadActual() {
        return obtener().getPeriodicidad();
    }

    public boolean autoTimbradoHabilitado() {
        return obtener().isAutoTimbradoHabilitado();
    }

    @Transactional
    public ConfiguracionFacturacion actualizar(
            Periodicidad nuevaPeriodicidad, Boolean autoHabilitado, String usuario) {

        ConfiguracionFacturacion c = obtener();
        Periodicidad anterior = c.getPeriodicidad();

        if (nuevaPeriodicidad != null) c.setPeriodicidad(nuevaPeriodicidad);
        if (autoHabilitado != null)    c.setAutoTimbradoHabilitado(autoHabilitado);
        c.setActualizadoEn(LocalDateTime.now());
        c.setActualizadoPor(usuario != null ? usuario : "desconocido");

        ConfiguracionFacturacion guardada = repository.save(c);

        if (nuevaPeriodicidad != null && nuevaPeriodicidad != anterior)
            log.info("[CONFIG-FACTURACION] Periodicidad cambiada de {} a {} por {}. "
                            + "Las ventas pendientes se re-agrupan automáticamente "
                            + "según la nueva periodicidad la próxima vez que se consulten.",
                    anterior, nuevaPeriodicidad, guardada.getActualizadoPor());

        return guardada;
    }
}
