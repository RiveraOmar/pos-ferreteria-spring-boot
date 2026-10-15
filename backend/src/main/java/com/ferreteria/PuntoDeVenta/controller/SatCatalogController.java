package com.ferreteria.PuntoDeVenta.controller;

import io.swagger.v3.oas.annotations.Operation;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/sat")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class SatCatalogController {

    private final EntityManager em;

    @Operation(summary = "Buscar clave producto/servicio SAT por descripción")
    @GetMapping("/productos/buscar")
    public List<?> buscarProductoSat(@RequestParam String q) {
        return em.createNativeQuery(
                        "SELECT clave, descripcion FROM sat_clave_prod_serv " +
                                "WHERE descripcion ILIKE :q ORDER BY descripcion LIMIT 20")
                .setParameter("q", "%" + q + "%")
                .getResultList();
    }

    @Operation(summary = "Listar unidades de medida SAT más comunes")
    @GetMapping("/unidades")
    public List<?> getUnidades() {
        return em.createNativeQuery(
                        "SELECT clave, nombre, simbolo FROM sat_clave_unidad ORDER BY nombre")
                .getResultList();
    }

    @Operation(summary = "Buscar unidades por nombre")
    @GetMapping("/unidades/buscar")
    public List<?> buscarUnidad(@RequestParam String q) {
        return em.createNativeQuery(
                        "SELECT clave, nombre, simbolo FROM sat_clave_unidad " +
                                "WHERE nombre ILIKE :q ORDER BY nombre LIMIT 20")
                .setParameter("q", "%" + q + "%")
                .getResultList();
    }

    @Operation(summary = "Listar regímenes fiscales SAT")
    @GetMapping("/regimenes")
    public List<?> getRegimenes() {
        return em.createNativeQuery(
                        "SELECT clave, descripcion, aplica_fisica, aplica_moral " +
                                "FROM sat_regimen_fiscal ORDER BY clave")
                .getResultList();
    }

    @Operation(summary = "Listar usos de CFDI SAT")
    @GetMapping("/usos-cfdi")
    public List<?> getUsosCfdi() {
        return em.createNativeQuery(
                        "SELECT clave, descripcion, aplica_fisica, aplica_moral " +
                                "FROM sat_uso_cfdi ORDER BY clave")
                .getResultList();
    }

    @Operation(summary = "Listar objetos de impuesto SAT")
    @GetMapping("/objeto-imp")
    public List<?> getObjetoImp() {
        return em.createNativeQuery(
                        "SELECT clave, descripcion FROM sat_objeto_imp ORDER BY clave")
                .getResultList();
    }

    @Operation(summary = "Listar países SAT")
    @GetMapping("/paises")
    public List<?> getPaises() {
        return em.createNativeQuery(
                        "SELECT clave, descripcion FROM sat_pais ORDER BY descripcion")
                .getResultList();
    }

    @Operation(summary = "Listar monedas SAT")
    @GetMapping("/monedas")
    public List<?> getMonedas() {
        return em.createNativeQuery(
                        "SELECT clave, descripcion FROM sat_moneda ORDER BY descripcion")
                .getResultList();
    }
}