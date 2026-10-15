-- ═══════════════════════════════════════════════════════════════════════════
--  V4 — CONFIGURACIÓN DE PERIODICIDAD DE LA FACTURA GLOBAL
-- ═══════════════════════════════════════════════════════════════════════════
--  Tabla de una sola fila (id=1) que guarda qué periodicidad está activa
--  (DIARIA, SEMANAL, QUINCENAL o MENSUAL). El dueño la cambia desde el
--  front en Facturación → Configurar periodicidad, sin tocar el servidor.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS configuracion_facturacion (
    id                        BIGINT PRIMARY KEY,
    periodicidad              VARCHAR(20) NOT NULL DEFAULT 'MENSUAL',
    auto_timbrado_habilitado  BOOLEAN     NOT NULL DEFAULT TRUE,
    actualizado_en            TIMESTAMP,
    actualizado_por           VARCHAR(100)
);

-- Fila única — por ahora el negocio solo necesita MENSUAL. Desde el front
-- (Facturación → ⚙️ Configurar periodicidad) se puede cambiar cuando quieras
-- sin tocar nada de esto.
INSERT INTO configuracion_facturacion (id, periodicidad, auto_timbrado_habilitado, actualizado_en, actualizado_por)
VALUES (1, 'MENSUAL', TRUE, NOW(), 'migración V4')
ON CONFLICT (id) DO UPDATE SET
    periodicidad    = 'MENSUAL',
    actualizado_en  = NOW(),
    actualizado_por = 'migración V4 (forzado a mensual)';
