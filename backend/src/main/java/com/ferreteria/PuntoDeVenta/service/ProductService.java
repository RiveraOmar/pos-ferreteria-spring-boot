package com.ferreteria.PuntoDeVenta.service;

import com.ferreteria.PuntoDeVenta.Util.PriceEncoder;
import com.ferreteria.PuntoDeVenta.dto.ProductFullDetailsDTO;
import com.ferreteria.PuntoDeVenta.dto.ProductResponseDTO;
import com.ferreteria.PuntoDeVenta.exception.ResourceNotFoundException;
import com.ferreteria.PuntoDeVenta.model.Inventory;
import com.ferreteria.PuntoDeVenta.model.PriceHistory;
import com.ferreteria.PuntoDeVenta.model.Product;
import com.ferreteria.PuntoDeVenta.model.SupplierProduct;
import com.ferreteria.PuntoDeVenta.repository.CategoryRepository;
import com.ferreteria.PuntoDeVenta.repository.InventoryRepository;
import com.ferreteria.PuntoDeVenta.repository.PriceHistoryRepository;
import com.ferreteria.PuntoDeVenta.repository.ProductRepository;
import com.ferreteria.PuntoDeVenta.repository.ProductImageRepository;
import com.ferreteria.PuntoDeVenta.repository.SaleItemRepository;
import com.ferreteria.PuntoDeVenta.repository.PrefacturaItemRepository;
import com.ferreteria.PuntoDeVenta.repository.PurchaseOrderItemRepository;
import com.ferreteria.PuntoDeVenta.repository.SupplierProductRepository;
import com.ferreteria.PuntoDeVenta.repository.SupplierRepository;
import com.ferreteria.PuntoDeVenta.model.Supplier;
import com.ferreteria.PuntoDeVenta.model.Category;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Comparator;
import java.util.Arrays;
import java.text.Normalizer;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ProductService {

    private final ProductRepository productRepository;
    private final InventoryRepository inventoryRepository;
    private final CategoryRepository categoryRepository;
    private final InventoryService inventoryService;
    private final CategoryService categoryService;
    private final PriceHistoryRepository priceHistoryRepository;
    private final SupplierProductRepository supplierProductRepository;
    private final SupplierRepository supplierRepository;
    // Solo para los candados del borrado permanente
    private final ProductImageRepository productImageRepository;
    private final SaleItemRepository saleItemRepository;
    private final PrefacturaItemRepository prefacturaItemRepository;
    private final PurchaseOrderItemRepository purchaseOrderItemRepository;

    // Mismo mapa que usa el frontend (productos.js/ventas.js) para decidir
    // si el producto se vende por fracciones (kg, m, L...) o solo piezas enteras.
    // Se mantiene aquí también para que el backend pueda informar unitLabel y
    // allowDecimal en la ficha sin que el frontend tenga que recalcularlo.
    private static final Set<String> UNIDADES_DECIMALES = new HashSet<>(List.of(
            "MTR", "KGM", "GRM", "LTR", "MLT", "CMT", "MTK", "DMT",
            "DMQ", "HLT", "TNE", "MGM", "H87P"
    ));

    private boolean esDecimal(String claveUnidad) {
        return claveUnidad != null && UNIDADES_DECIMALES.contains(claveUnidad.toUpperCase());
    }

    private String etiquetaUnidad(String claveUnidad) {
        if (claveUnidad == null) return "pza";
        return switch (claveUnidad.toUpperCase()) {
            case "MTR" -> "m";
            case "CMT" -> "cm";
            case "MMT" -> "mm";
            case "MTK" -> "m²";
            case "KGM" -> "kg";
            case "GRM" -> "g";
            case "MGM" -> "mg";
            case "TNE" -> "ton";
            case "LTR" -> "L";
            case "MLT" -> "mL";
            case "HLT" -> "hL";
            case "SET" -> "juego";
            case "KT"  -> "kit";
            case "PR"  -> "par";
            case "BX"  -> "caja";
            default -> "pza";
        };
    }

    @Transactional(readOnly = true)
    /**
     * Catálogo completo.
     *
     * OJO con el nombre: este método se llamaba getAllActive() pero hacía
     * findAll() — devolvía activos E inactivos. Por eso los productos
     * desactivados seguían saliendo en el buscador de Ventas.
     *
     * Ahora sí filtra. El módulo de Productos, que SÍ necesita ver los
     * inactivos para poder activarlos, pide incluirInactivos = true.
     */
    public List<ProductResponseDTO> getAllActive() {
        return getAll(false);
    }

    public List<ProductResponseDTO> getAll(boolean incluirInactivos) {
        List<Product> productos = incluirInactivos
                ? productRepository.findAll()
                : productRepository.findByActiveTrue();

        // ── FIX N+1 ──────────────────────────────────────────────────────────
        // Antes convertToDTO pedía el stock producto por producto: con 11
        // productos eran 11 consultas (invisible), pero con un catálogo de
        // 15,000 son 15,000 consultas en una sola petición y el endpoint se
        // ahoga. Aquí se trae TODO el inventario de un golpe y se reparte.
        List<Inventory> invs = inventoryRepository.findAll();
        Map<Long, BigDecimal> stocks = invs.stream()
                .filter(i -> i.getProduct() != null)
                .collect(Collectors.toMap(
                        i -> i.getProduct().getId(),
                        i -> i.getStockActual() != null
                                ? i.getStockActual() : BigDecimal.ZERO,
                        (a, b) -> a));
        Map<Long, String> racks = invs.stream()
                .filter(i -> i.getProduct() != null && i.getLocationRack() != null)
                .collect(Collectors.toMap(
                        i -> i.getProduct().getId(), Inventory::getLocationRack,
                        (a, b) -> a));

        return productos.stream()
                .map(p -> convertToDTO(p,
                        stocks.getOrDefault(p.getId(), BigDecimal.ZERO),
                        racks.get(p.getId())))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    /**
     * Búsqueda "como la de las tiendas": no hace falta escribir el nombre exacto.
     *
     * Cómo funciona:
     *  1. Si lo escrito es un código de barras, se devuelve ese producto y ya.
     *  2. Se parte la frase en palabras. Se consulta a la base con la palabra
     *     más larga (la más específica: reduce miles de filas a decenas), y las
     *     demás palabras se filtran sobre ese resultado. Así "perico 15" o
     *     "15 perico" encuentran "Llave ajustable (perico) 15\" cromada",
     *     aunque las palabras no estén juntas ni en ese orden.
     *  3. Se ignoran acentos y palabras de relleno ("de", "para", "con"...).
     *  4. Se ordena por relevancia: primero lo que empieza con lo buscado,
     *     luego lo que lo contiene en el nombre, al final las coincidencias
     *     que solo están en la descripción.
     *
     * Se resuelve aquí y no en SQL porque el número de palabras es variable;
     * armar eso en JPQL exigiría consultas dinámicas para poca ganancia.
     */
    public List<ProductResponseDTO> searchProducts(String term) {
        return searchProducts(term, false);
    }

    /**
     * @param incluirInactivos true SOLO desde el módulo de Productos, que
     *        necesita encontrar lo desactivado para poder activarlo. En
     *        Ventas siempre va false: un producto que no manejas no debe
     *        aparecerle al cajero con el cliente enfrente.
     */
    public List<ProductResponseDTO> searchProducts(String term, boolean incluirInactivos) {
        if (term == null || term.isBlank()) return List.of();

        String limpio = normalizar(term);
        if (limpio.isBlank()) return List.of();

        // ── 1. ¿Es un código tal cual? Se busca exacto antes que nada ──
        String posibleCodigo = term.trim();

        // 1a. Código de barras (el lector manda el código completo, 8+ dígitos)
        if (posibleCodigo.length() >= 8 && posibleCodigo.chars().allMatch(Character::isDigit)) {
            List<Product> porBarras = productRepository.findByBarcode(posibleCodigo);
            if (!porBarras.isEmpty()) return convertirConStock(porBarras, incluirInactivos);
        }

        // 1b. Código interno de Truper (el del catálogo impreso, ej. 100048).
        //     Va antes de la búsqueda por texto: si escribes el código exacto,
        //     quieres ESE producto, no todo lo que contenga esos dígitos.
        if (posibleCodigo.matches("\\d{4,10}")) {
            List<Product> porTruper = productRepository.findByCodigoTruper(posibleCodigo);
            if (!porTruper.isEmpty()) return convertirConStock(porTruper, incluirInactivos);
        }

        // 1c. SKU exacto (ej. PET-15X): también gana sobre la búsqueda difusa
        List<Product> porSku = productRepository.findBySkuIgnoreCase(posibleCodigo);
        if (!porSku.isEmpty()) return convertirConStock(porSku, incluirInactivos);

        // ── 2. Palabras (se tiran las de relleno y las de 1 letra) ──
        // Se asigna UNA sola vez: si se reasignara, Java no dejaría usarla
        // dentro de los lambdas de abajo ("effectively final").
        List<String> encontradas = Arrays.stream(limpio.split("\\s+"))
                .filter(w -> w.length() > 1 && !RELLENO.contains(w))
                .distinct()
                .collect(Collectors.toList());

        final List<String> palabras = encontradas.isEmpty()
                ? List.of(limpio.trim())
                : encontradas;

        // La palabra más larga es la más específica: con ella se pregunta a la
        // base (una sola consulta), y el resto se filtra sobre ese resultado.
        String ancla = palabras.stream()
                .max(Comparator.comparingInt(String::length))
                .orElse(limpio);

        List<Product> candidatos = productRepository.searchByTerm(ancla);

        List<Product> filtrados = candidatos.stream()
                .filter(p -> p.getId() > 0)  // excluir producto genérico de venta libre (id -1)
                .filter(p -> {
                    // Se incluyen los atributos: ahí viven el código de
                    // Truper, la marca y la familia.
                    String texto = normalizar(
                            (p.getName() == null ? "" : p.getName()) + " " +
                                    (p.getSku()  == null ? "" : p.getSku())  + " " +
                                    (p.getDescription() == null ? "" : p.getDescription()) + " " +
                                    (p.getBarcode() == null ? "" : p.getBarcode()) + " " +
                                    textoAtributos(p));
                    return palabras.stream().allMatch(texto::contains);
                })
                .sorted(Comparator.comparingInt((Product p) -> relevancia(p, palabras))
                        .thenComparing(p -> p.getName() == null ? "" : p.getName()))
                .limit(200)   // el mostrador no revisa más de 200 resultados
                .collect(Collectors.toList());

        return convertirConStock(filtrados, incluirInactivos);
    }

    /** Vuelve texto los atributos (marca, familia, codigo_truper...) para buscar. */
    private String textoAtributos(Product p) {
        if (p.getAttributes() == null || p.getAttributes().isEmpty()) return "";
        StringBuilder sb = new StringBuilder();
        p.getAttributes().forEach((k, v) -> {
            sb.append(k).append(' ');
            if (v != null) sb.append(v).append(' ');
        });
        return sb.toString();
    }

    /** Palabras que no aportan al buscar y solo estorban. */
    private static final Set<String> RELLENO = Set.of(
            "de", "del", "la", "el", "los", "las", "para", "con", "por",
            "un", "una", "y", "en", "al", "a");

    /** Quita acentos y pasa a minúsculas: "Válvula" y "valvula" son lo mismo. */
    private String normalizar(String s) {
        if (s == null) return "";
        // 1. Quitar acentos (é→e, ó→o, ñ→n, etc.)
        String n = Normalizer.normalize(s, Normalizer.Form.NFD)
                .replaceAll("\\p{InCombiningDiacriticalMarks}+", "");
        // 2. Normalizar caracteres especiales que el teclado en español o el
        //    lector de código de barras puede mandar distintos a como están
        //    guardados en la base de datos:
        //
        //      × (U+00D7) signo de multiplicación  →  x
        //      ÷ (U+00F7) signo de división        →  /
        //      ′ (U+2032) prima (pulgada)           →  '
        //      ″ (U+2033) prima doble (pie)         →  "
        //      – (U+2013) guión medio               →  -
        //      — (U+2014) guión largo               →  -
        //      " " (U+201C/D) comillas tipográficas →  "
        //      ' ' (U+2018/9) comillas tipográficas →  '
        //
        //    Sin esto, buscar "1/2×1/4" (con ×) no encontraba "1/2x1/4"
        //    (con x) aunque el nombre fuera idéntico visualmente.
        n = n.replace("\u00D7", "x")   // × → x
                .replace("\u00F7", "/")   // ÷ → /
                .replace("\u2032", "'")   // ′ → '
                .replace("\u2033", "\"") // ″ → "
                .replace("\u2013", "-")   // – → -
                .replace("\u2014", "-")   // — → -
                .replace("\u201C", "\"") // " → "
                .replace("\u201D", "\"") // " → "
                .replace("\u2018", "'")   // ' → '
                .replace("\u2019", "'");  // ' → '
        return n.toLowerCase().trim();
    }

    /** Menor número = sale primero. */
    private int relevancia(Product p, List<String> palabras) {
        String nombre = normalizar(p.getName());
        String sku    = normalizar(p.getSku());
        String frase  = String.join(" ", palabras);

        if (sku.equals(frase))            return 0;  // SKU exacto
        if (nombre.equals(frase))         return 1;  // nombre exacto
        if (nombre.startsWith(frase))     return 2;  // empieza con lo buscado
        if (sku.startsWith(frase))        return 3;
        if (nombre.contains(frase))       return 4;  // frase completa en el nombre
        if (palabras.stream().allMatch(nombre::contains)) return 5; // todas en el nombre
        return 6;                                    // solo en descripción/otros
    }

    /** Convierte a DTO trayendo el inventario en UNA consulta (evita el N+1). */
    /** Versión de siempre: solo productos activos. */
    private List<ProductResponseDTO> convertirConStock(List<Product> productos) {
        return convertirConStock(productos, false);
    }

    /** convertirConStock es el embudo por donde pasan TODAS las ramas de la
     *  búsqueda (código de barras, Truper, SKU y texto). Filtrar aquí evita
     *  repetir el mismo if cuatro veces y olvidarlo en la quinta.
     *
     *  La bandera va como PARÁMETRO y no como campo del servicio: el servicio
     *  es un singleton compartido por todas las peticiones, así que un campo
     *  se pisaría entre dos búsquedas simultáneas. */
    private List<ProductResponseDTO> convertirConStock(List<Product> productos,
                                                       boolean incluirInactivos) {
        if (!incluirInactivos) {
            productos = productos.stream().filter(Product::isActive).toList();
        }
        if (productos.isEmpty()) return List.of();
        List<Inventory> invs = inventoryRepository.findAll();
        Map<Long, BigDecimal> stocks = invs.stream()
                .filter(i -> i.getProduct() != null)
                .collect(Collectors.toMap(
                        i -> i.getProduct().getId(),
                        i -> i.getStockActual() != null ? i.getStockActual() : BigDecimal.ZERO,
                        (a, b) -> a));
        Map<Long, String> racks = invs.stream()
                .filter(i -> i.getProduct() != null && i.getLocationRack() != null)
                .collect(Collectors.toMap(
                        i -> i.getProduct().getId(), Inventory::getLocationRack, (a, b) -> a));
        return productos.stream()
                .map(p -> convertToDTO(p, stocks.getOrDefault(p.getId(), BigDecimal.ZERO),
                        racks.get(p.getId())))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public ProductResponseDTO getById(Long id) {
        Product product = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));
        return convertToDTO(product);
    }

    /** Versión de siempre: consulta el stock ella sola (para 1 producto). */
    public ProductResponseDTO convertToDTO(Product p) {
        BigDecimal stock = inventoryService.getStockStatus(p.getId())
                .map(Inventory::getStockActual).orElse(BigDecimal.ZERO);
        return convertToDTO(p, stock);
    }

    /** Versión para listas: recibe el stock ya traído, sin consultar de nuevo. */
    public ProductResponseDTO convertToDTO(Product p, BigDecimal stock) {
        return convertToDTO(p, stock, null);
    }

    /** Versión que además recibe la ubicación física ya traída. */
    public ProductResponseDTO convertToDTO(Product p, BigDecimal stock, String rack) {

        ProductResponseDTO.CategorySlimDTO catDTO = null;
        if (p.getCategory() != null) {
            catDTO = new ProductResponseDTO.CategorySlimDTO(
                    p.getCategory().getId(), p.getCategory().getName());
        }

        BigDecimal price = p.getListPrice() != null ? p.getListPrice() : BigDecimal.ZERO;
        BigDecimal cost  = p.getCostPrice() != null ? p.getCostPrice() : BigDecimal.ZERO;

        return new ProductResponseDTO(
                p.getId(),
                p.getSku(),
                p.getName(),
                p.getDescription(),
                price,
                PriceEncoder.encode(cost),
                stock,
                p.getAttributes(),
                catDTO,
                p.isActive(),
                p.getMinStockLevel(),
                p.getBarcode(),
                // SAT
                p.getSatClaveProdServ(),
                p.getSatClaveUnidad(),
                p.getSatObjetoImp(),
                p.getImagenUrl(),
                rack,
                p.getCompraPorBolsa(),
                p.getPiezasPorBolsa(),
                p.getPrecioBolsa()
        );
    }

    @Transactional

    /**
     * Coherencia de precios de un producto. Sin esto, un precio mínimo mayor
     * al precio de lista deja el producto INVENDIBLE (toda venta fallaría en
     * la validación "precio >= mínimo"), y un precio de lista menor al costo
     * significa vender perdiendo dinero sin darse cuenta.
     */
    private void validarPrecios(Product p) {
        if (p.getSku() == null || p.getSku().isBlank())
            throw new IllegalArgumentException("El SKU es obligatorio.");
        if (p.getName() == null || p.getName().isBlank())
            throw new IllegalArgumentException("El nombre del producto es obligatorio.");
        if (p.getListPrice() == null
                || p.getListPrice().compareTo(java.math.BigDecimal.ZERO) <= 0)
            throw new IllegalArgumentException(
                    "El precio de venta debe ser mayor a cero.");
        // Las validaciones de min_price se retiraron junto con el piso de
        // precio de SaleService. La columna sigue existiendo en la base para
        // no romper nada, pero ya no manda sobre nada.
        if (p.getCostPrice() != null
                && p.getCostPrice().compareTo(java.math.BigDecimal.ZERO) < 0)
            throw new IllegalArgumentException(
                    "El costo no puede ser negativo.");
        if (p.getCostPrice() != null
                && p.getListPrice().compareTo(p.getCostPrice()) < 0)
            throw new IllegalArgumentException(
                    "El precio de venta ($" + p.getListPrice()
                            + ") es menor al costo ($" + p.getCostPrice()
                            + "): venderías perdiendo dinero. Corrige uno de los dos.");
    }


    // ═════════════════════════════════════════════════════════════════════
    //  CATEGORÍA POR DEFECTO — "Sin Categoría"
    //  Si el producto se crea sin categoría (aún no existe la correcta),
    //  se asigna automáticamente a "Sin Categoría" (se crea sola la
    //  primera vez). Después, al editar el producto, se mueve a la buena.
    //  Así la categoría nunca frena un alta y ningún producto queda
    //  huérfano de clasificación.
    // ═════════════════════════════════════════════════════════════════════
    private Category obtenerCategoriaDefault() {
        return categoryRepository.findFirstByNameIgnoreCase("Sin Categoría")
                .orElseGet(() -> {
                    Category c = new Category();
                    c.setName("Sin Categoría");
                    c.setDescription(
                            "Productos pendientes de clasificar. "
                                    + "Asígnales su categoría real al editarlos.");
                    c.setActive(true);
                    return categoryRepository.save(c);
                });
    }

    public Product saveFullProduct(Product product) {
        validarPrecios(product);

        if (product.getCategory() != null && product.getCategory().getId() != null) {
            categoryRepository.findById(product.getCategory().getId())
                    .orElseThrow(() -> new ResourceNotFoundException("Categoría inexistente"));
        } else {
            // Sin categoría elegida → "Sin Categoría" por defecto
            product.setCategory(obtenerCategoriaDefault());
        }
        if (product.getTaxRate() == null) {
            product.setTaxRate(BigDecimal.valueOf(0.16));
        }
        Product saved = productRepository.save(product);
        if (!inventoryRepository.existsByProductId(saved.getId())) {
            Inventory inv = new Inventory();
            inv.setProduct(saved);
            inv.setStockActual(BigDecimal.ZERO);
            inventoryRepository.save(inv);
        }
        return saved;
    }

    @Transactional
    public Product updateProduct(Long id, Product details) {
        validarPrecios(details);
        Product existing = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado: " + id));

        // Historial de precios
        if (details.getListPrice() != null &&
                (existing.getListPrice() == null ||
                        existing.getListPrice().compareTo(details.getListPrice()) != 0)) {
            PriceHistory h = new PriceHistory();
            h.setProduct(existing);
            h.setOldPrice(existing.getListPrice());
            h.setNewPrice(details.getListPrice());
            h.setChangeDate(LocalDateTime.now());
            priceHistoryRepository.save(h);
        }

        existing.setName(details.getName());
        existing.setSku(details.getSku());
        // El codigo de barras SI se guarda. Antes esta linea no existia: el
        // formulario lo mostraba precargado y dejaba editarlo, pero al guardar
        // el cambio se perdia en silencio y el producto se quedaba con el
        // codigo viejo. Escaneabas y no lo encontraba.
        existing.setBarcode(details.getBarcode());
        existing.setDescription(details.getDescription());
        existing.setListPrice(details.getListPrice());
        existing.setCostPrice(details.getCostPrice());
        existing.setMinPrice(details.getMinPrice());
        existing.setMinStockLevel(details.getMinStockLevel());
        existing.setAttributes(details.getAttributes());
        existing.setCategory(
                details.getCategory() != null && details.getCategory().getId() != null
                        ? details.getCategory()
                        : obtenerCategoriaDefault());   // nunca queda sin clasificar
        existing.setTaxRate(details.getTaxRate() != null
                ? details.getTaxRate() : BigDecimal.valueOf(0.16));
        existing.setActive(details.isActive());

        // SAT
        existing.setSatClaveProdServ(details.getSatClaveProdServ());
        existing.setSatClaveUnidad(details.getSatClaveUnidad());
        existing.setSatObjetoImp(details.getSatObjetoImp());
        if (details.getImagenUrl() != null
                && !details.getImagenUrl().isBlank()) {
            existing.setImagenUrl(details.getImagenUrl().trim());
        }
        existing.setCompraPorBolsa(details.getCompraPorBolsa() != null
                && details.getCompraPorBolsa());
        existing.setPiezasPorBolsa(details.getPiezasPorBolsa());
        existing.setCostoBolsa(details.getCostoBolsa());
        existing.setPrecioBolsa(details.getPrecioBolsa());

        return productRepository.save(existing);
    }

    @Transactional
    public void deleteProduct(Long id) {
        Product p = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("No encontrado"));
        // Evita "eliminar" dos veces el mismo producto con un mensaje claro
        // en vez de un "éxito" silencioso que no avisa nada.
        if (!p.isActive()) {
            throw new IllegalStateException(
                    "Este producto ya estaba eliminado (inactivo).");
        }
        p.setActive(false);
        productRepository.save(p);
    }

    @Transactional(readOnly = true)
    public List<ProductResponseDTO> getProductsByCategoryRecursive(Long categoryId) {
        List<Long> ids = categoryService.getAllChildIds(categoryId);
        return productRepository.findByCategoryIdIn(ids).stream()
                .map(this::convertToDTO)
                .collect(Collectors.toList());
    }

    // ─── FICHA COMPLETA DE SOLO LECTURA ────────────────────────────────────────
    // Junta producto + historial de precio + proveedores en una sola respuesta
    // para el botón "Ver detalles" en Productos y en Ventas.
    // No expone el costo en texto plano en ningún punto, mismo criterio que
    // convertToDTO() ya aplica con PriceEncoder.
    @Transactional(readOnly = true)
    public ProductFullDetailsDTO getFullDetails(Long id) {
        Product p = productRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Producto no encontrado"));

        // Se necesita el Inventory completo (no solo el stock) para leer
        // locationRack — la ubicación física que ya capturas al hacer restock.
        var inventoryOpt = inventoryService.getStockStatus(p.getId());
        BigDecimal stock = inventoryOpt.map(Inventory::getStockActual).orElse(BigDecimal.ZERO);
        String ubicacion = inventoryOpt.map(Inventory::getLocationRack).orElse(null);

        ProductFullDetailsDTO.CategorySlimDTO catDTO = null;
        if (p.getCategory() != null) {
            catDTO = new ProductFullDetailsDTO.CategorySlimDTO(
                    p.getCategory().getId(), p.getCategory().getName());
        }

        // Historial: solo fecha, nunca el monto. Comparamos oldPrice/newPrice
        // únicamente para decidir si fue un aumento o una baja, no lo exponemos.
        List<ProductFullDetailsDTO.PriceChangeDTO> historial =
                priceHistoryRepository.findByProductIdOrderByChangeDateDesc(id).stream()
                        .map(h -> {
                            String direccion;
                            if (h.getOldPrice() == null) {
                                direccion = "SIN_CAMBIO_PREVIO";
                            } else if (h.getNewPrice().compareTo(h.getOldPrice()) > 0) {
                                direccion = "SUBIO";
                            } else if (h.getNewPrice().compareTo(h.getOldPrice()) < 0) {
                                direccion = "BAJO";
                            } else {
                                direccion = "SIN_CAMBIO_PREVIO";
                            }
                            return new ProductFullDetailsDTO.PriceChangeDTO(
                                    h.getChangeDate(), direccion);
                        })
                        .collect(Collectors.toList());

        // Proveedores que surten este producto, sin exponer el último costo pagado
        List<ProductFullDetailsDTO.SupplierForProductDTO> proveedores =
                supplierProductRepository.findByProductIdOrderByLastCostAsc(id).stream()
                        .map((SupplierProduct sp) -> new ProductFullDetailsDTO.SupplierForProductDTO(
                                sp.getSupplier().getId(),
                                sp.getSupplier().getCompanyName(),
                                sp.getSupplier().getPhoneNumber(),
                                sp.getSupplierSku(),
                                sp.getLastPurchaseAt()
                        ))
                        .collect(Collectors.toList());

        return new ProductFullDetailsDTO(
                p.getId(), p.getSku(), p.getName(), p.getDescription(),
                p.getListPrice() != null ? p.getListPrice() : BigDecimal.ZERO,
                stock, p.getAttributes(), catDTO, p.isActive(),
                p.getMinStockLevel() != null
                        ? p.getMinStockLevel() : BigDecimal.ZERO,
                p.getImagenUrl(),
                etiquetaUnidad(p.getSatClaveUnidad()),
                esDecimal(p.getSatClaveUnidad()),
                p.getBarcode(),
                ubicacion,
                p.getCreatedAt(),
                p.getUpdatedAt(),
                p.getSatClaveProdServ(), p.getSatClaveUnidad(), p.getSatObjetoImp(),
                historial, proveedores,
                p.getCompraPorBolsa(), p.getPiezasPorBolsa(), p.getCostoBolsa(),
                p.getPrecioBolsa()
        );
    }

    // ═════════════════════════════════════════════════════════════════════
    //  PROVEEDORES DE UN PRODUCTO — pre-asignación desde el alta/edición
    //  (la relación también se crea sola al registrar compras; esto permite
    //  declararla ANTES de la primera compra, p.ej. "estos baleros me los
    //  surte Refaccionaria X")
    // ═════════════════════════════════════════════════════════════════════

    @Transactional(readOnly = true)
    public List<java.util.Map<String, Object>> proveedoresDeProducto(Long productId) {
        return supplierProductRepository
                .findByProductIdOrderByLastCostAsc(productId).stream()
                .map(sp -> {
                    java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
                    m.put("supplierId",   sp.getSupplier().getId());
                    m.put("companyName",  sp.getSupplier().getCompanyName());
                    m.put("lastCost",     sp.getLastCost());
                    m.put("supplierSku",  sp.getSupplierSku());
                    m.put("conHistorial", sp.getLastCost() != null);
                    return m;
                }).toList();
    }

    /**
     * Sincroniza los proveedores asignados a un producto.
     * - Agrega los vínculos nuevos (sin costo aún: se llenará con la
     *   primera compra registrada).
     * - Quita los desmarcados SOLO si no tienen historial de compras
     *   (lastCost nulo). Un vínculo con compras registradas se conserva
     *   siempre: es historial de costos, no una preferencia editable.
     */
    @Transactional
    public List<java.util.Map<String, Object>> asignarProveedores(
            Long productId, List<Long> supplierIds) {

        Product producto = productRepository.findById(productId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Producto no encontrado: " + productId));
        List<Long> deseados = supplierIds == null ? List.of() : supplierIds;

        List<SupplierProduct> actuales = supplierProductRepository
                .findByProductIdOrderByLastCostAsc(productId);

        // Quitar desmarcados sin historial
        for (SupplierProduct sp : actuales) {
            boolean sigue = deseados.contains(sp.getSupplier().getId());
            if (!sigue && sp.getLastCost() == null) {
                supplierProductRepository.delete(sp);
            }
        }

        // Agregar los nuevos
        java.util.Set<Long> yaLigados = actuales.stream()
                .map(sp -> sp.getSupplier().getId())
                .collect(java.util.stream.Collectors.toSet());
        for (Long supplierId : deseados) {
            if (yaLigados.contains(supplierId)) continue;
            Supplier proveedor = supplierRepository.findById(supplierId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Proveedor no encontrado: " + supplierId));
            SupplierProduct nuevo = new SupplierProduct();
            nuevo.setSupplier(proveedor);
            nuevo.setProduct(producto);
            supplierProductRepository.save(nuevo);
        }
        return proveedoresDeProducto(productId);
    }



    /** Código del producto en el catálogo del FABRICANTE (Truper, etc.),
     *  guardado en los atributos del producto. Es distinto del supplier_sku
     *  (código del distribuidor). Se prueban varias claves comunes. */
    private String codigoFabricante(Product p) {
        if (p.getAttributes() == null) return null;
        for (String clave : List.of("codigo_truper", "codigo_fabricante",
                "codigo_fab", "clave_fabricante", "codigo_catalogo")) {
            Object v = p.getAttributes().get(clave);
            if (v != null && !v.toString().isBlank()) return v.toString();
        }
        return null;
    }

    // ═════════════════════════════════════════════════════════════════════
    //  SUGERENCIA DE COMPRA — stock bajo agrupado por proveedor asignado
    //  Cantidad sugerida: llegar al DOBLE del mínimo (mín para no volver a
    //  caer de inmediato + colchón). Editable en pantalla antes de pedir.
    // ═════════════════════════════════════════════════════════════════════
    @Transactional(readOnly = true)
    public List<java.util.Map<String, Object>> sugerenciaCompra() {
        List<Product> faltantes = productRepository.findAll().stream()
                .filter(p -> p.getId() != null && p.getId() > 0)
                .filter(Product::isActive)
                .filter(p -> {
                    java.math.BigDecimal stock = inventoryRepository
                            .findByProductId(p.getId())
                            .map(Inventory::getStockActual)
                            .orElse(java.math.BigDecimal.ZERO);
                    java.math.BigDecimal min = p.getMinStockLevel() != null
                            ? p.getMinStockLevel() : java.math.BigDecimal.ZERO;
                    return stock.compareTo(min) <= 0;
                })
                .toList();

        // proveedor → lista de productos sugeridos
        java.util.Map<String, java.util.Map<String, Object>> grupos =
                new java.util.LinkedHashMap<>();

        for (Product p : faltantes) {
            java.math.BigDecimal stock = inventoryRepository
                    .findByProductId(p.getId())
                    .map(Inventory::getStockActual)
                    .orElse(java.math.BigDecimal.ZERO);
            java.math.BigDecimal min = p.getMinStockLevel() != null
                    ? p.getMinStockLevel() : java.math.BigDecimal.ZERO;
            // sugerido = doble del mínimo − stock actual (al menos 1)
            java.math.BigDecimal sugerido = min.multiply(java.math.BigDecimal.TWO)
                    .subtract(stock).max(java.math.BigDecimal.ONE);

            List<SupplierProduct> links = supplierProductRepository
                    .findByProductIdOrderByLastCostAsc(p.getId());

            java.util.function.BiConsumer<String, SupplierProduct> agregar =
                    (clave, sp) -> {
                        java.util.Map<String, Object> g = grupos.computeIfAbsent(clave, k -> {
                            java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
                            m.put("supplierId",   sp != null ? sp.getSupplier().getId() : null);
                            m.put("supplierName", sp != null
                                    ? sp.getSupplier().getCompanyName() : "SIN PROVEEDOR ASIGNADO");
                            m.put("telefono",     sp != null
                                    ? sp.getSupplier().getPhoneNumber() : null);
                            m.put("productos",    new java.util.ArrayList<java.util.Map<String, Object>>());
                            return m;
                        });
                        java.util.Map<String, Object> item = new java.util.LinkedHashMap<>();
                        item.put("productId",  p.getId());
                        item.put("sku",        p.getSku());
                        item.put("name",       p.getName());
                        item.put("stock",      stock);
                        item.put("minStock",   min);
                        item.put("sugerido",   sugerido);
                        item.put("lastCost",   sp != null ? sp.getLastCost() : null);
                        item.put("supplierSku", sp != null ? sp.getSupplierSku() : null);
                        @SuppressWarnings("unchecked")
                        var lista = (java.util.List<java.util.Map<String, Object>>) g.get("productos");
                        lista.add(item);
                    };

            if (links.isEmpty()) {
                agregar.accept("__SIN__", null);
            } else {
                // El proveedor con MEJOR último costo encabeza; si el producto
                // tiene varios, aparece con cada uno (tú decides a quién pedir)
                for (SupplierProduct sp : links) {
                    agregar.accept("S" + sp.getSupplier().getId(), sp);
                }
            }
        }
        return new java.util.ArrayList<>(grupos.values());
    }


    // ═════════════════════════════════════════════════════════════════════
    //  CATÁLOGO DE UN PROVEEDOR con recomendación de compra
    //  Parte del PROVEEDOR: muestra TODOS los productos que él te surte, con
    //  su urgencia. Útil cuando vas a hacer UN pedido a UN proveedor y
    //  quieres aprovechar el envío incluyendo lo que ya va cerca del mínimo.
    //  urgencia: 'agotado' (stock 0) · 'bajo' (≤ mínimo) ·
    //            'proximo' (≤ 1.5× mínimo) · 'ok'
    // ═════════════════════════════════════════════════════════════════════
    @Transactional(readOnly = true)
    public java.util.Map<String, Object> catalogoProveedorParaCompra(Long supplierId) {
        Supplier prov = supplierRepository.findById(supplierId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Proveedor no encontrado: " + supplierId));

        List<SupplierProduct> links = supplierProductRepository
                .findBySupplierIdOrderByLastPurchaseAtDesc(supplierId);

        java.util.List<java.util.Map<String, Object>> productos = new java.util.ArrayList<>();
        for (SupplierProduct sp : links) {
            Product p = sp.getProduct();
            if (p == null || p.getId() == null || p.getId() <= 0 || !p.isActive())
                continue;

            java.math.BigDecimal stock = inventoryRepository
                    .findByProductId(p.getId())
                    .map(Inventory::getStockActual)
                    .orElse(java.math.BigDecimal.ZERO);
            java.math.BigDecimal min = p.getMinStockLevel() != null
                    ? p.getMinStockLevel() : java.math.BigDecimal.ZERO;

            // urgencia
            String urgencia;
            if (stock.signum() == 0)                              urgencia = "agotado";
            else if (stock.compareTo(min) <= 0)                   urgencia = "bajo";
            else if (min.signum() > 0 && stock.compareTo(
                    min.multiply(new java.math.BigDecimal("1.5"))) <= 0)
                urgencia = "proximo";
            else                                                  urgencia = "ok";

            // sugerido solo si conviene pedir (no 'ok'); doble del mínimo − stock
            java.math.BigDecimal sugerido = urgencia.equals("ok")
                    ? java.math.BigDecimal.ZERO
                    : min.multiply(java.math.BigDecimal.TWO).subtract(stock)
                    .max(java.math.BigDecimal.ONE);

            java.util.Map<String, Object> m = new java.util.LinkedHashMap<>();
            m.put("productId",   p.getId());
            m.put("sku",         p.getSku());
            m.put("name",        p.getName());
            m.put("stock",       stock);
            m.put("minStock",    min);
            m.put("urgencia",    urgencia);
            m.put("sugerido",    sugerido);
            m.put("lastCost",    sp.getLastCost());
            m.put("supplierSku", sp.getSupplierSku());
            m.put("codigoFabricante", codigoFabricante(p));
            productos.add(m);
        }

        // orden: primero lo más urgente (agotado > bajo > proximo > ok)
        java.util.Map<String, Integer> rank = java.util.Map.of(
                "agotado", 0, "bajo", 1, "proximo", 2, "ok", 3);
        productos.sort((a, b) -> Integer.compare(
                rank.get(a.get("urgencia")), rank.get(b.get("urgencia"))));

        java.util.Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("supplierId",   prov.getId());
        out.put("supplierName", prov.getCompanyName());
        out.put("telefono",     prov.getPhoneNumber());
        out.put("productos",    productos);
        return out;
    }


    // ── BORRADO PERMANENTE ──────────────────────────────────────────────────
    // Esto SI borra el renglon. No hay deshacer.
    //
    // Los tres candados de abajo no son burocracia: si el producto ya aparece
    // en una venta, su renglon esta amarrado a sale_items, y esas ventas son
    // registros fiscales que hay obligacion de conservar cinco anios. Borrar
    // el producto rompe esas ventas.
    @Transactional
    public void borrarPermanente(Long id) {

        Product p = productRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException(
                        "El producto no existe o ya fue borrado."));

        // Candado 1: tiene que estar desactivado. Obliga a pasar por
        // "dado de baja" antes de borrar, y da tiempo a que alguien note
        // que ese producto si se ocupaba.
        if (p.isActive())
            throw new IllegalArgumentException(
                    "Primero desactiva el producto. Solo se borran los que ya "
                            + "estan dados de baja.");

        // Candado 2: nunca se vendio. Este es el importante.
        long enVentas = saleItemRepository.countByProductId(id);
        if (enVentas > 0)
            // Mensaje CORTO a proposito: api.js del frontend reemplaza por uno
            // generico cualquier texto de mas de 120 caracteres, y el usuario
            // se quedaba sin saber por que no se borraba.
            throw new IllegalArgumentException(
                    "Ya se vendio " + enVentas + " vez(ces). Solo se puede desactivar.");

        // Candado 3: tampoco en documentos ya emitidos
        if (prefacturaItemRepository.countByProductId(id) > 0)
            throw new IllegalArgumentException(
                    "No se puede borrar: aparece en pre-facturas.");
        if (purchaseOrderItemRepository.countByProductId(id) > 0)
            throw new IllegalArgumentException(
                    "No se puede borrar: aparece en ordenes de compra.");

        // Lo que SI es desechable: cuelga del producto y no tiene valor
        // fiscal. Se borra ANTES, o Postgres rechaza por las llaves foraneas.
        productImageRepository.deleteByProductId(id);
        priceHistoryRepository.deleteByProductId(id);
        supplierProductRepository.deleteByProductId(id);
        inventoryRepository.deleteByProductId(id);

        productRepository.delete(p);
    }

    // ── ACTIVAR / DESACTIVAR VARIOS DE UN JALON ─────────────────────────────
    // Para trabajar el catalogo dormido: se importan miles de productos del
    // libro de Truper inactivos, y se van activando los que de verdad se
    // manejan. Uno por uno seria imposible con 15,000 renglones.
    @Transactional
    public int cambiarEstadoMasivo(List<Long> ids, boolean activo) {
        if (ids == null || ids.isEmpty()) return 0;
        if (ids.size() > 5000)
            throw new IllegalArgumentException(
                    "Demasiados productos de un jalon (maximo 5000). Hazlo por partes.");

        List<Product> productos = productRepository.findAllById(ids);
        for (Product p : productos) p.setActive(activo);
        productRepository.saveAll(productos);
        return productos.size();
    }
}