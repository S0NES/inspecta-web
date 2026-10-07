import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { useEarnings, type Extrato } from '../../hooks/useEarnings';

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

describe('useEarnings', () => {
  it('should fetch earnings data when vistoriadorId is provided', async () => {
    const mockData: Extrato = {
      vistoriadorId: '123',
      periodo: '2024-01',
      ganhosBrutos: 5000,
      comissao: 500,
      pagoPendente: 4500,
      pagamentos: [
        {
          id: '1',
          periodo: '2024-01',
          valor: 4500,
          status: 'PAGO',
        },
      ],
      totalPago: 4500,
      totalPendente: 0,
    };

    server.use(
      http.get(
        `${BASE_URL}/v1/vistoriadores/123/extrato`,
        () => HttpResponse.json(mockData)
      )
    );

    const { result } = renderHook(
      () => useEarnings('123', '2024-01'),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.isSuccess).toBe(true);
  });

  it('should not fetch when vistoriadorId is undefined', async () => {
    let called = false;
    server.use(
      http.get(`${BASE_URL}/v1/vistoriadores/undefined/extrato`, () => {
        called = true;
        return HttpResponse.json({});
      })
    );

    const { result } = renderHook(
      () => useEarnings(undefined, '2024-01'),
      { wrapper: createWrapper() }
    );

    // Should be disabled
    expect(result.current.isLoading).toBe(false);
    expect(result.current.data).toBeUndefined();

    await waitFor(() => {
      expect(called).toBe(false);
    }, { timeout: 500 });
  });

  it('should not fetch when vistoriadorId is empty string', async () => {
    let called = false;
    server.use(
      http.get(`${BASE_URL}/v1/vistoriadores//extrato`, () => {
        called = true;
        return HttpResponse.json({});
      })
    );

    const { result } = renderHook(
      () => useEarnings('', '2024-01'),
      { wrapper: createWrapper() }
    );

    expect(result.current.isLoading).toBe(false);

    await waitFor(() => {
      expect(called).toBe(false);
    }, { timeout: 500 });
  });

  it('should refetch when vistoriadorId changes', async () => {
    let requestCount = 0;

    server.use(
      http.get(`${BASE_URL}/v1/vistoriadores/:id/extrato`, ({ params }) => {
        requestCount++;
        return HttpResponse.json({
          vistoriadorId: params.id,
          periodo: '2024-01',
          ganhosBrutos: 1000 * Number(params.id),
          comissao: 100,
          pagoPendente: 900,
          pagamentos: [],
          totalPago: 0,
          totalPendente: 900,
        });
      })
    );

    const { result, rerender } = renderHook(
      (props) => useEarnings(props.vistoriadorId, props.periodo),
      {
        initialProps: { vistoriadorId: '123', periodo: '2024-01' },
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const firstData = result.current.data;
    expect(firstData?.vistoriadorId).toBe('123');

    // Change vistoriador ID
    rerender({ vistoriadorId: '456', periodo: '2024-01' });

    await waitFor(() => {
      expect(result.current.data?.vistoriadorId).toBe('456');
    });

    expect(requestCount).toBe(2);
  });

  it('should refetch when periodo changes', async () => {
    let callCount = 0;

    server.use(
      http.get(`${BASE_URL}/v1/vistoriadores/123/extrato`, ({ request }) => {
        callCount++;
        const url = new URL(request.url);
        const periodo = url.searchParams.get('periodo');
        return HttpResponse.json({
          vistoriadorId: '123',
          periodo: periodo || '2024-01',
          ganhosBrutos: 5000,
          comissao: 500,
          pagoPendente: 4500,
          pagamentos: [],
          totalPago: 0,
          totalPendente: 4500,
        });
      })
    );

    const { result, rerender } = renderHook(
      (props) => useEarnings(props.vistoriadorId, props.periodo),
      {
        initialProps: { vistoriadorId: '123', periodo: '2024-01' },
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    const firstPeriodo = result.current.data?.periodo;
    expect(firstPeriodo).toBe('2024-01');

    // Change periodo
    rerender({ vistoriadorId: '123', periodo: '2024-02' });

    await waitFor(() => {
      expect(result.current.data?.periodo).toBe('2024-02');
    });

    expect(callCount).toBe(2);
  });

  it('should handle API errors gracefully', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/vistoriadores/123/extrato`, () =>
        new HttpResponse('Not found', { status: 404 })
      )
    );

    const { result } = renderHook(
      () => useEarnings('123', '2024-01'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('should share queryKey across periods', async () => {
    const mockData: Extrato = {
      vistoriadorId: '123',
      periodo: '2024-01',
      ganhosBrutos: 5000,
      comissao: 500,
      pagoPendente: 4500,
      pagamentos: [],
      totalPago: 0,
      totalPendente: 4500,
    };

    server.use(
      http.get(`${BASE_URL}/v1/vistoriadores/123/extrato`, ({ request }) => {
        const url = new URL(request.url);
        const periodo = url.searchParams.get('periodo');
        return HttpResponse.json({
          ...mockData,
          periodo: periodo || '2024-01',
        });
      })
    );

    const { result, rerender } = renderHook(
      (props) => useEarnings(props.vistoriadorId, props.periodo),
      {
        initialProps: { vistoriadorId: '123', periodo: '2024-01' },
        wrapper: createWrapper(),
      }
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.periodo).toBe('2024-01');

    // Same vistoriadorId, different periodo should fetch again (different queryKey)
    rerender({ vistoriadorId: '123', periodo: '2024-02' });

    await waitFor(() => {
      expect(result.current.data?.periodo).toBe('2024-02');
    });
  });
});
