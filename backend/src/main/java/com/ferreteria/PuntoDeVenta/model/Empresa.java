package com.ferreteria.PuntoDeVenta.model;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "empresa")
@Data
public class Empresa {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 13)
    private String rfc;

    @Column(name = "razon_social", nullable = false, length = 300)
    private String razonSocial;

    @Column(name = "regimen_fiscal", nullable = false, length = 5)
    private String regimenFiscal;

    @Column(name = "codigo_postal", nullable = false, length = 10)
    private String codigoPostal;

    @Column(length = 5)
    private String serie;

    @Column(name = "folio_actual")
    private Integer folioActual;

    // ── Credenciales FEL/Blikon para timbrado SOAP ────────────────────────────
    // Se guardan en BD para no requerir configuración en cada arranque.
    // IMPORTANTE: si las credenciales no están configuradas en BD,
    // CfdiService usará las variables de entorno FEL_USUARIO/FEL_CUENTA/FEL_PASSWORD.
    @Column(name = "fel_usuario", length = 50)
    private String felUsuario;

    @Column(name = "fel_cuenta", length = 50)
    private String felCuenta;

    @Column(name = "fel_password", length = 100)
    private String felPassword;

    // "PRODUCCION" o "PRUEBAS" — controla contra cuál servidor de FEL se
    // timbra. Vive en la base (no en application.properties) para poder
    // cambiarlo en caliente desde la Consola de Desarrollo, sin reiniciar
    // el backend.
    @Column(name = "fel_ambiente", length = 20)
    private String felAmbiente = "PRODUCCION";

    // PIN de cancelación — se configura en el portal de FEL (fel.blikon.com → Configurar PIN)
    @Column(name = "fel_pin", length = 20)
    private String felPin;

    // Contador LOCAL de timbres/créditos de FEL. El servicio SOAP de FEL no
    // expone consulta de saldo, así que se lleva aquí: el dueño captura los
    // créditos comprados y el sistema descuenta 1 por cada timbrado exitoso.
    // Es aproximado (timbrados hechos fuera del sistema lo desfasan) — se
    // ajusta manualmente desde el módulo Facturación cuando haga falta.
    @Column(name = "fel_creditos_disponibles")
    private Integer felCreditosDisponibles;
    @Column(name = "direccion", length = 300)
    private String direccion;

    @Column(name = "colonia", length = 100)
    private String colonia;

    @Column(name = "municipio", length = 100)
    private String municipio;

    @Column(name = "estado", length = 50)
    private String estado;

    @Column(name = "telefono", length = 20)
    private String telefono;
}