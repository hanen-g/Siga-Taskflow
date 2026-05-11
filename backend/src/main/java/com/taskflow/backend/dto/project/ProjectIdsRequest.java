package com.taskflow.backend.dto.project;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
public class ProjectIdsRequest {
    private List<Long> projectIds;
}
