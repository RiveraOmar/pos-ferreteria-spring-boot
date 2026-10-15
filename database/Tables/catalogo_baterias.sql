CREATE TABLE IF NOT EXISTS catalogo_baterias (
    id                  BIGSERIAL PRIMARY KEY,
    marca               VARCHAR(100) NOT NULL,
    modelo              VARCHAR(200) NOT NULL,
    anio_rango          VARCHAR(50)  NOT NULL, -- Guarda estructuras como '2013-2022'
    alt VARCHAR(50)  NOT NULL,
    bateria_alternativa VARCHAR(50),           -- Columna 'También le queda'
    notas               TEXT
);