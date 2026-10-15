package com.ferreteria.PuntoDeVenta.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.context.ApplicationContext;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Se ejecuta en CADA petición: si trae un token JWT válido en el header
 * "Authorization: Bearer xxx", autentica al usuario para esa petición.
 *
 * IMPORTANTE — sobre la referencia circular:
 * SecurityConfig necesita este filtro, y este filtro necesita servicios que
 * (indirectamente) define SecurityConfig -> ciclo. Para romperlo, este filtro
 * NO recibe sus dependencias por el constructor; las pide al ApplicationContext
 * de forma diferida (solo cuando ya hay un token que validar). Asi Spring puede
 * crear el filtro sin necesitar los otros beans todavia.
 */
@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    private final ApplicationContext contexto;

    public JwtAuthFilter(ApplicationContext contexto) {
        this.contexto = contexto;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String token = authHeader.substring(7);
        try {
            // Beans obtenidos de forma diferida (rompe el ciclo de creacion)
            JwtService jwtService = contexto.getBean(JwtService.class);
            UserDetailsService userDetailsService =
                    contexto.getBean(UserDetailsService.class);

            final String usuario = jwtService.extraerUsuario(token);

            if (usuario != null
                    && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails user = userDetailsService.loadUserByUsername(usuario);
                if (jwtService.esValido(token, user)) {
                    var auth = new UsernamePasswordAuthenticationToken(
                            user, null, user.getAuthorities());
                    auth.setDetails(new WebAuthenticationDetailsSource()
                            .buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(auth);
                }
            }
        } catch (Exception e) {
            // Token invalido/expirado: no autentica, la peticion sigue sin sesion
            logger.debug("Token JWT invalido: " + e.getMessage());
        }

        filterChain.doFilter(request, response);
    }
}