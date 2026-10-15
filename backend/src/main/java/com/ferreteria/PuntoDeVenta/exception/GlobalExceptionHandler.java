package com.ferreteria.PuntoDeVenta.exception;

import jakarta.persistence.EntityNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

import java.util.HashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(InsufficientStockException.class)
    public ResponseEntity<StockErrorResponse> handleInsufficientStock(
            InsufficientStockException ex, HttpServletRequest request) {
        StockErrorResponse error = new StockErrorResponse(
                HttpStatus.CONFLICT.value(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(error, HttpStatus.CONFLICT);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<StockErrorResponse> handleDataIntegrity(
            DataIntegrityViolationException ex, HttpServletRequest request) {

        String errorMessage = ex.getMostSpecificCause().getMessage().toUpperCase();
        String userMessage = "Error de integridad de datos: ";

        if (errorMessage.contains("UK_CATEGORY_NAME_PARENT")) {
            userMessage = "Ya existe una subcategoría con este nombre en este nivel.";
        } else if (errorMessage.contains("PRODUCTS_SKU_KEY") || errorMessage.contains("SKU")) {
            userMessage = "El código SKU ingresado ya pertenece a otro producto.";
        } else if (errorMessage.contains("CUSTOMERS_RFC_KEY") || errorMessage.contains("RFC")) {
            userMessage = "El RFC o Identificación Fiscal ya está registrado para otro cliente.";
        } else if (errorMessage.contains("SALES_INVOICE_NUMBER_KEY")) {
            userMessage = "El número de factura/ticket ya existe.";
        } else if (errorMessage.contains("INVENTORY_PRODUCT_ID_KEY")) {
            userMessage = "Este producto ya tiene un registro de inventario asignado.";
        } else if (errorMessage.contains("NOT NULL")) {
            userMessage = "Un campo obligatorio está vacío. Por favor, revisa los datos.";
        } else if (errorMessage.contains("FOREIGN KEY") || errorMessage.contains("VIOLATES FOREIGN KEY")) {
            userMessage = "No se puede realizar la operación porque el registro está relacionado con otros datos (llave foránea).";
        } else if (errorMessage.contains("DUPLICATE") || errorMessage.contains("UNIQUE") || errorMessage.contains("UK_")) {
            userMessage = "Ya existe un registro con esos datos únicos en el sistema.";
        }

        StockErrorResponse error = new StockErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                userMessage,
                request.getRequestURI()
        );
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<StockErrorResponse> handleTypeMismatch(
            MethodArgumentTypeMismatchException ex, HttpServletRequest request) {

        String detail;
        if (ex.getRequiredType() != null && ex.getRequiredType().getSimpleName().equals("LocalDate")) {
            detail = String.format("El parámetro '%s' debe tener el formato ISO (yyyy-MM-dd). Ejemplo: 2026-05-01", ex.getName());
        } else {
            detail = String.format("El parámetro '%s' tiene un valor inválido.", ex.getName());
        }

        StockErrorResponse error = new StockErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                detail,
                request.getRequestURI()
        );
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    @ExceptionHandler({ResourceNotFoundException.class, EntityNotFoundException.class})
    public ResponseEntity<StockErrorResponse> handleResourceNotFound(
            Exception ex, HttpServletRequest request) {
        StockErrorResponse error = new StockErrorResponse(
                HttpStatus.NOT_FOUND.value(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(error, HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(DuplicateResourceException.class)
    public ResponseEntity<StockErrorResponse> handleDuplicateResource(
            DuplicateResourceException ex, HttpServletRequest request) {
        StockErrorResponse error = new StockErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    // Errores de validación (@Valid)
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(
            MethodArgumentNotValidException ex, HttpServletRequest request) {

        Map<String, String> errores = new HashMap<>();
        ex.getBindingResult().getAllErrors().forEach(error -> {
            String campo   = ((FieldError) error).getField();
            String mensaje = error.getDefaultMessage();
            errores.put(campo, mensaje);
        });

        Map<String, Object> body = new HashMap<>();
        body.put("status",    400);
        body.put("error",     "Error de validación");
        body.put("message",   "Revisa los campos marcados");
        body.put("fields",    errores);
        body.put("path",      request.getRequestURI());

        return ResponseEntity.badRequest().body(body);
    }

    // RuntimeException genérica (debe ir DESPUÉS de las específicas)
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<StockErrorResponse> handleRuntimeException(
            RuntimeException ex, HttpServletRequest request) {
        StockErrorResponse error = new StockErrorResponse(
                HttpStatus.BAD_REQUEST.value(),
                ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(error, HttpStatus.BAD_REQUEST);
    }

    // Cualquier otro error no controlado (debe ir AL FINAL)
    @ExceptionHandler(Exception.class)
    public ResponseEntity<StockErrorResponse> handleGeneral(
            Exception ex, HttpServletRequest request) {
        StockErrorResponse error = new StockErrorResponse(
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Error interno: " + ex.getMessage(),
                request.getRequestURI()
        );
        return new ResponseEntity<>(error, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}