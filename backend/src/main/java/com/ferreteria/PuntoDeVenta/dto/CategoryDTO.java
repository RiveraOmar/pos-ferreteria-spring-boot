    package com.ferreteria.PuntoDeVenta.dto;

    public record CategoryDTO(Long id, String name, String description, boolean hasChildren, boolean active) {}