package com.taskflow.backend.controller;

import com.taskflow.backend.dto.comment.CommentRequest;
import com.taskflow.backend.dto.comment.CommentResponse;
import com.taskflow.backend.security.CustomUserDetails;
import com.taskflow.backend.service.CommentService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/comments")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    @PostMapping
    public CommentResponse addComment(
            @RequestBody CommentRequest request,
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return commentService.addComment(request, userDetails.getUser());
    }

    @GetMapping("/task/{taskId}")
    public List<CommentResponse> getCommentsByTask(@PathVariable Long taskId) {
        return commentService.getCommentsByTask(taskId);
    }
}