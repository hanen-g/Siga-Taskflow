package com.taskflow.backend.dto.message;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class ProjectChatUnreadResponse {
    private long count;
}
