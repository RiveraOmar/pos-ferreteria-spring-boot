CREATE TABLE sale_items (
    id BIGSERIAL PRIMARY KEY,
    sale_id BIGINT REFERENCES sales(id),
    product_id BIGINT REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price NUMERIC(12, 2) NOT NULL, -- Precio al que se vendió en ese momento
    cost_at_sale NUMERIC(12, 2) NOT NULL  -- Costo codificado en ese momento (para reportes de utilidad)
);