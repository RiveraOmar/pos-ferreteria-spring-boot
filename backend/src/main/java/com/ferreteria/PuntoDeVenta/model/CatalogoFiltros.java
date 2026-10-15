    package com.ferreteria.PuntoDeVenta.model;

    import jakarta.persistence.*;
    import lombok.Data;

    @Entity
    @Table(name = "catalogo_filtros")
    @Data
    public class CatalogoFiltros {

        @Id
        @GeneratedValue(strategy = GenerationType.IDENTITY)
        private Long id;

        @Column(nullable = false)
        private String tipo;

        @Column(nullable = false)
        private String marca;

        @Column(nullable = false)
        private String modelo;

        @Column(name = "anio_inicio", nullable = false)
        private Integer anioInicio;

        @Column(name = "anio_fin", nullable = false)
        private Integer anioFin;

        private String motor;

        @Column(name = "filtro_aceite")
        private String filtroAceite;

        @Column(name = "filtro_aceite_sin")
        private String filtroAceiteSin;

        @Column(name = "filtro_aire")
        private String filtroAire;

        @Column(name = "filtro_combustible")
        private String filtroCombustible;

        @Column(name = "filtro_cabina")
        private String filtroCabina;

        private String notas;
    }