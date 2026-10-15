package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.service.GeminiService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/ia")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class GeminiController {

    private final GeminiService geminiService;

    @Operation(summary = "Consulta de compatibilidades/equivalencias usando IA (Gemini)")
    @PostMapping("/buscar-compatibilidad")
    public ResponseEntity<Map<String, String>> buscar(
            @RequestBody Map<String, String> body) {

        String pregunta = body.get("pregunta");

        if (pregunta == null || pregunta.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "El campo 'pregunta' es obligatorio."));
        }

        String respuesta = geminiService.consultarCompatibilidad(pregunta);
        return ResponseEntity.ok(Map.of("respuesta", respuesta));
    }
}