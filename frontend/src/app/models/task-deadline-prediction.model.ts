export interface TaskDeadlinePredictionRequest {
  projectId: number;
  title: string;
  description?: string;
  priority: string;
  collaboratorEmail: string;
}

export interface TaskDeadlinePredictionResponse {
  predictedDeadline: string;
  estimatedWorkingDays: number;
  explanation: string;
  closeToProjectDeadline: boolean;
}
