package com.ferreteria.PuntoDeVenta.exception;

public record StockErrorResponse(int status, String message, String path) {}