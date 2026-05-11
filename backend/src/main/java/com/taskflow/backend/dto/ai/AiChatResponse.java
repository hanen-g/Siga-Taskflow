package com.taskflow.backend.dto.ai;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiChatResponse {
    private String assistantMessage;
    private String actionType;
    private AiFilterPayload filters;
    @Builder.Default
    private List<Map<String, Object>> results = new ArrayList<>();
    private int resultCount;
    private String dataSnapshot;
    private String suggestion;
    @Builder.Default
    private List<String> suggestedFollowUps = new ArrayList<>();
}
