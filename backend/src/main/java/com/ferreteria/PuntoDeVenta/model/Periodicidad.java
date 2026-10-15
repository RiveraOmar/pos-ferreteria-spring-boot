package com.ferreteria.PuntoDeVenta.model;


public enum Periodicidad {

    DIARIA  ("D", "01", "Diaria",    "1 factura cada día",         60),
    SEMANAL ("S", "02", "Semanal",   "1 factura cada semana",      26),
    QUINCENAL("Q","03", "Quincenal", "2 facturas al mes",          24),
    MENSUAL ("M", "04", "Mensual",   "1 factura al mes",           12);

    private final String letra;         
    private final String codigoSat;     
    private final String nombre;       
    private final String descripcion;   
    private final int ventanaRezagados;

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
