import { useMutation } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export interface UploadRequest {
  file: File;
  ownerType: string;
  ownerId: string;
}

export interface UploadResponse {
  arquivoId: string;
}

export const useUpload = () => {
  return useMutation({
    mutationFn: async (data: UploadRequest) => {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('ownerType', data.ownerType);
      formData.append('ownerId', data.ownerId);

      const response = await fetch(`${API_BASE_URL}/v1/uploads`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} - ${error}`);
      }

      return response.json() as Promise<UploadResponse>;
    },
  });
};
