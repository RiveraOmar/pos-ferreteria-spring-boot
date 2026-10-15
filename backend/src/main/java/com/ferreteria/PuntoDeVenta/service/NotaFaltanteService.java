package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.exception.ResourceNotFoundException;
import com.ferreteria.PuntoDeVenta.model.NotaFaltante;
import com.ferreteria.PuntoDeVenta.repository.NotaFaltanteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * La libreta de apuntes de Faltantes: cosas que hacen falta pero no están
 * en el catálogo. Texto libre — sin la validación estricta de un producto
 * real, porque aquí el punto es anotar rápido, no capturar con precisión.
 */
@Service
@RequiredArgsConstructor
public class NotaFaltanteService {

    private final NotaFaltanteRepository repo;

    @Transactional(readOnly = true)
    public List<NotaFaltante> listar() {
        return repo.findAllByOrderByCreatedAtDesc();
    }

    @Transactional
    public NotaFaltante crear(String texto, String autor) {
        if (texto == null || texto.isBlank()) {
            throw new IllegalArgumentException("La nota no puede estar vacía.");
        }
        if (texto.length() > 300) {
            throw new IllegalArgumentException("La nota es demasiado larga (máximo 300 caracteres).");
        }
        NotaFaltante n = new NotaFaltante();
        n.setTexto(texto.trim());
        n.setAutor(autor != null && !autor.isBlank() ? autor.trim() : null);
        return repo.save(n);
    }

    @Transactional
    public NotaFaltante marcarResuelta(Long id, boolean resuelta) {
        NotaFaltante n = repo.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Nota no encontrada: " + id));
        // Evita marcar dos veces lo mismo sin avisar — mismo criterio que
        // ya usamos en el resto del sistema para no dar "éxitos" silenciosos.
        if (n.getResuelta().equals(resuelta)) {
            throw new IllegalStateException(
                    resuelta ? "Esta nota ya estaba marcada como resuelta."
                             : "Esta nota ya estaba pendiente.");
        }
        n.setResuelta(resuelta);
        n.setResolvedAt(resuelta ? LocalDateTime.now() : null);
        return repo.save(n);
    }

    @Transactional
    public void eliminar(Long id) {
        if (!repo.existsById(id)) {
            throw new ResourceNotFoundException("Nota no encontrada: " + id);
        }
        repo.deleteById(id);
    }
}