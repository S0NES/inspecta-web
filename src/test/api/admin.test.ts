import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  useUsuarios,
  useImobiliarias,
  useImobiliaria,
  useInviteUsuario,
  useCreateImobiliaria,
  type Imobiliaria,
} from '../../api/admin';

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

describe('useUsuarios', () => {
  it('should fetch usuarios with default pagination', async () => {
    const mockData = {
      content: [
        {
          id: '1',
          nome: 'Admin User',
          email: 'admin@example.com',
          perfil: 'admin' as const,
          status: 'ativo' as const,
          imobiliariaId: null,
          criadoEm: '2026-01-01T00:00:00Z',
        },
      ],
      totalElements: 1,
      totalPages: 1,
      size: 50,
      number: 0,
    };

    server.use(
      http.get(`${BASE_URL}/v1/usuarios`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('page')).toBe('0');
        expect(url.searchParams.get('size')).toBe('50');
        return HttpResponse.json(mockData);
      })
    );

    const { result } = renderHook(() => useUsuarios(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.content).toHaveLength(1);
    expect(result.current.data?.content[0].email).toBe('admin@example.com');
  });

  it('should fetch usuarios with custom filters', async () => {
    const mockData = {
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: 10,
      number: 2,
    };

    server.use(
      http.get(`${BASE_URL}/v1/usuarios`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('page')).toBe('2');
        expect(url.searchParams.get('size')).toBe('10');
        return HttpResponse.json(mockData);
      })
    );

    const { result } = renderHook(() => useUsuarios({ page: 2, size: 10 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.number).toBe(2);
    expect(result.current.data?.size).toBe(10);
  });

  it('should handle pagination parameters', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/usuarios`, ({ request }) => {
        const url = new URL(request.url);
        const page = url.searchParams.get('page');
        const size = url.searchParams.get('size');
        return HttpResponse.json({
          content: [],
          totalElements: 0,
          totalPages: 0,
          size: Number(size),
          number: Number(page),
        });
      })
    );

    const { result } = renderHook(() => useUsuarios({ page: 1, size: 25 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.number).toBe(1);
    expect(result.current.data?.size).toBe(25);
  });

  it('should send q and status query params', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/usuarios`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('q')).toBe('maria');
        expect(url.searchParams.get('status')).toBe('ativo');
        expect(url.searchParams.get('perfil')).toBe('imob_gerencia');
        return HttpResponse.json({
          content: [],
          totalElements: 0,
          totalPages: 0,
          size: 20,
          number: 0,
        });
      })
    );

    const { result } = renderHook(
      () => useUsuarios({ page: 0, size: 20, q: 'maria', status: 'ativo', perfil: 'imob_gerencia' }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});

describe('useImobiliarias', () => {
  it('should fetch imobiliarias with default pagination', async () => {
    const mockData = {
      content: [
        {
          id: '1',
          razaoSocial: 'Imobiliaria ABC',
          nomeFantasia: 'ABC Imóveis',
          cnpj: '12.345.678/0001-99',
          ativa: true,
        },
      ],
      totalElements: 1,
      totalPages: 1,
      size: 50,
      number: 0,
    };

    server.use(
      http.get(`${BASE_URL}/v1/imobiliarias`, () => HttpResponse.json(mockData))
    );

    const { result } = renderHook(() => useImobiliarias(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.content).toHaveLength(1);
    expect(result.current.data?.content[0].razaoSocial).toBe('Imobiliaria ABC');
  });

  it('should fetch imobiliarias with custom filters', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/imobiliarias`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('page')).toBe('1');
        expect(url.searchParams.get('size')).toBe('25');
        return HttpResponse.json({
          content: [],
          totalElements: 0,
          totalPages: 0,
          size: 25,
          number: 1,
        });
      })
    );

    const { result } = renderHook(() => useImobiliarias({ page: 1, size: 25 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.size).toBe(25);
  });
});

describe('useImobiliaria', () => {
  it('should fetch single imobiliaria by id', async () => {
    const mockData: Imobiliaria = {
      id: '42',
      razaoSocial: 'Imobiliaria XYZ',
      nomeFantasia: null,
      cnpj: '98.765.432/0001-11',
      ativa: true,
    };

    server.use(
      http.get(`${BASE_URL}/v1/imobiliarias/42`, () => HttpResponse.json(mockData))
    );

    const { result } = renderHook(() => useImobiliaria('42'), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.id).toBe('42');
    expect(result.current.data?.razaoSocial).toBe('Imobiliaria XYZ');
  });

  it('should not fetch when id is null', async () => {
    let called = false;
    server.use(
      http.get(`${BASE_URL}/v1/imobiliarias/:id`, () => {
        called = true;
        return HttpResponse.json({});
      })
    );

    const { result } = renderHook(() => useImobiliaria(null), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(called).toBe(false);
    }, { timeout: 500 });

    expect(result.current.data).toBeUndefined();
  });

  it('should refetch when id changes', async () => {
    let requestCount = 0;

    server.use(
      http.get(`${BASE_URL}/v1/imobiliarias/:id`, ({ params }) => {
        requestCount++;
        return HttpResponse.json({
          id: params.id,
          razaoSocial: `Imobiliaria ${params.id}`,
          nomeFantasia: null,
          cnpj: '12.345.678/0001-99',
          ativa: true,
        });
      })
    );

    const { result, rerender } = renderHook(
      (props) => useImobiliaria(props.id),
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
});

describe('useInviteUsuario', () => {
  it('should mutate with invite request', async () => {
    let capturedBody: any;

    server.use(
      http.post(`${BASE_URL}/v1/usuarios`, async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 202 });
      })
    );

    const { result } = renderHook(() => useInviteUsuario(), { wrapper: createWrapper() });

    result.current.mutate({
      email: 'newuser@example.com',
      nome: 'New User',
      perfil: 'vistoriador',
      imobiliariaIds: ['1'],
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(capturedBody.email).toBe('newuser@example.com');
    expect(capturedBody.perfil).toBe('vistoriador');
  });

  it('should handle mutation errors', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/usuarios`, () =>
        new HttpResponse('Email already exists', { status: 409 })
      )
    );

    const { result } = renderHook(() => useInviteUsuario(), { wrapper: createWrapper() });

    result.current.mutate({
      email: 'existing@example.com',
      nome: 'User',
      perfil: 'admin',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });

  it('should invalidate usuarios query on success', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/usuarios`, () => new HttpResponse(null, { status: 202 })),
      http.get(`${BASE_URL}/v1/usuarios`, () =>
        HttpResponse.json({
          content: [
            {
              id: '1',
              nome: 'User',
              email: 'user@example.com',
              perfil: 'vistoriador',
              status: 'convidado',
              imobiliariaId: null,
              criadoEm: '2026-01-01T00:00:00Z',
            },
          ],
          totalElements: 1,
          totalPages: 1,
          size: 50,
          number: 0,
        })
      )
    );

    const { result: inviteResult } = renderHook(() => useInviteUsuario(), {
      wrapper: createWrapper(),
    });

    inviteResult.current.mutate({
      email: 'newuser@example.com',
      nome: 'New User',
      perfil: 'vistoriador',
    });

    await waitFor(() => {
      expect(inviteResult.current.isSuccess).toBe(true);
    });
  });
});

describe('useCreateImobiliaria', () => {
  it('should mutate with create imobiliaria request matching the real DTO', async () => {
    let capturedBody: any;

    server.use(
      http.post(`${BASE_URL}/v1/imobiliarias`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({
          id: '1',
          razaoSocial: 'New Imobiliaria',
          nomeFantasia: null,
          cnpj: '11.222.333/0001-44',
          ativa: true,
        });
      })
    );

    const { result } = renderHook(() => useCreateImobiliaria(), { wrapper: createWrapper() });

    result.current.mutate({
      razaoSocial: 'New Imobiliaria',
      cnpj: '11.222.333/0001-44',
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(capturedBody.razaoSocial).toBe('New Imobiliaria');
    expect(capturedBody.cnpj).toBe('11.222.333/0001-44');
  });

  it('should handle mutation errors', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/imobiliarias`, () =>
        new HttpResponse('CNPJ already registered', { status: 409 })
      )
    );

    const { result } = renderHook(() => useCreateImobiliaria(), { wrapper: createWrapper() });

    result.current.mutate({
      razaoSocial: 'Duplicate Imob',
      cnpj: '11.222.333/0001-44',
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
