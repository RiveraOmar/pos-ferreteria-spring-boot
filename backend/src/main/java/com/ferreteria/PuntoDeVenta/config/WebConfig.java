package com.ferreteria.PuntoDeVenta.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Paths;

/**
 * Sirve las imágenes de producto subidas (carpeta física `uploads/`) bajo la
 * URL pública `/uploads/**`. Así una foto guardada como `/uploads/prod_ab12.jpg`
 * se puede mostrar directamente en un <img src="...">.
 */
@Configuration
public class WebConfig implements WebMvcConfigurer {

    @Value("${app.uploads.dir:uploads}")
    private String uploadsDir;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String ruta = Paths.get(uploadsDir).toAbsolutePath().normalize().toString();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations("file:" + ruta + "/")
                .setCachePeriod(3600);
    }
}