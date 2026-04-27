package com.taskflow.backend.controller;

import com.taskflow.backend.dto.websocket.Notification;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.NotificationService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/my")
    public List<Notification> getMyNotifications(@AuthenticationPrincipal CustomUserDetails userDetails) {
        return notificationService.getNotificationsForUser(userDetails.getUser());
    }

    @PutMapping("/read-all")
    public void markAllAsRead(@AuthenticationPrincipal CustomUserDetails userDetails) {
        notificationService.markAllAsRead(userDetails.getUser());
    }

    @DeleteMapping("/my")
    public void clearMyNotifications(@AuthenticationPrincipal CustomUserDetails userDetails) {
        notificationService.clearAll(userDetails.getUser());
    }
}
