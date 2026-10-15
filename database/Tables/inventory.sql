CREATE TABLE inventory (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT UNIQUE REFERENCES products(id) ON DELETE CASCADE,
    stock_actual INTEGER NOT NULL DEFAULT 0,
    stock_minimo INTEGER NOT NULL DEFAULT 5, -- Umbral para stock bajo
    location_rack VARCHAR(50), -- Ejemplo: Pasillo A, Estante 4
    last_restock TIMESTAMP WITH TIME ZONE
);