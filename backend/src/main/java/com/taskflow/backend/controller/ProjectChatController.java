package com.taskflow.backend.controller;

import com.taskflow.backend.dto.message.ProjectChatMessageResponse;
import com.taskflow.backend.dto.message.ProjectChatUnreadResponse;
import com.taskflow.backend.dto.message.SendProjectMessageRequest;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.ProjectChatService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects/{projectId}/messages")
@RequiredArgsConstructor
public class ProjectChatController {

    private final ProjectChatService projectChatService;

    @GetMapping
    public List<ProjectChatMessageResponse> getMessages(
            @PathVariable Long projectId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectChatService.getMessages(projectId, userDetails.getUser());
    }

    @GetMapping("/unread-count")
    public ProjectChatUnreadResponse getUnreadCount(
            @PathVariable Long projectId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectChatService.getUnreadCount(projectId, userDetails.getUser());
    }

    @PostMapping
    public ProjectChatMessageResponse sendMessage(
            @PathVariable Long projectId,
            @RequestBody SendProjectMessageRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return projectChatService.sendMessage(projectId, request, userDetails.getUser());
    }

    @PutMapping("/read")
    public void markAsRead(
            @PathVariable Long projectId,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        projectChatService.markMessagesAsRead(projectId, userDetails.getUser());
    }
}
