import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useUpload, type UploadRequest, type UploadResponse } from '../../hooks/useUpload';

const BASE_URL = 'http://localhost:8080';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useUpload', () => {
  it('should upload file and return arquivoId', async () => {
    const mockResponse: UploadResponse = {
      arquivoId: '789',
    };

    server.use(
      http.post(`${BASE_URL}/v1/uploads`, () => {
        return HttpResponse.json(mockResponse);
      })
    );

    const { result } = renderHook(() => useUpload(), { wrapper: createWrapper() });

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const uploadRequest: UploadRequest = {
      file,
      ownerType: 'imovel',
      ownerId: '456',
    };

    result.current.mutate(uploadRequest);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockResponse);
    expect(result.current.data?.arquivoId).toBe('789');
  });

  it('should handle upload mutation error', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/uploads`, () =>
        new HttpResponse('Upload limit exceeded', { status: 413 })
      )
    );

    const { result } = renderHook(() => useUpload(), { wrapper: createWrapper() });

    const file = new File(['test'], 'large.pdf', { type: 'application/pdf' });
    const uploadRequest: UploadRequest = {
      file,
      ownerType: 'laudo',
      ownerId: '789',
    };

    result.current.mutate(uploadRequest);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should support different owner types', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/uploads`, () =>
        HttpResponse.json({
          arquivoId: '1',
        })
      )
    );

    const { result } = renderHook(() => useUpload(), { wrapper: createWrapper() });

    const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    result.current.mutate({
      file,
      ownerType: 'comprovante-pagamento',
      ownerId: '1',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.arquivoId).toBe('1');
  });

  it('should handle mutation state transitions', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/uploads`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return HttpResponse.json({
          arquivoId: '1',
        });
      })
    );

    const { result } = renderHook(() => useUpload(), { wrapper: createWrapper() });

    expect(result.current.isPending).toBe(false);

    const file = new File(['test'], 'test.webp', { type: 'image/webp' });
    result.current.mutate({
      file,
      ownerType: 'imovel',
      ownerId: '1',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.data).toBeDefined();
  });

  it('should accept different file types', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/uploads`, () =>
        HttpResponse.json({ arquivoId: '1' })
      )
    );

    const { result } = renderHook(() => useUpload(), { wrapper: createWrapper() });
    const file = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    result.current.mutate({
      file,
      ownerType: 'laudo',
      ownerId: '1',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.arquivoId).toBe('1');
  });
});
