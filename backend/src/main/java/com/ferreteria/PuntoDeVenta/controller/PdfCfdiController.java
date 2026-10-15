package com.ferreteria.PuntoDeVenta.controller;

import com.ferreteria.PuntoDeVenta.service.PdfCfdiService;
import io.swagger.v3.oas.annotations.Operation;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Base64;
import java.util.Map;

@RestController
@RequestMapping("/api/cfdi")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class PdfCfdiController {

    private final PdfCfdiService pdfCfdiService;

    @Operation(summary = "Descargar PDF de un CFDI timbrado")
    @GetMapping("/pdf/{uuid}")
    public ResponseEntity<byte[]> descargarPdf(@PathVariable String uuid) {
        String base64 = pdfCfdiService.generarPdfBase64(uuid);
        byte[] pdfBytes = Base64.getDecoder().decode(base64);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"CFDI-" + uuid.substring(0, 8) + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    @Operation(summary = "Obtener PDF de un CFDI en base64")
    @GetMapping("/pdf/base64/{uuid}")
    public ResponseEntity<Map<String, String>> obtenerPdfBase64(@PathVariable String uuid) {
        String base64 = pdfCfdiService.generarPdfBase64(uuid);
        return ResponseEntity.ok(Map.of("pdfBase64", base64, "uuid", uuid));
    }
}