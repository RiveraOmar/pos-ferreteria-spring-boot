package com.ferreteria.PuntoDeVenta.config;

import com.ferreteria.PuntoDeVenta.security.JwtAuthFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.http.HttpMethod;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

/**
 * Seguridad con JWT (tokens), lista para un servidor expuesto a internet:
 *   • Contraseñas encriptadas con BCrypt (ya no en texto plano).
 *   • Sesiones STATELESS: cada petición se valida por su token, sin estado
 *     en el servidor → escala y no hay sesiones que secuestrar.
 *   • CORS y usuarios se leen de ferrepos.properties (nada hardcodeado).
 *   • Login público; todo lo demás requiere token válido.
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity   // habilita @PreAuthorize (ej. el costo solo para ADMIN)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${app.security.admin.username:dueno}")   private String adminUser;
    @Value("${app.security.admin.password}")         private String adminPass;
    @Value("${app.security.seller.username:empleado1}") private String sellerUser;
    @Value("${app.security.seller.password}")        private String sellerPass;

    // Orígenes permitidos (frontend). En producción: tu dominio con https.
    @Value("${app.cors.allowed-origins:http://localhost:5500}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable()) // stateless con JWT: CSRF no aplica
                .sessionManagement(sm -> sm
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // ── Público: login e imágenes ──
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/uploads/**").permitAll()
                        .requestMatchers(
                                "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**"
                        ).permitAll()
                        // ── Por rol ──
                        .requestMatchers("/api/reports/**").hasRole("ADMIN")
                        // Consola de desarrollo (SQL directo) — solo el dueño/admin.
                        // Todo lo demás (GET, POST, cualquier método) cae aquí.
                        .requestMatchers("/api/dev/**").hasRole("ADMIN")
                        .requestMatchers("/api/cfdi/**").hasRole("ADMIN")
                        // Periodicidad de la factura global — solo el dueño la cambia.
                        // GET (ver la config actual) sí lo puede ver el vendedor.
                        .requestMatchers(HttpMethod.GET, "/api/configuracion/facturacion/**")
                            .hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/configuracion/facturacion/**").hasRole("ADMIN")
                        .requestMatchers("/api/suppliers/**").hasRole("ADMIN")
                        .requestMatchers("/api/purchase-orders/**").hasRole("ADMIN")
                        // Carga masiva de existencias: mueve el stock de TODO el
                        // catálogo de un clic. Solo el dueño. Debe ir ANTES de la
                        // regla general de inventory o quedaría tapada.
                        .requestMatchers("/api/inventory/stock-masivo").hasRole("ADMIN")
                        .requestMatchers("/api/inventory/**").hasAnyRole("ADMIN", "SELLER")
                        // ── PRODUCTOS ────────────────────────────────────────
                        // El costo revela el margen: solo el dueño. Debe ir ANTES
                        // de la regla general de products o quedaría tapada.
                        .requestMatchers("/api/products/*/costo").hasRole("ADMIN")

                        // Crear, editar y borrar productos: SOLO el dueño.
                        // Antes un VENDEDOR podía hacer PUT /api/products/{id} y
                        // cambiar listPrice, minPrice y costPrice. Con eso evadía
                        // el precio mínimo: lo bajaba, vendía barato y lo devolvía
                        // a su valor. El vendedor vende; no fija precios.
                        .requestMatchers(HttpMethod.POST,   "/api/products/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT,    "/api/products/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH,  "/api/products/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/products/**").hasRole("ADMIN")
                        // Consultar el catálogo: vendedor también (lo necesita para vender)
                        .requestMatchers(HttpMethod.GET, "/api/products/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/sat/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/sales/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/cart/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/customers/**").hasAnyRole("ADMIN", "SELLER")
                        // Categorías: el vendedor las consulta, el dueño las define
                        .requestMatchers(HttpMethod.GET, "/api/categories/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/categories/**").hasRole("ADMIN")
                        .requestMatchers("/api/debts/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/prefacturas/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/uploads/**").hasAnyRole("ADMIN", "SELLER")
                        .anyRequest().authenticated()
                )
                // El filtro JWT corre antes del de usuario/contraseña
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public UserDetailsService userDetailsService(PasswordEncoder encoder) {
        UserDetails admin = User.builder()
                .username(adminUser)
                .password(encoder.encode(adminPass))
                .roles("ADMIN")
                .build();
        UserDetails seller = User.builder()
                .username(sellerUser)
                .password(encoder.encode(sellerPass))
                .roles("SELLER")
                .build();
        return new InMemoryUserDetailsManager(admin, seller);
    }

    @Bean
    public AuthenticationManager authenticationManager(
            AuthenticationConfiguration config) throws Exception {
        return config.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        // Las direcciones explícitas de ferrepos.properties SIGUEN funcionando
        // (compatibilidad con lo que ya había)...
        List<String> patrones = new ArrayList<>(
                Arrays.stream(allowedOrigins.split(",")).map(String::trim).toList());

        // ...y ADEMÁS se acepta automáticamente cualquier dispositivo dentro de
        // TU MISMA red local (celular, tablet, otra PC), sin importar qué IP
        // le toque en el momento — así no hay que volver a tocar este archivo
        // cada vez que el router reparte una IP distinta.
        patrones.add("http://192.168.*.*:5500");
        patrones.add("http://10.*.*.*:5500");
        patrones.add("http://172.16.*.*:5500");

        configuration.setAllowedOriginPatterns(patrones);
        configuration.setAllowedMethods(
                Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}