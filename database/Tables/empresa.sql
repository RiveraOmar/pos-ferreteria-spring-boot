CREATE TABLE IF NOT EXISTS empresa (
    id              BIGINT PRIMARY KEY,
    rfc             VARCHAR(13) NOT NULL,
    razon_social    VARCHAR(300) NOT NULL,
    regimen_fiscal  VARCHAR(5) NOT NULL,
    codigo_postal   VARCHAR(10) NOT NULL,
    serie           VARCHAR(5) DEFAULT 'A',
    folio_actual    INTEGER DEFAULT 1
);

-- Insertar tus datos (cámbialos por los reales)
--INSERT INTO empresa(rfc, razon_social, regimen_fiscal, codigo_postal, serie)
--VALUES ('XAXX010101000', 'MI EMPRESA DE EJEMPLO SA DE CV', '626', '81000', 'A');

