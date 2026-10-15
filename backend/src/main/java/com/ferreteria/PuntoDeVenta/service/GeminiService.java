package com.ferreteria.PuntoDeVenta.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    @Value("${gemini.api.key}")
    private String apiKey;

    private static final String BASE_URL =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent";

    private final RestTemplate restTemplate = crearRestTemplateConTimeout();

    private static RestTemplate crearRestTemplateConTimeout() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(8_000);  
        factory.setReadTimeout(20_000);     
        return new RestTemplate(factory);
    }

    public String consultarCompatibilidad(String pregunta) {
        if (pregunta == null || pregunta.isBlank()) {
            throw new IllegalArgumentException("La pregunta no puede estar vacía.");
        }

        String promptCompleto =
                "Eres un experto en refacciones automotrices y ferretería en México. " +
                        "Tu única tarea es responder a la pregunta del usuario proporcionando ESTRICTAMENTE un listado. " +
                        "Prioriza las marcas Gonher y LTH, pero incluye otras marcas comerciales comunes en México si aplican. " +
                        "\n\nREGLAS OBLIGATORIAS:" +
                        "\n1. NO des saludos, introducciones ni conclusiones." +
                        "\n2. NO uses párrafos largos." +
                        "\n3. Devuelve los datos usando viñetas (guiones '-')." +
                        "\n4. Cada elemento de la lista debe tener el formato: '- Marca: Número de parte'." +
                        "\n5. Si no estás seguro de un dato o no existe, dilo claramente en vez de inventar." +
                        "\n\nPregunta: " + pregunta;

        Map<String, Object> body = Map.of(
                "contents", List.of(
                        Map.of("parts", List.of(
                                Map.of("text", promptCompleto)
                        ))
                )
        );

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        HttpEntity<Map<String, Object>> request = new HttpEntity<>(body, headers);

        String url = BASE_URL + "?key=" + apiKey;

        int intentos    = 0;
        int maxIntentos = 3;

        while (intentos < maxIntentos) {
            try {
                ResponseEntity<Map> response = restTemplate.postForEntity(url, request, Map.class);
                Map<?, ?> responseBody = response.getBody();

                if (responseBody == null || !responseBody.containsKey("candidates")) {
                    throw new RuntimeException("Respuesta vacía de Gemini.");
                }

                List<?> candidates    = (List<?>) responseBody.get("candidates");
                Map<?, ?> firstCandidate = (Map<?, ?>) candidates.get(0);
                Map<?, ?> content     = (Map<?, ?>) firstCandidate.get("content");
                List<?> parts         = (List<?>) content.get("parts");
                Map<?, ?> firstPart   = (Map<?, ?>) parts.get(0);

                return (String) firstPart.get("text");

            } catch (org.springframework.web.client.HttpServerErrorException e) {
                System.out.println("GEMINI 503 (intento " + (intentos + 1) + "): "
                        + e.getResponseBodyAsString());
                intentos++;
                if (intentos >= maxIntentos) {
                    return "El servicio de IA está temporalmente saturado por alta demanda. " +
                            "Intenta de nuevo en un momento.";
                }
                try {
                    Thread.sleep(1500L * intentos);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                }

            } catch (org.springframework.web.client.HttpClientErrorException e) {
                System.out.println("ERROR DE GOOGLE: " + e.getResponseBodyAsString());

                if (e.getStatusCode() == HttpStatus.TOO_MANY_REQUESTS) {
                    return "El servicio de IA está saturado en este momento. " +
                            "Por favor, intenta de nuevo en unos segundos.";
                }
                return "No se pudo consultar la compatibilidad. Revisa la conexión o la API key.";

            } catch (ResourceAccessException e) {
                System.out.println("GEMINI sin respuesta a tiempo: " + e.getMessage());
                return "No se pudo contactar al asistente de IA (sin internet o " +
                        "tardó demasiado). El resto del sistema sigue funcionando " +
                        "normal — intenta de nuevo en un momento.";
            } catch (Exception e) {
                e.printStackTrace();
                return "Error interno al contactar al asistente de refacciones.";
            }
        }

        return "No se pudo obtener respuesta del servicio de IA. Intenta de nuevo.";
    }
}