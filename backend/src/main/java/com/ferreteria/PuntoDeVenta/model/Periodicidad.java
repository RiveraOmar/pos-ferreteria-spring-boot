package com.ferreteria.PuntoDeVenta.model;

/**
 * Periodicidad de la Factura Global (catálogo SAT c_Periodicidad).
 * Solo se exponen las 4 que un negocio de mostrador usaría normalmente;
 * el catálogo completo del SAT también tiene 05 Bimestral, que aquí no
 * se ofrece porque nadie la pidió — se puede agregar después igual que
 * las demás.
 */
public enum Periodicidad {

    DIARIA  ("D", "01", "Diaria",    "1 factura cada día",         60),
    SEMANAL ("S", "02", "Semanal",   "1 factura cada semana",      26),
    QUINCENAL("Q","03", "Quincenal", "2 facturas al mes",          24),
    MENSUAL ("M", "04", "Mensual",   "1 factura al mes",           12);

    private final String letra;         // prefijo usado en el string del periodo: "D:2026-08-29"
    private final String codigoSat;     // catálogo c_Periodicidad
    private final String nombre;        // para mostrar en el front
    private final String descripcion;   // subtítulo en la tarjeta
    private final int ventanaRezagados; // cuántos periodos hacia atrás se revisan por rezagados

    Periodicidad(String letra, String codigoSat, String nombre,
                 String descripcion, int ventanaRezagados) {
        this.letra = letra;
        this.codigoSat = codigoSat;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.ventanaRezagados = ventanaRezagados;
    }

    public String getLetra()            { return letra; }
    public String getCodigoSat()        { return codigoSat; }
    public String getNombre()           { return nombre; }
    public String getDescripcion()      { return descripcion; }
    public int getVentanaRezagados()    { return ventanaRezagados; }

    public static Periodicidad deLetra(String l) {
        for (Periodicidad p : values())
            if (p.letra.equals(l)) return p;
        throw new IllegalArgumentException("Letra de periodicidad desconocida: " + l);
    }
}
