CREATE VIEW view_low_stock AS
SELECT p.id, p.sku, p.name, i.stock_actual, i.stock_minimo
FROM products p
JOIN inventory i ON p.id = i.product_id
WHERE i.stock_actual <= i.stock_minimo AND p.is_active = TRUE;