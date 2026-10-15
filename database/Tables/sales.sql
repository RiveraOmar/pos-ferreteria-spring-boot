CREATE TABLE sales (
    id BIGSERIAL PRIMARY KEY,
    invoice_number VARCHAR(20) UNIQUE NOT NULL, -- Número de factura/ticket
    total_amount NUMERIC(12, 2) NOT NULL,
    tax_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'COMPLETED', -- COMPLETED, CANCELLED
    seller_id VARCHAR(50), 
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Columna para marcar ventas ya incluidas en una factura global diaria
ALTER TABLE sales ADD COLUMN IF NOT EXISTS incluido_factura_global BOOLEAN DEFAULT FALSE;

-- Opcional: poblar seller_name en registros viejos con un nombre genérico
UPDATE sales SET seller_name = 'Administrador' WHERE seller_name IS NULL;

ALTER TABLE sales DROP COLUMN seller_id;

