package com.taskflow.backend.controller;

import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api")
@CrossOrigin("*")
public class AiController {

    @PostMapping("/test")
    public String test() {
        return "Backend fonctionne";
    }

    @PostMapping("/chat")
    public String chat(@RequestBody String message) {

        RestTemplate restTemplate = new RestTemplate();
        String url = "http://localhost:11434/api/generate";

        String body = "{ \"model\": \"llama3\", \"prompt\": \"" + message + "\", \"stream\": false }";

        return restTemplate.postForObject(url, body, String.class);
    }
}