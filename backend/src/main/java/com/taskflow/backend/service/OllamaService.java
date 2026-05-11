package com.taskflow.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OllamaService {

    /** Keeps JSON answers bounded; speeds up generation on CPU. */
    private static final Map<String, Object> MAIN_GENERATE_OPTIONS =
            Map.of("temperature", 0.2, "num_predict", 1024);

    /** Tiny output for follow-up suggestions only. */
    private static final Map<String, Object> FOLLOWUP_GENERATE_OPTIONS =
            Map.of("temperature", 0.25, "num_predict", 220);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ollama.api.url:http://localhost:11434/api/generate}")
    private String ollamaApiUrl;

    @Value("${ollama.model:mistral}")
    private String ollamaModel;

    /** Plain generate (no structured JSON enforced). Used for suggestion follow-ups. */
    public String generate(String prompt) {
        JsonNode raw = rawGenerate(prompt);
        if (raw == null) {
            return "";
        }
        return raw.asText("");
    }

    public JsonNode rawGenerate(String prompt) throws RestClientException {
        return rawGenerate(prompt, MAIN_GENERATE_OPTIONS);
    }

    /** Short follow-up JSON; keeps the second call fast after the main chat completion. */
    public JsonNode rawGenerateFollowUps(String prompt) throws RestClientException {
        return rawGenerate(prompt, FOLLOWUP_GENERATE_OPTIONS);
    }

    public JsonNode rawGenerate(String prompt, Map<String, Object> options) throws RestClientException {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", ollamaModel);
        payload.put("prompt", prompt);
        payload.put("stream", false);
        if (options != null && !options.isEmpty()) {
            payload.put("options", options);
        }
        String json;
        try {
            json = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("serialize ollama request", e);
        }
        HttpEntity<String> entity = new HttpEntity<>(json, headers);
        JsonNode body = restTemplate.exchange(ollamaApiUrl, HttpMethod.POST, entity, JsonNode.class).getBody();
        if (body == null || !body.hasNonNull("response")) {
            return null;
        }
        return body.get("response");
    }
}
