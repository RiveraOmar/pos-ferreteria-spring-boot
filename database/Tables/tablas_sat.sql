-- ============================================================
-- TABLAS SAT CFDI v4  —  Ejecutar en pgAdmin Query Tool
-- ============================================================

-- 1. Clave de Producto o Servicio  (52,512 registros)
--    Columnas CSV: c_ClaveProdServ | Descripción
CREATE TABLE IF NOT EXISTS sat_clave_prod_serv (
    clave       VARCHAR(20)  PRIMARY KEY,
    descripcion VARCHAR(500) NOT NULL
);

-- 2. Clave de Unidad de Medida  (2,417 registros)
--    Columnas CSV: c_ClaveUnidad | Nombre | Símbolo
CREATE TABLE IF NOT EXISTS sat_clave_unidad (
    clave   VARCHAR(20)  PRIMARY KEY,
    nombre  VARCHAR(300) NOT NULL,
    simbolo VARCHAR(50)
);

-- 3. Moneda  (182 registros)
--    Columnas CSV: c_Moneda | Descripción
CREATE TABLE IF NOT EXISTS sat_moneda (
    clave       VARCHAR(5)   PRIMARY KEY,
    descripcion VARCHAR(300) NOT NULL
);

-- 4. País  (249 registros)
--    Columnas CSV: c_Pais | Descripción
CREATE TABLE IF NOT EXISTS sat_pais (
    clave       VARCHAR(5)   PRIMARY KEY,
    descripcion VARCHAR(200) NOT NULL
);

-- 5. Régimen Fiscal  (18 registros)
--    Columnas CSV: c_RegimenFiscal | Descripción | Física | Moral
CREATE TABLE IF NOT EXISTS sat_regimen_fiscal (
    clave         INTEGER      PRIMARY KEY,
    descripcion   VARCHAR(300) NOT NULL,
    aplica_fisica VARCHAR(3),
    aplica_moral  VARCHAR(3)
);

-- 6. Uso CFDI  (23 registros)
--    Columnas CSV: c_UsoCFDI | Descripción | Física | Moral
CREATE TABLE IF NOT EXISTS sat_uso_cfdi (
    clave         VARCHAR(10)  PRIMARY KEY,
    descripcion   VARCHAR(300) NOT NULL,
    aplica_fisica VARCHAR(3),
    aplica_moral  VARCHAR(3)
);

CREATE TABLE IF NOT EXISTS sat_objeto_imp (
    clave       VARCHAR(5)   PRIMARY KEY,
    descripcion VARCHAR(200) NOT NULL
);

-- ============================================================
-- ÍNDICE de búsqueda en el catálogo grande (recomendado)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_sat_prod_desc
    ON sat_clave_prod_serv USING gin(to_tsvector('spanish', descripcion));

CREATE INDEX IF NOT EXISTS idx_sat_unidad_nombre
    ON sat_clave_unidad (nombre);

-- ============================================================
-- COLUMNAS de facturación SAT en tus tablas existentes
-- ============================================================

-- En products: clave SAT del producto, unidad y objeto de impuesto
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS sat_clave_prod_serv VARCHAR(20),
    ADD COLUMN IF NOT EXISTS sat_clave_unidad    VARCHAR(20) DEFAULT 'H87',
    ADD COLUMN IF NOT EXISTS sat_objeto_imp      VARCHAR(5)  DEFAULT '02';

-- En customers: datos fiscales para timbrar
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS razon_social   VARCHAR(300),
    ADD COLUMN IF NOT EXISTS regimen_fiscal VARCHAR(5),
    ADD COLUMN IF NOT EXISTS uso_cfdi       VARCHAR(10) DEFAULT 'G01',
    ADD COLUMN IF NOT EXISTS codigo_postal  VARCHAR(10),
    ADD COLUMN IF NOT EXISTS sat_pais       VARCHAR(5)  DEFAULT 'MEX';
