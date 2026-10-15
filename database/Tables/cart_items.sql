CREATE TABLE cart_items (
    id BIGSERIAL PRIMARY KEY,
    seller_identifier VARCHAR(50) NOT NULL, -- ID del vendedor o sesión
    product_id BIGINT REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);