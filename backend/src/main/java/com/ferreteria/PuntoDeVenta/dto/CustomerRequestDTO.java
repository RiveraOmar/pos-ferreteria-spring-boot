package com.ferreteria.PuntoDeVenta.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.*;
import java.math.BigDecimal;

public record CustomerRequestDTO(

        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 300)
        String fullName,

        @Pattern(regexp = "^([A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3})?$",
                message = "RFC con formato inválido")
        String rfc,

        @Email(message = "Formato de email inválido")
        String email,

        @Pattern(regexp = "^\\d{10}$", message = "El teléfono debe tener exactamente 10 dígitos")
        String phoneNumber,

        String address,
        String city,

        @NotBlank(message = "El tipo de cliente es obligatorio")
        String customerType,

        @NotNull
        @DecimalMin(value = "0.00", message = "El descuento no puede ser negativo")
        @DecimalMax(value = "100.00", message = "El descuento no puede superar 100%")
        // Límite real: un descuento no puede ser negativo ni llegar al 100%
        // (regalar la mercancía). Antes no tenía tope: se podía guardar 99% —o
        // 999%— y vender por centavos sin tocar el producto.
        @DecimalMin(value = "0.0",  message = "El descuento no puede ser negativo")
        @DecimalMax(value = "50.0", message = "El descuento no puede pasar de 50%. "
                + "Si de verdad necesitas más, ajusta el precio del producto.")
        BigDecimal discountRate,

        String razonSocial,
        String regimenFiscal,
        String usoCfdi,

        @Pattern(regexp = "^\\d{5}$", message = "El código postal debe tener 5 dígitos")
        String codigoPostal,

        String satPais
) {}