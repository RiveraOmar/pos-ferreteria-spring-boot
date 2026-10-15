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

@Configuration
@EnableWebSecurity
@EnableMethodSecurity  
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthFilter jwtAuthFilter;

    @Value("${app.security.admin.username:dueno}")   private String adminUser;
    @Value("${app.security.admin.password}")         private String adminPass;
    @Value("${app.security.seller.username:empleado1}") private String sellerUser;
    @Value("${app.security.seller.password}")        private String sellerPass;

   
    @Value("${app.cors.allowed-origins:http://localhost:5500}")
    private String allowedOrigins;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable()) 
                .sessionManagement(sm -> sm
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                       
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers("/uploads/**").permitAll()
                        .requestMatchers(
                                "/swagger-ui/**", "/swagger-ui.html", "/v3/api-docs/**"
                        ).permitAll()
                        .requestMatchers("/api/reports/**").hasRole("ADMIN")
                       .requestMatchers("/api/dev/**").hasRole("ADMIN")
                        .requestMatchers("/api/cfdi/**").hasRole("ADMIN")
                       .requestMatchers(HttpMethod.GET, "/api/configuracion/facturacion/**")
                            .hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/configuracion/facturacion/**").hasRole("ADMIN")
                        .requestMatchers("/api/suppliers/**").hasRole("ADMIN")
                        .requestMatchers("/api/purchase-orders/**").hasRole("ADMIN")
                        .requestMatchers("/api/inventory/stock-masivo").hasRole("ADMIN")
                        .requestMatchers("/api/inventory/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/products/*/costo").hasRole("ADMIN")

                        .requestMatchers(HttpMethod.POST,   "/api/products/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT,    "/api/products/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PATCH,  "/api/products/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/products/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/products/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/sat/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/sales/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/cart/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/customers/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers(HttpMethod.GET, "/api/categories/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/categories/**").hasRole("ADMIN")
                        .requestMatchers("/api/debts/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/prefacturas/**").hasAnyRole("ADMIN", "SELLER")
                        .requestMatchers("/api/uploads/**").hasAnyRole("ADMIN", "SELLER")
                        .anyRequest().authenticated()
                )
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
List<String> patrones = new ArrayList<>(
                Arrays.stream(allowedOrigins.split(",")).map(String::trim).toList());

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