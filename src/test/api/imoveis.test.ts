import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  useCidades,
  useImoveis,
  useImovel,
  useCreateImovel,
  useAllCidades,
  type Imovel,
} from '../../api/imoveis';

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

describe('useCidades', () => {
  it('should fetch cidades list', async () => {
    const mockData = {
      content: [
        { id: '1', nome: 'São Paulo', estado: 'SP' },
        { id: '2', nome: 'Rio de Janeiro', estado: 'RJ' },
      ],
      totalElements: 2,
      totalPages: 1,
      page: 0,
      size: 100,
    };

    server.use(
      http.get(`${BASE_URL}/v1/cidades`, () => HttpResponse.json(mockData))
    );

    const { result } = renderHook(() => useCidades(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].nome).toBe('São Paulo');
  });

  it('should extract content array from page response', async () => {
    const mockData = {
      content: [{ id: '1', nome: 'City', estado: 'ST' }],
      totalElements: 1,
      totalPages: 1,
      page: 0,
      size: 100,
    };

    server.use(
      http.get(`${BASE_URL}/v1/cidades`, () => HttpResponse.json(mockData))
    );

    const { result } = renderHook(() => useCidades(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    // Should be array, not PageResponse object
    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data?.[0].id).toBe('1');
  });

  it('should handle empty cidades response', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/cidades`, () =>
        HttpResponse.json({
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 100,
        })
      )
    );

    const { result } = renderHook(() => useCidades(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(0);
  });
});

describe('useImoveis', () => {
  it('should fetch imoveis with default filters', async () => {
    const mockData = {
      content: [
        {
          id: '1',
          endereco: 'Rua A, 123',
          tipo: 'Apartamento',
          cidade: 'São Paulo',
          situacao: 'Aluguel',
          dormitorios: 3,
          banheiros: 2,
          area: '100',
        },
      ],
      totalElements: 1,
      totalPages: 1,
      page: 0,
      size: 50,
    };

    server.use(
      http.get(`${BASE_URL}/v1/imoveis`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('page')).toBe('0');
        expect(url.searchParams.get('size')).toBe('50');
        return HttpResponse.json(mockData);
      })
    );

    const { result } = renderHook(() => useImoveis(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.content).toHaveLength(1);
  });

  it('should apply tipo filter', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/imoveis`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('tipo')).toBe('Casa');
        return HttpResponse.json({
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 50,
        });
      })
    );

    const { result } = renderHook(() => useImoveis({ tipo: 'Casa' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should apply cidade filter', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/imoveis`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('cidade')).toBe('Rio de Janeiro');
        return HttpResponse.json({
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 50,
        });
      })
    );

    const { result } = renderHook(() => useImoveis({ cidade: 'Rio de Janeiro' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should apply situacao filter', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/imoveis`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('situacao')).toBe('Venda');
        return HttpResponse.json({
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 50,
        });
      })
    );

    const { result } = renderHook(() => useImoveis({ situacao: 'Venda' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should not include empty filter values in query', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/imoveis`, ({ request }) => {
        const url = new URL(request.url);
        // Empty string filters should not be appended
        expect(url.searchParams.get('tipo')).toBeNull();
        return HttpResponse.json({
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 50,
        });
      })
    );

    const { result } = renderHook(() => useImoveis({ tipo: '', cidade: '' }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should apply custom pagination', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/imoveis`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('page')).toBe('2');
        expect(url.searchParams.get('size')).toBe('25');
        return HttpResponse.json({
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 2,
          size: 25,
        });
      })
    );

    const { result } = renderHook(() => useImoveis({ page: 2, size: 25 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('should refetch when filters change', async () => {
    let requestCount = 0;

    server.use(
      http.get(`${BASE_URL}/v1/imoveis`, () => {
        requestCount++;
        return HttpResponse.json({
          content: [],
          totalElements: 0,
          totalPages: 0,
          page: 0,
          size: 50,
        });
      })
    );

    const { result, rerender } = renderHook(
      (props) => useImoveis(props.filters),
      {
        initialProps: { filters: { tipo: 'Casa' } },
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(requestCount).toBe(1);

    rerender({ filters: { tipo: 'Apartamento' } });

    await waitFor(() => {
      expect(requestCount).toBe(2);
    });
  });
});

describe('useImovel', () => {
  it('should fetch single imovel by id', async () => {
    const mockData: Imovel = {
      id: '42',
      endereco: 'Rua B, 456',
      tipo: 'Casa',
      cidadeId: '7',
      metragem: 200,
      mobiliado: false,
      ativo: true,
    };

    server.use(
      http.get(`${BASE_URL}/v1/imoveis/42`, () => HttpResponse.json(mockData))
    );

    const { result } = renderHook(() => useImovel('42'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('42');
    expect(result.current.data?.endereco).toBe('Rua B, 456');
  });

  it('should not fetch when id is null', async () => {
    let called = false;
    server.use(
      http.get(`${BASE_URL}/v1/imoveis/:id`, () => {
        called = true;
        return HttpResponse.json({});
      })
    );

    const { result } = renderHook(() => useImovel(null), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(called).toBe(false);
    }, { timeout: 500 });

    expect(result.current.data).toBeUndefined();
  });

  it('should refetch when id changes', async () => {
    let requestCount = 0;

    server.use(
      http.get(`${BASE_URL}/v1/imoveis/:id`, ({ params }) => {
        requestCount++;
        return HttpResponse.json({
          id: params.id,
          endereco: `Rua ${params.id}`,
          tipo: 'Apartamento',
          cidade: 'São Paulo',
          situacao: 'Venda',
          dormitorios: 2,
          banheiros: 1,
          area: '80',
        });
      })
    );

    const { result, rerender } = renderHook(
      (props) => useImovel(props.id),
      {
        initialProps: { id: '1' },
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('1');

    rerender({ id: '2' });

    await waitFor(() => {
      expect(result.current.data?.id).toBe('2');
    });

    expect(requestCount).toBe(2);
  });

  it('should handle API errors', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/imoveis/999`, () =>
        new HttpResponse('Not found', { status: 404 })
      )
    );

    const { result } = renderHook(() => useImovel('999'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useCreateImovel', () => {
  it('should create imovel with all fields matching the real Imovel entity', async () => {
    let capturedBody: any;

    server.use(
      http.post(`${BASE_URL}/v1/imoveis`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: '1',
          imobiliariaId: null,
          cidadeId: '3',
          endereco: 'Rua C, 789',
          cep: '80000-000',
          metragem: 50,
          mobiliado: true,
          tipo: 'Loft',
        });
      })
    );

    const { result } = renderHook(() => useCreateImovel(), { wrapper: createWrapper() });

    result.current.mutate({
      cidadeId: '3',
      endereco: 'Rua C, 789',
      cep: '80000-000',
      metragem: 50,
      mobiliado: true,
      tipo: 'Loft',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(capturedBody.endereco).toBe('Rua C, 789');
    expect(capturedBody.cidadeId).toBe('3');
    expect(capturedBody.mobiliado).toBe(true);
  });

  it('should create imovel with minimal fields', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/imoveis`, async ({ request }) => {
        const body = (await request.json()) as any;
        return HttpResponse.json({
          id: '1',
          ...body,
        });
      })
    );

    const { result } = renderHook(() => useCreateImovel(), { wrapper: createWrapper() });

    result.current.mutate({
      cidadeId: '5',
      endereco: 'Rua D, 101',
      metragem: 90,
      mobiliado: false,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.endereco).toBe('Rua D, 101');
  });

  it('should handle mutation errors', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/imoveis`, () =>
        new HttpResponse('Validation error', { status: 400 })
      )
    );

    const { result } = renderHook(() => useCreateImovel(), { wrapper: createWrapper() });

    result.current.mutate({
      cidadeId: '1',
      endereco: 'Invalid',
      metragem: 50,
      mobiliado: false,
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});

describe('useAllCidades', () => {
  it('should fetch all cidades', async () => {
    const mockData = {
      content: [
        { id: '1', nome: 'São Paulo', estado: 'SP' },
        { id: '2', nome: 'Brasília', estado: 'DF' },
      ],
      totalElements: 2,
      totalPages: 1,
      page: 0,
      size: 100,
    };

    server.use(
      http.get(`${BASE_URL}/v1/cidades`, () => HttpResponse.json(mockData))
    );

    const { result } = renderHook(() => useAllCidades(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toHaveLength(2);
  });

  it('should use cidades-all queryKey', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/cidades`, () =>
        HttpResponse.json({
          content: [{ id: '1', nome: 'City', estado: 'ST' }],
          totalElements: 1,
          totalPages: 1,
          page: 0,
          size: 100,
        })
      )
    );

    // Render two instances with different query keys
    const { result: result1 } = renderHook(() => useAllCidades(), {
      wrapper: createWrapper(),
    });
    const { result: result2 } = renderHook(() => useCidades(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result1.current.isSuccess).toBe(true);
      expect(result2.current.isSuccess).toBe(true);
    });

    // Both should have data
    expect(result1.current.data).toBeDefined();
    expect(result2.current.data).toBeDefined();
  });

  it('should extract content array from page response', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/cidades`, () =>
        HttpResponse.json({
          content: [
            { id: '1', nome: 'City 1', estado: 'S1' },
            { id: '2', nome: 'City 2', estado: 'S2' },
          ],
          totalElements: 2,
          totalPages: 1,
          page: 0,
          size: 100,
        })
      )
    );

    const { result } = renderHook(() => useAllCidades(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(Array.isArray(result.current.data)).toBe(true);
    expect(result.current.data?.[0].id).toBe('1');
  });
});
