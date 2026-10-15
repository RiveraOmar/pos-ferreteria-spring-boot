package com.ferreteria.PuntoDeVenta.dto;

import jakarta.validation.constraints.*;

public record SupplierRequestDTO(
        @NotBlank(message = "El nombre de la empresa es obligatorio")
        @Size(max = 200)
        String companyName,

        @Size(max = 150)
        String contactName,

        @Pattern(regexp = "^$|^\\d{10}$", message = "El teléfono debe tener 10 dígitos")
        String phoneNumber,

        @Email(message = "Formato de email inválido")
        String email,

        @Size(max = 300)
        String address,

        @Size(max = 100)
        String city,

        @Pattern(regexp = "^$|^[A-ZÑ&]{3,4}\\d{6}[A-Z0-9]{3}$",
                message = "RFC inválido")
        String rfc,

        String notes
) {}