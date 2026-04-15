export interface UploadedFile {
  id: number;
  fileUrl: string;
  originalFileName: string;
  uploadedAt: string;
  uploadedById?: number;
  uploadedByEmail?: string;
  uploadedByName?: string;
  projectId?: number;
  taskId?: number;
  taskTitle?: string;
  scope: 'PROJECT' | 'TASK';
}
