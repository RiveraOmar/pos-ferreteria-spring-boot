package com.ferreteria.PuntoDeVenta.controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;

/**
 * Subida de imágenes de producto (foto de la cámara del celular o de galería).
 *
 * COMPRESIÓN AUTOMÁTICA: una foto de celular pesa 3-8 MB, pero para ver un
 * producto basta con ~1200 px y calidad alta → queda en 200-400 KB. Aquí se
 * reduce ANTES de guardarla. Beneficios: el disco dura años, las listas cargan
 * rápido en el celular, y los respaldos son ligeros. La foto original no se
 * conserva (no hace falta para un catálogo).
 *
 * El archivo se guarda en disco y se devuelve su URL; en la base de datos solo
 * viaja esa URL (nunca la imagen en sí).
 */
@Slf4j
@RestController
@RequestMapping("/api/uploads")
public class UploadController {

    @Value("${app.uploads.dir:uploads}")
    private String uploadsDir;

    /**
     * Ancho máximo de la foto guardada (px). 1600 permite hacer zoom y LEER
     * la letra chica de una etiqueta o una hoja de especificaciones, que es
     * justo para lo que sirven las fotos secundarias. Queda en ~350 KB.
     */
    @Value("${app.uploads.max-width:1600}")
    private int maxAncho;

    /** Calidad JPEG: 0.88 = se ve nítida al ampliar, sin archivos enormes. */
    @Value("${app.uploads.jpeg-quality:0.88}")
    private float calidad;

    private static final long MAX_BYTES = 12 * 1024 * 1024; // 12 MB de entrada

    @PostMapping("/producto-imagen")
    public ResponseEntity<Map<String, String>> subirImagen(
            @RequestParam("file") MultipartFile file) {

        if (file.isEmpty())
            return ResponseEntity.badRequest().body(Map.of("error", "Archivo vacío"));
        if (file.getSize() > MAX_BYTES)
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "La imagen supera 12 MB"));

        String tipo = file.getContentType();
        if (tipo == null || !tipo.startsWith("image/"))
            return ResponseEntity.badRequest()
                    .body(Map.of("error", "El archivo no es una imagen"));

        try {
            BufferedImage original = ImageIO.read(new ByteArrayInputStream(file.getBytes()));
            if (original == null)
                return ResponseEntity.badRequest()
                        .body(Map.of("error", "No se pudo leer la imagen (formato no soportado)"));

            BufferedImage procesada = redimensionar(original, maxAncho);

            String nombre = "prod_" + UUID.randomUUID().toString().substring(0, 12) + ".jpg";
            Path dir = Paths.get(uploadsDir).toAbsolutePath().normalize();
            Files.createDirectories(dir);
            Path destino = dir.resolve(nombre);

            guardarJpeg(procesada, destino, calidad);

            long kbAntes   = file.getSize() / 1024;
            long kbDespues = Files.size(destino) / 1024;
            log.info("[UPLOAD] {} — {} KB → {} KB ({}x{} px)",
                    nombre, kbAntes, kbDespues,
                    procesada.getWidth(), procesada.getHeight());

            Map<String, String> r = new HashMap<>();
            r.put("url", "/uploads/" + nombre);
            r.put("kb", String.valueOf(kbDespues));
            return ResponseEntity.ok(r);

        } catch (IOException e) {
            log.error("[UPLOAD] Error al procesar imagen", e);
            return ResponseEntity.internalServerError()
                    .body(Map.of("error", "No se pudo guardar la imagen: " + e.getMessage()));
        }
    }

    /** Reduce la imagen si es más ancha que el máximo, conservando proporción. */
    private BufferedImage redimensionar(BufferedImage origen, int anchoMax) {
        int w = origen.getWidth(), h = origen.getHeight();

        // Si la foto ya es más chica que el máximo NO se agranda: estirarla
        // solo la haría verse pixeleada sin ganar detalle.
        int nuevoW = w, nuevoH = h;
        if (w > anchoMax) {
            nuevoW = anchoMax;
            nuevoH = (int) Math.round(h * (anchoMax / (double) w));
        }

        // Fondo blanco: los PNG con transparencia se verían negros al pasar a JPEG
        BufferedImage salida = new BufferedImage(nuevoW, nuevoH, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = salida.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING,
                RenderingHints.VALUE_RENDER_QUALITY);
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON);
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, nuevoW, nuevoH);
        g.drawImage(origen, 0, 0, nuevoW, nuevoH, null);
        g.dispose();
        return salida;
    }

    /** Guarda como JPEG con la calidad indicada. */
    private void guardarJpeg(BufferedImage img, Path destino, float calidad) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpg");
        if (!writers.hasNext()) throw new IOException("Sin codificador JPEG disponible");
        ImageWriter writer = writers.next();

        try (ImageOutputStream out = ImageIO.createImageOutputStream(destino.toFile())) {
            writer.setOutput(out);
            ImageWriteParam param = writer.getDefaultWriteParam();
            if (param.canWriteCompressed()) {
                param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                param.setCompressionQuality(Math.max(0.5f, Math.min(1f, calidad)));
            }
            writer.write(null, new IIOImage(img, null, null), param);
        } finally {
            writer.dispose();
        }
    }

    /** Mensaje claro cuando la foto supera el límite de multipart de Spring. */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, String>> tamanoExcedido(
            MaxUploadSizeExceededException e) {
        log.warn("[UPLOAD] Foto rechazada por tamaño: {}", e.getMessage());
        return ResponseEntity.badRequest().body(Map.of(
                "error", "La foto es demasiado grande. Intenta con una imagen más ligera."));
    }
}