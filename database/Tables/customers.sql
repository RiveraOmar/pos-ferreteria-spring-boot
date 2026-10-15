-- Crear la tabla de clientes
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    f
    ull_name VARCHAR(150) NOT NULL,
    rfc VARCHAR(13) UNIQUE, -- Identificación fiscal (ajustar longitud según país)
    email VARCHAR(100),
    phone_number VARCHAR(20),
    address TEXT,
    city VARCHAR(50),
    
    -- Tipo de cliente: 'GENERAL', 'MAYOREO', 'CONTRATISTA'
    customer_type VARCHAR(20) DEFAULT 'GENERAL', 
    
    -- Para saber cuánto descuento base tiene este cliente
    discount_rate DECIMAL(5,2) DEFAULT 0.00, 
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    active BOOLEAN DEFAULT TRUE
);

-- Insertar el cliente obligatorio por defecto
INSERT INTO customers (full_name, rfc, customer_type, address) 
VALUES ('Público General', 'XAXX010101000', 'GENERAL', 'Mostrador');

-- Índices para búsquedas rápidas por nombre o RFC
CREATE INDEX idx_customer_name ON customers(full_name);
CREATE INDEX idx_customer_rfc ON customers(rfc);