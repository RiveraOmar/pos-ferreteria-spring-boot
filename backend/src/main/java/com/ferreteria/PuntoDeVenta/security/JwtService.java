package com.ferreteria.PuntoDeVenta.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Genera y valida tokens JWT. El token lleva el usuario y sus roles firmados
 * con una clave secreta del servidor: nadie puede falsificarlo sin la clave.
 * El token EXPIRA (por defecto 12 h), así que una sesión robada no vive para
 * siempre.
 */
@Service
public class JwtService {

    // Clave secreta para firmar. DEBE venir de config (ferrepos.properties) y
    // ser larga y aleatoria en producción. Nunca subir a Git.
    @Value("${app.jwt.secret}")
    private String secret;

    // Duración del token en milisegundos (por defecto 12 horas)
    @Value("${app.jwt.expiration-ms:43200000}")
    private long expirationMs;

    private SecretKey clave() {
        return Keys.hmacShaKeyFor(secret.getBytes());
    }

    /** Genera un token para un usuario autenticado, con sus roles dentro. */
    public String generarToken(UserDetails user) {
        Map<String, Object> claims = new HashMap<>();
        claims.put("roles", user.getAuthorities().stream()
                .map(a -> a.getAuthority())
                .collect(Collectors.toList()));
        return Jwts.builder()
                .setClaims(claims)
                .setSubject(user.getUsername())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + expirationMs))
                .signWith(clave(), SignatureAlgorithm.HS256)
                .compact();
    }

    public String extraerUsuario(String token) {
        return extraerClaim(token, Claims::getSubject);
    }

    public Date extraerExpiracion(String token) {
        return extraerClaim(token, Claims::getExpiration);
    }

    public <T> T extraerClaim(String token, Function<Claims, T> resolver) {
        return resolver.apply(extraerTodos(token));
    }

    private Claims extraerTodos(String token) {
        return Jwts.parserBuilder()
                .setSigningKey(clave())
                .build()
                .parseClaimsJws(token)
                .getBody();
    }

    /** Un token es válido si es del usuario correcto y no ha expirado. */
    public boolean esValido(String token, UserDetails user) {
        final String usuario = extraerUsuario(token);
        return usuario.equals(user.getUsername()) && !expirado(token);
    }

    private boolean expirado(String token) {
        return extraerExpiracion(token).before(new Date());
    }
}