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
