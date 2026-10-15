-- ═══════════════════════════════════════════════════════════════════════════
--  V3 — EXISTENCIAS PARA TODO EL CATÁLOGO (100 piezas)
-- ═══════════════════════════════════════════════════════════════════════════
--  Alternativa por SQL al botón "Cargar existencias" de la pantalla Productos
--  (POST /api/inventory/stock-masivo). Útil para una instalación nueva o para
--  correrlo directo en la base sin abrir el sistema.
--
--  ⚠️  Este script PISA el stock actual. Si ya llevas conteos reales, corre
--      solo el PASO 1 (da de alta a los que no tienen renglón) y deja el
--      PASO 2 comentado, o usa el botón con "solo los que están en cero".
--
--  ⚠️  A diferencia del botón, esto NO deja registro en inventory_adjustments.
--      Si quieres la bitácora completa, usa el botón del sistema.
--
--  Respalda antes:  pg_dump -U postgres ferreteria > respaldo.sql
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── PASO 1: alta del renglón de inventario a los productos que no lo tienen ──
-- Sin renglón en `inventory` el producto no se puede vender: el sistema no
-- encuentra sus existencias y la venta se rechaza.
INSERT INTO inventory (product_id, stock_actual, stock_minimo, last_restock)
SELECT p.id,
       100,
       COALESCE(p.min_stock_level, 5),
       NOW()
FROM products p
WHERE p.is_active = TRUE
  AND NOT EXISTS (SELECT 1 FROM inventory i WHERE i.product_id = p.id);

-- ── PASO 2: dejar en 100 los que YA tenían renglón ──────────────────────────
-- Quita el comentario para aplicarlo.
-- Tal como está, solo sube los que están en cero (modo seguro).
UPDATE inventory i
SET stock_actual = 100,
    last_restock = NOW()
FROM products p
WHERE p.id = i.product_id
  AND p.is_active = TRUE
  AND i.stock_actual <= 0;          --  ← borra esta línea para pisar TODOS

COMMIT;

-- ── Verificación ────────────────────────────────────────────────────────────
-- SELECT COUNT(*) AS productos_activos FROM products WHERE is_active;
-- SELECT COUNT(*) AS con_100 FROM inventory WHERE stock_actual = 100;
-- SELECT p.sku, p.name, i.stock_actual
--   FROM products p LEFT JOIN inventory i ON i.product_id = p.id
--  WHERE p.is_active ORDER BY i.stock_actual NULLS FIRST LIMIT 20;
