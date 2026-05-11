package com.taskflow.backend.dto.ai;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@JsonIgnoreProperties(ignoreUnknown = true)
@Data
public class AiChatRequest {
    private String message;
    private List<ConversationMessageDto> conversationHistory = new ArrayList<>();
    private ChatIntent intent = ChatIntent.UNKNOWN;
}
