import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  useLaudo,
  useCreateLaudo,
  useUpdateLaudo,
  useFinalizeLaudo,
  useNovaVersaoLaudo,
  useRequestSignature,
  useRelatorioImobiliaria,
  type Laudo,
  type RelatorioImobiliaria,
} from '../../api/laudos';

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

describe('useLaudo', () => {
  it('should fetch laudo by id', async () => {
    const mockData: Laudo = {
      id: '123',
      servicoId: '456',
      conteudoJson: '{"tipo":"vistoria"}',
      status: 'RASCUNHO',
      criadoEm: '2024-01-01T10:00:00Z',
      atualizadoEm: '2024-01-01T10:00:00Z',
    };

    server.use(
      http.get(`${BASE_URL}/v1/laudos/123`, () => HttpResponse.json(mockData))
    );

    const { result } = renderHook(() => useLaudo('123'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('123');
    expect(result.current.data?.status).toBe('RASCUNHO');
  });

  it('should not fetch when id is empty string', async () => {
    let called = false;
    server.use(
      http.get(`${BASE_URL}/v1/laudos/`, () => {
        called = true;
        return HttpResponse.json({});
      })
    );

    const { result } = renderHook(() => useLaudo(''), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(called).toBe(false);
    }, { timeout: 500 });

    expect(result.current.isLoading).toBe(false);
  });

  it('should refetch when id changes', async () => {
    let requestCount = 0;

    server.use(
      http.get(`${BASE_URL}/v1/laudos/:id`, ({ params }) => {
        requestCount++;
        return HttpResponse.json({
          id: params.id,
          servicoId: '1',
          conteudoJson: '{}',
          status: 'RASCUNHO',
          criadoEm: '2024-01-01T10:00:00Z',
          atualizadoEm: '2024-01-01T10:00:00Z',
        });
      })
    );

    const { result, rerender } = renderHook(
      (props) => useLaudo(props.id),
      {
        initialProps: { id: '1' },
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current.data?.id).toBe('2');
    });

    expect(requestCount).toBe(2);
  });

  it('should handle API errors', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/laudos/999`, () =>
        new HttpResponse('Not found', { status: 404 })
      )
    );

    const { result } = renderHook(() => useLaudo('999'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useCreateLaudo', () => {
  it('should create laudo with servicoId', async () => {
    let capturedBody: any;

    server.use(
      http.post(`${BASE_URL}/v1/laudos`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: '1',
          servicoId: '456',
          conteudoJson: '{}',
          status: 'RASCUNHO',
          criadoEm: '2024-01-01T10:00:00Z',
          atualizadoEm: '2024-01-01T10:00:00Z',
        });
      })
    );

    const { result } = renderHook(() => useCreateLaudo(), { wrapper: createWrapper() });

    result.current.mutate('456');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(capturedBody.servicoId).toBe('456');
  });

  it('should handle creation errors', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/laudos`, () =>
        new HttpResponse('Service not found', { status: 404 })
      )
    );

    const { result } = renderHook(() => useCreateLaudo(), { wrapper: createWrapper() });

    result.current.mutate('999');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useUpdateLaudo', () => {
  it('should update laudo content', async () => {
    let capturedBody: any;

    server.use(
      http.patch(`${BASE_URL}/v1/laudos/123`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: '123',
          servicoId: '456',
          conteudoJson: '{"updated":true}',
          status: 'RASCUNHO',
          criadoEm: '2024-01-01T10:00:00Z',
          atualizadoEm: '2024-01-02T11:00:00Z',
        });
      })
    );

    const { result } = renderHook(() => useUpdateLaudo(), { wrapper: createWrapper() });

    result.current.mutate({
      laudoId: '123',
      conteudoJson: '{"updated":true}',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(capturedBody.conteudoJson).toBe('{"updated":true}');
  });

  it('should handle update errors', async () => {
    server.use(
      http.patch(`${BASE_URL}/v1/laudos/999`, () =>
        new HttpResponse('Not found', { status: 404 })
      )
    );

    const { result } = renderHook(() => useUpdateLaudo(), { wrapper: createWrapper() });

    result.current.mutate({
      laudoId: '999',
      conteudoJson: '{}',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useFinalizeLaudo', () => {
  it('should finalize laudo', async () => {
    let called = false;

    server.use(
      http.post(`${BASE_URL}/v1/laudos/123/finalizar`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    const { result } = renderHook(() => useFinalizeLaudo(), { wrapper: createWrapper() });

    result.current.mutate('123');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(called).toBe(true);
  });

  it('should handle finalize errors', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/laudos/999/finalizar`, () =>
        new HttpResponse('Cannot finalize', { status: 400 })
      )
    );

    const { result } = renderHook(() => useFinalizeLaudo(), { wrapper: createWrapper() });

    result.current.mutate('999');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useNovaVersaoLaudo', () => {
  it('should create new version of laudo', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/laudos/123/nova-versao`, () =>
        HttpResponse.json({
          id: '124',
          servicoId: '456',
          conteudoJson: '{}',
          status: 'RASCUNHO',
          criadoEm: '2024-01-02T10:00:00Z',
          atualizadoEm: '2024-01-02T10:00:00Z',
        })
      )
    );

    const { result } = renderHook(() => useNovaVersaoLaudo(), { wrapper: createWrapper() });

    result.current.mutate('123');

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('124');
  });

  it('should handle version creation errors', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/laudos/999/nova-versao`, () =>
        new HttpResponse('Laudo not found', { status: 404 })
      )
    );

    const { result } = renderHook(() => useNovaVersaoLaudo(), { wrapper: createWrapper() });

    result.current.mutate('999');

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useRequestSignature', () => {
  it('should request signature on document', async () => {
    let capturedBody: any;

    server.use(
      http.post(`${BASE_URL}/v1/documentos/LAUDO/123/assinar`, async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 204 });
      })
    );

    const { result } = renderHook(() => useRequestSignature(), { wrapper: createWrapper() });

    result.current.mutate({ tipo: 'LAUDO', id: '123' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // O backend monta os signatários de solicitacao_intervenientes — o corpo vai vazio.
    expect(capturedBody).toEqual([]);
  });

  it('should handle signature request errors', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/documentos/LAUDO/999/assinar`, () =>
        new HttpResponse('Document not found', { status: 404 })
      )
    );

    const { result } = renderHook(() => useRequestSignature(), { wrapper: createWrapper() });

    result.current.mutate({ tipo: 'LAUDO', id: '999' });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should handle different document types', async () => {
    let capturedType: string | undefined;

    server.use(
      http.post(`${BASE_URL}/v1/documentos/:tipo/:id/assinar`, ({ params }) => {
        capturedType = params.tipo as string;
        return new HttpResponse(null, { status: 204 });
      })
    );

    const { result } = renderHook(() => useRequestSignature(), { wrapper: createWrapper() });

    result.current.mutate({ tipo: 'RELATORIO', id: '456' });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(capturedType).toBe('RELATORIO');
  });
});

describe('useRelatorioImobiliaria', () => {
  it('should fetch relatorio with mes parameter', async () => {
    const mockData: RelatorioImobiliaria = {
      imobiliariaId: '1',
      mes: '2024-01',
      volume: 10,
      faturamento: 50000,
      faturamentoMinimo: 40000,
      minimoAplicado: false,
      faturamentoCobrado: 50000,
    };

    server.use(
      http.get(`${BASE_URL}/v1/relatorios/imobiliaria`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('mes')).toBe('2024-01');
        return HttpResponse.json(mockData);
      })
    );

    const { result } = renderHook(() => useRelatorioImobiliaria('2024-01'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.mes).toBe('2024-01');
    expect(result.current.data?.volume).toBe(10);
  });

  it('should include imobiliariaId if provided', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/relatorios/imobiliaria`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('mes')).toBe('2024-01');
        expect(url.searchParams.get('imobiliariaId')).toBe('42');
        return HttpResponse.json({
          imobiliariaId: '42',
          mes: '2024-01',
          volume: 5,
          faturamento: 25000,
          faturamentoMinimo: null,
          minimoAplicado: false,
          faturamentoCobrado: 25000,
        });
      })
    );

    const { result } = renderHook(
      () => useRelatorioImobiliaria('2024-01', '42'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.imobiliariaId).toBe('42');
  });

  it('should not fetch when mes is falsy', async () => {
    let called = false;
    server.use(
      http.get(`${BASE_URL}/v1/relatorios/imobiliaria`, () => {
        called = true;
        return HttpResponse.json({});
      })
    );

    const { result } = renderHook(() => useRelatorioImobiliaria(''), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(called).toBe(false);
    }, { timeout: 500 });

    expect(result.current.isLoading).toBe(false);
  });

  it('should refetch when mes changes', async () => {
    let requestCount = 0;

    server.use(
      http.get(`${BASE_URL}/v1/relatorios/imobiliaria`, ({ request }) => {
        requestCount++;
        const url = new URL(request.url);
        const mes = url.searchParams.get('mes');
        return HttpResponse.json({
          imobiliariaId: '1',
          mes: mes || '2024-01',
          volume: 1,
          faturamento: 1000,
          faturamentoMinimo: null,
          minimoAplicado: false,
          faturamentoCobrado: 1000,
        });
      })
    );

    const { result, rerender } = renderHook(
      (props) => useRelatorioImobiliaria(props.mes),
      {
        initialProps: { mes: '2024-01' },
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.mes).toBe('2024-01');

    rerender({ mes: '2024-02' });

    await waitFor(() => {
      expect(result.current.data?.mes).toBe('2024-02');
    });

    expect(requestCount).toBe(2);
  });

  it('should handle API errors', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/relatorios/imobiliaria`, () =>
        new HttpResponse('Invalid month', { status: 400 })
      )
    );

    const { result } = renderHook(() => useRelatorioImobiliaria('invalid'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
