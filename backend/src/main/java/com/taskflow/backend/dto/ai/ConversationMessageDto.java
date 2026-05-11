package com.taskflow.backend.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
public class ConversationMessageDto {
    /** "user" or "assistant" */
    private String role;
    private String content;
}
