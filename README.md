# FerrePOS — Sistema de Punto de Venta

Sistema de punto de venta (POS) desarrollado a la medida para una ferretería, con backend en **Java + Spring Boot**, frontend en **HTML/CSS/JavaScript** y base de datos **PostgreSQL**. Cubre desde la venta en mostrador hasta la facturación fiscal electrónica (CFDI) ante el SAT en México.

> Proyecto propio, desarrollado de forma independiente como freelance.

## Características principales

**Ventas y caja**
- Punto de venta con carrito, cálculo de totales, descuentos e impuestos
- Apertura y corte de caja, con registro de movimientos de efectivo
- Clientes con crédito ("fiado") y control de deudas y abonos
- Reportes de ventas

**Inventario**
- Catálogo de productos con atributos dinámicos (JSONB), costos e historial de precios
- Control de existencias en tiempo real, con alertas de stock mínimo
- Órdenes de compra a proveedores
- Subida y compresión automática de imágenes de producto
- Catálogos técnicos especializados (autopartes, filtros, baterías, birlos) con búsqueda por marca/modelo/año

**Facturación electrónica (CFDI 4.0 — México)**
- Timbrado fiscal integrado con un proveedor autorizado (PAC)
- Generación de PDF y QR de la factura
- Facturación global automática (diaria/semanal/quincenal/mensual) por tarea programada
- Catálogos oficiales del SAT (claves de producto/servicio, unidades, régimen fiscal, etc.)

**Seguridad**
- Autenticación con JWT
- Roles diferenciados: Administrador (dueño) y Vendedor, con permisos distintos sobre reportes, cancelaciones y compras

**Extra**
- Asistente con IA (Gemini) para verificar compatibilidad de autopartes
- Documentación de la API con Swagger / OpenAPI

## Stack técnico

| Capa | Tecnología |
|---|---|
| Backend | Java 21, Spring Boot 3, Spring Security, Spring Data JPA |
| Base de datos | PostgreSQL |
| Autenticación | JWT (jjwt) |
| Frontend | HTML, CSS, JavaScript (vanilla), Bootstrap |
| PDF / QR | iText7, ZXing |
| IA | Google Gemini API |
| Documentación API | springdoc-openapi (Swagger UI) |

## Estructura del repositorio

```
├── backend/     # API REST en Spring Boot
├── frontend/    # Interfaz web (HTML/CSS/JS)
└── database/    # Scripts SQL: tablas, índices, vistas y catálogos
```

## Cómo correrlo localmente

**Requisitos:** Java 21, Maven, PostgreSQL, un servidor estático simple para el frontend (ej. Live Server de VS Code).

1. Crea la base de datos en PostgreSQL y ejecuta los scripts de `database/Tables/` (y luego `database/INDEX/` y `database/VIEW/`).
2. Copia `backend/config/ferrepos.properties.example` a `backend/config/ferrepos.properties` y completa tus propios datos (usuario/password de la BD, usuarios del sistema, llave JWT, etc. — instrucciones dentro del archivo).
3. Levanta el backend:
   ```bash
   cd backend
   ./mvnw spring-boot:run
   ```
4. Abre `frontend/index.html` con un servidor estático (el backend corre por defecto en `http://localhost:9090`).

La documentación interactiva de la API queda disponible en `/swagger-ui.html` una vez levantado el backend.

## Nota

Este repositorio es una versión de portafolio: se removieron credenciales, llaves y datos de un negocio real antes de publicarlo. El archivo `.example` muestra cómo configurar tu propia instancia.

## Licencia

MIT — ver [LICENSE](LICENSE).
