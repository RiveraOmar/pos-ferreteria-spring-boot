package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.model.CfdiTimbrado;
import com.ferreteria.PuntoDeVenta.model.Periodicidad;
import com.ferreteria.PuntoDeVenta.model.Sale;
import com.ferreteria.PuntoDeVenta.util.PeriodoFiscal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 *  TIMBRADO AUTOMÁTICO DE LA FACTURA GLOBAL — PERIODICIDAD CONFIGURABLE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 *  Corre UNA VEZ AL DÍA (hora fija en config/ferrepos.properties). No hace
 *  falta un cron distinto por periodicidad: cada día simplemente revisa
 *  qué periodos (según la periodicidad ACTUAL, la que el dueño configuró
 *  desde el front) ya cerraron y tienen ventas sin facturar, y los timbra.
 *
 *    • Periodicidad DIARIA   → cada corrida timbra el día de ayer.
 *    • Periodicidad SEMANAL  → timbra la semana pasada, solo el día
 *      siguiente a que termine (los lunes).
 *    • Periodicidad QUINCENAL → timbra la quincena que acaba de cerrar
 *      (días 1 y 16, aunque igual se revisa todos los días por si acaso).
 *    • Periodicidad MENSUAL  → timbra el mes que acaba de cerrar (día 1).
 *
 *  Si el dueño CAMBIA la periodicidad a medio periodo, las ventas ya
 *  agrupadas bajo la periodicidad vieja simplemente se re-agrupan la
 *  próxima vez que se calculan pendientes (no hay estado guardado por
 *  periodo, todo se deriva de las fechas de las ventas al vuelo).
 *
 *  El SAT da 72 horas después del cierre del periodo para expedir la
 *  global, así que correr una vez al día deja margen de sobra.
 *
 *  Configuración (config/ferrepos.properties):
 *    facturaglobal.auto.enabled=true
 *    facturaglobal.auto.cron=0 30 9 * * *
 *
 *  La PERIODICIDAD (diaria/semanal/quincenal/mensual) NO va aquí — se
 *  cambia desde el front en Facturación → Configurar periodicidad.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class FacturaGlobalScheduler {

    private final SaleService saleService;
    private final CfdiService cfdiService;
    private final ConfiguracionFacturacionService configuracionFacturacionService;

    @org.springframework.beans.factory.annotation.Value(
            "${facturaglobal.auto.enabled:true}")
    private boolean habilitado;

    // Corre todos los días a la misma hora — la periodicidad activa decide
    // sola qué periodo ya cerró y toca timbrar. Configurable en properties.
    @Scheduled(cron = "${facturaglobal.auto.cron:0 30 9 * * *}",
            zone = "America/Mazatlan")
    public void timbrarGlobalAutomatica() {
        if (!habilitado || !configuracionFacturacionService.autoTimbradoHabilitado()) {
            log.info("[GLOBAL-AUTO] Timbrado automático deshabilitado.");
            return;
        }

        Periodicidad tipo = configuracionFacturacionService.periodicidadActual();
        log.info("[GLOBAL-AUTO] Iniciando timbrado automático — periodicidad {}...",
                tipo.getNombre());

        List<CfdiTimbrado> emitidas = timbrarPeriodosPendientes(
                PeriodoFiscal.actual(tipo), true);

        log.info("[GLOBAL-AUTO] Corrida terminada — {} factura(s) global(es) "
                + "emitida(s).", emitidas.size());
    }

    /**
     * Timbra una global por cada periodo con ventas pendientes.
     *
     * @param referencia   periodo de referencia (normalmente el actual).
     * @param soloCerrados si true, NO timbra el periodo en curso — solo
     *                     los que ya cerraron. La corrida automática usa
     *                     true; el botón manual puede mandar false si el
     *                     usuario decide cerrar el periodo antes de tiempo.
     * @return las facturas globales emitidas.
     */
    public List<CfdiTimbrado> timbrarPeriodosPendientes(
            PeriodoFiscal referencia, boolean soloCerrados) {

        PeriodoFiscal ref = (referencia != null)
                ? referencia
                : saleService.periodoActualConfigurado();

        List<Sale> pendientes;
        try {
            pendientes = saleService.obtenerVentasPendientesGlobal(ref);
        } catch (Exception e) {
            log.error("[GLOBAL-AUTO] No se pudieron consultar las ventas "
                    + "pendientes: {}", e.getMessage(), e);
            return List.of();
        }

        if (pendientes.isEmpty()) {
            log.info("[GLOBAL-AUTO] Sin ventas pendientes de facturar.");
            return List.of();
        }

        // Agrupar por periodo (misma periodicidad que "ref") — cada uno va
        // en su propia global, porque InformacionGlobal lleva un solo Mes/Año.
        Map<PeriodoFiscal, List<Sale>> porPeriodo = pendientes.stream()
                .collect(Collectors.groupingBy(
                        v -> PeriodoFiscal.deLocalDateTime(ref.tipo(), v.getCreatedAt()),
                        TreeMap::new,
                        Collectors.toList()));

        List<CfdiTimbrado> emitidas = new ArrayList<>();

        for (Map.Entry<PeriodoFiscal, List<Sale>> grupo : porPeriodo.entrySet()) {
            PeriodoFiscal p = grupo.getKey();

            if (soloCerrados && !p.yaCerro()) {
                log.info("[GLOBAL-AUTO] El periodo {} aún no cierra ({} venta(s) "
                                + "pendientes). Se timbrará cuando cierre.",
                        p.etiqueta(), grupo.getValue().size());
                continue;
            }

            List<Long> ids = grupo.getValue().stream()
                    .map(Sale::getId).toList();
            try {
                CfdiTimbrado cfdi = cfdiService.timbrarFacturaGlobal(ids);
                emitidas.add(cfdi);
                log.info("[GLOBAL-AUTO] ✓ Global de {} timbrada — {} venta(s), "
                                + "total {}, UUID {}",
                        p.etiqueta(), ids.size(), cfdi.getTotal(), cfdi.getUuid());
            } catch (Exception e) {
                log.error("[GLOBAL-AUTO] ✗ Falló el timbrado de {} ({} venta(s)): {}. "
                                + "Las ventas siguen pendientes; se reintenta mañana "
                                + "o puedes timbrar manualmente desde Facturación CFDI.",
                        p.etiqueta(), ids.size(), e.getMessage());
            }
        }
        return emitidas;
    }
}
