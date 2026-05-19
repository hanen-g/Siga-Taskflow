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
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class OllamaService {

    private static final Map<String, Object> CHAT_OPTIONS = Map.of(
            "num_predict", 300,
            "temperature", 0.7
    );

    private static final Map<String, Object> PRELOAD_OPTIONS = Map.of(
            "num_predict", 1,
            "temperature", 0.7
    );

    private static final Map<String, Object> FOLLOWUP_GENERATE_OPTIONS =
            Map.of("temperature", 0.25, "num_predict", 120, "top_p", 0.9, "repeat_penalty", 1.1);

    private static final Map<String, Object> DEADLINE_PREDICTION_OPTIONS =
            Map.of("temperature", 0.2, "num_predict", 220, "top_p", 0.9, "repeat_penalty", 1.1);

    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${ollama.api.url:http://localhost:11434/api/generate}")
    private String ollamaApiUrl;

    @Value("${ollama.chat.api.url:http://localhost:11434/api/chat}")
    private String ollamaChatApiUrl;

    @Value("${ollama.model:llama3.2}")
    private String ollamaModel;

    public void preloadModel() {
        try {
            List<Map<String, String>> messages = List.of(Map.of("role", "user", "content", "ping"));
            rawChat(messages, PRELOAD_OPTIONS);
        } catch (Exception ignored) {
            // preload is best-effort
        }
    }

    public String generate(String prompt) {
        JsonNode raw = rawGenerate(prompt);
        if (raw == null) {
            return "";
        }
        return raw.asText("");
    }

    public JsonNode rawGenerate(String prompt) throws RestClientException {
        return rawGenerate(prompt, FOLLOWUP_GENERATE_OPTIONS);
    }

    public JsonNode rawGenerateFollowUps(String prompt) throws RestClientException {
        return rawGenerate(prompt, FOLLOWUP_GENERATE_OPTIONS);
    }

    public JsonNode rawGenerateDeadlinePrediction(String prompt) throws RestClientException {
        return rawGenerate(prompt, DEADLINE_PREDICTION_OPTIONS);
    }

    public JsonNode rawChat(List<Map<String, String>> messages) throws RestClientException {
        return rawChat(messages, CHAT_OPTIONS);
    }

    public JsonNode rawChat(List<Map<String, String>> messages, Map<String, Object> options)
            throws RestClientException {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("model", ollamaModel);
        payload.put("messages", messages);
        payload.put("stream", false);
        if (options != null && !options.isEmpty()) {
            payload.put("options", options);
        }
        String bodyJson;
        try {
            bodyJson = objectMapper.writeValueAsString(payload);
        } catch (Exception e) {
            throw new IllegalStateException("serialize ollama chat request", e);
        }
        HttpEntity<String> entity = new HttpEntity<>(bodyJson, headers);
        JsonNode body = restTemplate.exchange(ollamaChatApiUrl, HttpMethod.POST, entity, JsonNode.class).getBody();
        if (body == null || !body.hasNonNull("message")) {
            return null;
        }
        JsonNode message = body.get("message");
        if (!message.hasNonNull("content")) {
            return null;
        }
        return message.get("content");
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
