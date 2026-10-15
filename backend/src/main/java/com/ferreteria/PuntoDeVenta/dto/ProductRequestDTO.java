package com.ferreteria.PuntoDeVenta.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;
import java.util.Map;

public record ProductRequestDTO(

        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 200, message = "Máximo 200 caracteres")
        String name,

        @NotBlank(message = "El SKU es obligatorio")
        @Size(max = 50, message = "Máximo 50 caracteres")
        @Pattern(regexp = "^[\\w\\-\\.]+$",
                message = "SKU solo puede contener letras, números, guiones y puntos")
        String sku,

        @NotNull(message = "El precio de venta es obligatorio")
        @DecimalMin(value = "0.01", message = "El precio debe ser mayor a 0")
        @Digits(integer = 10, fraction = 2, message = "Máximo 10 enteros y 2 decimales")
        BigDecimal listPrice,

        @DecimalMin(value = "0.00", message = "El costo no puede ser negativo")
        @Digits(integer = 10, fraction = 2)
        BigDecimal costPrice,

        // BigDecimal: soporta alertas fraccionarias (ej. 2.5 kg)
        @DecimalMin(value = "0.00", message = "El stock mínimo no puede ser negativo")
        BigDecimal minStockLevel,

        String description,

        @DecimalMin(value = "0.00", message = "La tasa no puede ser negativa")
        @DecimalMax(value = "1.00", message = "La tasa no puede ser mayor a 1")
        BigDecimal taxRate,

        Object category,

        Map<String, Object> attributes,

        // Datos SAT — todos obligatorios (se valida también en backend)
        @NotBlank(message = "La clave de producto/servicio SAT es obligatoria")
        String satClaveProdServ,

        @NotBlank(message = "La unidad de medida SAT es obligatoria")
        String satClaveUnidad,

        @NotBlank(message = "El objeto de impuesto SAT es obligatorio")
        String satObjetoImp,

        String imagenUrl
) {}