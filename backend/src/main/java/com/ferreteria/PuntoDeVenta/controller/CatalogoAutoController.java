package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.model.CatalogoAutoAplicacion;
import com.ferreteria.PuntoDeVenta.repository.CatalogoAutoRepository;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.List;
@RestController
@RequestMapping("/api/catalogo-auto")
@RequiredArgsConstructor
public class CatalogoAutoController {

    private final CatalogoAutoRepository repo;

    @Operation(summary = "Marcas disponibles")
    @GetMapping("/marcas")
    public List<String> marcas() { return repo.marcas(); }

    @Operation(summary = "Modelos de una marca")
    @GetMapping("/modelos")
    public List<String> modelos(@RequestParam String marca) {
        return repo.modelosDeMarca(marca);
    }

    @Operation(summary = "Buscar por vehículo (marca + modelo) o por número de parte")
    @GetMapping("/buscar")
    public List<CatalogoAutoAplicacion> buscar(
            @RequestParam(required = false) String marca,
            @RequestParam(required = false, defaultValue = "") String modelo,
            @RequestParam(required = false) String parte) {

        if (parte != null && !parte.isBlank())
            return repo.findByParteIgnoreCaseOrderByMarcaAscModeloAsc(parte.trim());
        if (marca != null && !marca.isBlank())
            return repo.findByMarcaIgnoreCaseAndModeloContainingIgnoreCaseOrderByModeloAscAnioDesdeAsc(
                    marca, modelo);
        if (!modelo.isBlank())
            return repo.findByModeloContainingIgnoreCaseOrderByMarcaAscModeloAsc(modelo);
        return List.of();
    }
}