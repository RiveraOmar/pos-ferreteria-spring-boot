package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.model.CfdiTimbrado;
import com.ferreteria.PuntoDeVenta.service.CfdiService;
import com.ferreteria.PuntoDeVenta.service.FacturaGlobalScheduler;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cfdi")
@RequiredArgsConstructor
@CrossOrigin(origins = "*", allowedHeaders = "*",
        methods = {RequestMethod.GET, RequestMethod.POST,
                RequestMethod.PATCH, RequestMethod.OPTIONS})
@Tag(name = "CFDI", description = "Facturación electrónica SAT CFDI 4.0 — FEL Premium / Blikon")
public class CfdiController {

    private final CfdiService cfdiService;
    private final FacturaGlobalScheduler facturaGlobalService;
    private final com.ferreteria.PuntoDeVenta.service.SaleService saleService;

    @Operation(summary = "Ver XML SOAP que se enviaría a FEL — sin timbrar")
    @GetMapping("/preview/{saleId}")
    public ResponseEntity<String> preview(@PathVariable Long saleId) {
        return ResponseEntity.ok(cfdiService.previewXmlSoap(saleId));
    }

    @Operation(summary = "Timbrar Factura Global de Público General")
    @PostMapping("/timbrar/factura-global")
    public ResponseEntity<?> timbrarFacturaGlobal(
            @RequestBody Map<String, List<Long>> body) {
        try {
            List<Long> saleIds = body.getOrDefault("saleIds", List.of());
            CfdiTimbrado cfdi = cfdiService.timbrarFacturaGlobal(saleIds);
            return ResponseEntity.ok(Map.of(
                    "uuid",    cfdi.getUuid(),
                    "folio",   cfdi.getFolio() != null ? cfdi.getFolio() : "",
                    "total",   cfdi.getTotal(),
                    "status",  cfdi.getStatus(),
                    "mensaje", "Factura Global timbrada correctamente"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

   
    @Operation(summary = "Timbrar la global de todos los periodos pendientes")
    @PostMapping("/timbrar/factura-global/periodo")
    public ResponseEntity<?> timbrarGlobalPeriodo(
            @RequestParam(required = false) String periodo,
            @RequestParam(defaultValue = "false") boolean incluirPeriodoEnCurso) {
        try {
            com.ferreteria.PuntoDeVenta.util.PeriodoFiscal p =
                    (periodo == null || periodo.isBlank())
                            ? saleService.periodoActualConfigurado()
                            : com.ferreteria.PuntoDeVenta.util.PeriodoFiscal.parse(periodo);

            List<CfdiTimbrado> emitidas = facturaGlobalService
                    .timbrarPeriodosPendientes(p, !incluirPeriodoEnCurso);

            if (emitidas.isEmpty())
                return ResponseEntity.ok(Map.of(
                        "emitidas", 0,
                        "facturas", List.of(),
                        "mensaje", "No había periodos cerrados con ventas pendientes."));

            return ResponseEntity.ok(Map.of(
                    "emitidas", emitidas.size(),
                    "facturas", emitidas.stream().map(c -> Map.of(
                            "uuid",  c.getUuid(),
                            "folio", c.getFolio() != null ? c.getFolio() : "",
                            "total", c.getTotal(),
                            "receptor", c.getNombreReceptor() != null
                                    ? c.getNombreReceptor() : ""
                    )).toList(),
                    "mensaje", " " + emitidas.size()
                            + " factura(s) global(es) timbrada(s)"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

     @PostMapping("/timbrar/venta/{saleId}")
    public ResponseEntity<?> timbrarVenta(@PathVariable Long saleId) {
        try {
            CfdiTimbrado cfdi = cfdiService.timbrarVenta(saleId);
            return ResponseEntity.ok(Map.of(
                    "uuid",   cfdi.getUuid(),
                    "folio",  cfdi.getFolio() != null ? cfdi.getFolio() : "",
                    "total",  cfdi.getTotal(),
                    "status", cfdi.getStatus(),
                    "mensaje", " CFDI timbrado correctamente"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

   @Operation(summary = "Timbrar una pre-factura con CFDI 4.0 via FEL Premium")
    @PostMapping("/timbrar/prefactura/{prefacturaId}")
    public ResponseEntity<?> timbrarPrefactura(@PathVariable Long prefacturaId) {
        try {
            CfdiTimbrado cfdi = cfdiService.timbrarPrefactura(prefacturaId);
            return ResponseEntity.ok(Map.of(
                    "uuid",   cfdi.getUuid(),
                    "folio",  cfdi.getFolio() != null ? cfdi.getFolio() : "",
                    "total",  cfdi.getTotal(),
                    "status", cfdi.getStatus(),
                    "mensaje", "✅ CFDI timbrado correctamente"
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

   @Operation(summary = "Cancelar un CFDI por UUID")
    @PatchMapping("/cancelar/{uuid}")
    public ResponseEntity<?> cancelar(
            @PathVariable String uuid,
            @RequestBody Map<String, String> body) {
        try {
            cfdiService.cancelarCfdi(uuid, body.getOrDefault("motivo", "02"));
            return ResponseEntity.ok(Map.of(
                    "mensaje", "Solicitud de cancelación enviada al SAT."
            ));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Obtener el CFDI timbrado de una venta")
    @GetMapping("/venta/{saleId}")
    public ResponseEntity<?> porVenta(@PathVariable Long saleId) {
        return cfdiService.buscarPorSale(saleId)
                .map(ResponseEntity::ok)
                .<ResponseEntity<?>>map(r -> r)
                .orElse(ResponseEntity.notFound().build());
    }

   @Operation(summary = "Listar todos los CFDIs vigentes")
    @GetMapping("/vigentes")
    public List<CfdiTimbrado> vigentes() {
        return cfdiService.listarVigentes();
    }

    @Operation(summary = "Listar todos los CFDIs con detalle completo")
    @GetMapping("/todos")
    public List<Map<String, Object>> todos() {
        return cfdiService.listarTodos();
    }

    @Operation(summary = "Detalle de factura global — tickets que la integran con sus productos")
    @GetMapping("/global/{cfdiId}/tickets")
    public ResponseEntity<?> ticketsDeGlobal(@PathVariable Long cfdiId) {
        try {
            return ResponseEntity.ok(cfdiService.detalleFacturaGlobal(cfdiId));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @Operation(summary = "Obtener el XML timbrado de un CFDI por UUID")
    @GetMapping(value = "/xml/{uuid}", produces = "application/xml")
    public ResponseEntity<?> xml(@PathVariable String uuid) {
        try {
            return ResponseEntity.ok()
                    .header("Content-Disposition",
                            "inline; filename=\"CFDI-" + uuid + ".xml\"")
                    .body(cfdiService.obtenerXml(uuid));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", e.getMessage()));
        }
    }

    @RequestMapping(value = "/**", method = RequestMethod.OPTIONS)
    public ResponseEntity<?> options() {
        return ResponseEntity.ok().build();
    }
}