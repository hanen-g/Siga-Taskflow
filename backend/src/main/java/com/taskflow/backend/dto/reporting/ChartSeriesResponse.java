package com.taskflow.backend.dto.reporting;

import java.util.List;

public record ChartSeriesResponse(List<String> labels, List<Long> values) {
}
