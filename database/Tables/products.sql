CREATE TABLE products (
    id BIGSERIAL PRIMARY KEY,
    sku VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category_id BIGINT REFERENCES categories(id),
    
    -- Precios: Usamos NUMERIC para precisión monetaria
    list_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Precio venta
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Precio real (numérico)
    min_price  NUMERIC(12, 2) NOT NULL DEFAULT 0.00, -- Piso de descuento
    
    -- Atributos dinámicos (Clave para ferretería)
    attributes JSONB DEFAULT '{}'::jsonb, 
    
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);