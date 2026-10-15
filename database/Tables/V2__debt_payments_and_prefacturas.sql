-- ─── HISTORIAL DE PAGOS DE DEUDAS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS debt_payments (
    id            BIGSERIAL PRIMARY KEY,
    debt_id       BIGINT        NOT NULL REFERENCES debts(id),
    amount        NUMERIC(12,2) NOT NULL,
    notes         TEXT,
    payment_date  TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- ─── PRE-FACTURAS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prefacturas (
    id             BIGSERIAL PRIMARY KEY,
    customer_id    BIGINT        NOT NULL REFERENCES customers(id),
    folio          VARCHAR(30)   NOT NULL UNIQUE,
    status         VARCHAR(20)   NOT NULL DEFAULT 'BORRADOR', -- BORRADOR, LISTA, EMITIDA, CANCELADA
    subtotal       NUMERIC(12,2) NOT NULL DEFAULT 0,
    tax_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
    total          NUMERIC(12,2) NOT NULL DEFAULT 0,
    notes          TEXT,
    created_at     TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP     NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prefactura_items (
    id              BIGSERIAL PRIMARY KEY,
    prefactura_id   BIGINT        NOT NULL REFERENCES prefacturas(id) ON DELETE CASCADE,
    product_id      BIGINT        REFERENCES products(id),
    product_name    VARCHAR(200)  NOT NULL,
    product_sku     VARCHAR(50),
    quantity        INTEGER       NOT NULL DEFAULT 1,
    unit_price      NUMERIC(12,2) NOT NULL,
    subtotal        NUMERIC(12,2) NOT NULL
);
