package com.taskflow.backend.controller;

import com.taskflow.backend.dto.ai.AiChatRequest;
import com.taskflow.backend.dto.ai.AiChatResponse;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.AiAssistantService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai")
@CrossOrigin(originPatterns = {"http://localhost:4200", "http://127.0.0.1:4200"})
@RequiredArgsConstructor
public class AiChatController {

    private final AiAssistantService aiAssistantService;

    @PostMapping("/chat")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AiChatResponse> chat(
            @RequestBody AiChatRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails
    ) {
        return ResponseEntity.ok(aiAssistantService.chat(userDetails.getUser(), request));
    }
}
