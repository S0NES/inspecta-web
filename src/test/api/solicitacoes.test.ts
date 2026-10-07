import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  useSolicitacoes,
  useCreateSolicitacao,
  useSolicitacaoStatus,
  useCancelarServico,
  useImoveis,
  useClientes,
  useTiposServico,
  type Solicitacao,
} from '../../api/solicitacoes';

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

const pageOf = <T,>(content: T[]) => ({
  content,
  totalElements: content.length,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
});

const solicitacaoExemplo: Solicitacao = {
  id: 'SOL-1',
  solicitacaoId: '1',
  endereco: 'SQN 210, Bloco C, Apto 302',
  imagem: 'Brasília/DF',
  tipo: 'Entrada',
  vistoriador: 'A atribuir',
  data: '15/08/2026',
  hora: '15:47',
  status: 'Solicitada',
  valor: 'R$ 650,00',
  urgente: false,
};

describe('useSolicitacoes', () => {
  it('busca solicitações já no formato de exibição', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/solicitacoes`, () => HttpResponse.json(pageOf([solicitacaoExemplo])))
    );

    const { result } = renderHook(() => useSolicitacoes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const item = result.current.data!.content[0];
    expect(item.id).toBe('SOL-1');
    expect(item.endereco).toBe('SQN 210, Bloco C, Apto 302');
    expect(item.valor).toBe('R$ 650,00');
    expect(item.vistoriador).toBe('A atribuir');
  });

  it('envia paginação padrão', async () => {
    let url = '';
    server.use(
      http.get(`${BASE_URL}/v1/solicitacoes`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(pageOf([]));
      })
    );

    const { result } = renderHook(() => useSolicitacoes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(url).toContain('page=0');
    expect(url).toContain('size=20');
  });

  it('respeita página e tamanho informados', async () => {
    let url = '';
    server.use(
      http.get(`${BASE_URL}/v1/solicitacoes`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(pageOf([]));
      })
    );

    const { result } = renderHook(() => useSolicitacoes({ page: 2, size: 5 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(url).toContain('page=2');
    expect(url).toContain('size=5');
  });

  it('propaga erro da API', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/solicitacoes`, () => new HttpResponse(null, { status: 500 }))
    );

    const { result } = renderHook(() => useSolicitacoes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useCreateSolicitacao', () => {
  it('faz POST com o contrato do backend', async () => {
    let body: any;
    server.use(
      http.post(`${BASE_URL}/v1/solicitacoes`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: '1' }, { status: 201 });
      })
    );

    const { result } = renderHook(() => useCreateSolicitacao(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      clienteId: '7',
      imovelId: '3',
      urgente: true,
      chavesRetirada: 'Portaria',
      origem: 'painel',
      servicos: [{ tipoServicoId: '1' }, { tipoServicoId: '2' }],
      intervenientes: [{ papelSlug: 'locador', nome: 'Ana Silva', cpf: '11144477735', email: 'ana@x.co' }],
    });

    expect(body).toEqual({
      clienteId: '7',
      imovelId: '3',
      urgente: true,
      chavesRetirada: 'Portaria',
      origem: 'painel',
      servicos: [{ tipoServicoId: '1' }, { tipoServicoId: '2' }],
      intervenientes: [{ papelSlug: 'locador', nome: 'Ana Silva', cpf: '11144477735', email: 'ana@x.co' }],
    });
    expect(body).not.toHaveProperty('imobiliariaId');
  });

  it('manda Idempotency-Key no header e nunca no corpo', async () => {
    let header: string | null = null;
    let body: any;
    server.use(
      http.post(`${BASE_URL}/v1/solicitacoes`, async ({ request }) => {
        header = request.headers.get('Idempotency-Key');
        body = await request.json();
        return HttpResponse.json({ id: '1' }, { status: 201 });
      })
    );

    const { result } = renderHook(() => useCreateSolicitacao(), { wrapper: createWrapper() });

    await result.current.mutateAsync({
      clienteId: '1',
      imovelId: '1',
      origem: 'painel',
      servicos: [{ tipoServicoId: '1' }],
      intervenientes: [{ papelSlug: 'locador', nome: 'Ana Silva', cpf: '11144477735', email: 'ana@x.co' }],
      idempotencyKey: 'abc-123',
    });

    expect(header).toBe('abc-123');
    expect(body).not.toHaveProperty('idempotencyKey');
  });

  it('rejeita quando a API falha', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/solicitacoes`, () => new HttpResponse('erro', { status: 400 }))
    );

    const { result } = renderHook(() => useCreateSolicitacao(), { wrapper: createWrapper() });

    await expect(
      result.current.mutateAsync({
        clienteId: '1',
        imovelId: '1',
        origem: 'painel',
        servicos: [{ tipoServicoId: '1' }],
        intervenientes: [{ papelSlug: 'locador', nome: 'Ana Silva', cpf: '11144477735', email: 'ana@x.co' }],
      })
    ).rejects.toThrow();
  });
});

describe('useSolicitacaoStatus', () => {
  it('retorna o status derivado', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/solicitacoes/1/status`, () =>
        HttpResponse.json({ status: 'em_andamento' })
      )
    );

    const { result } = renderHook(() => useSolicitacaoStatus('1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe('em_andamento');
  });

  it('não dispara sem id', () => {
    const { result } = renderHook(() => useSolicitacaoStatus(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useCancelarServico', () => {
  it('faz POST no endpoint de cancelamento', async () => {
    let chamou = false;
    server.use(
      http.post(`${BASE_URL}/v1/solicitacoes/servicos/42/cancelar`, () => {
        chamou = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    const { result } = renderHook(() => useCancelarServico(), { wrapper: createWrapper() });

    await result.current.mutateAsync('42');
    expect(chamou).toBe(true);
  });
});

describe('hooks de dados de referência', () => {
  it('useImoveis lê o envelope paginado', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/imoveis`, () =>
        HttpResponse.json(
          pageOf([
            {
              id: '1',
              imobiliariaId: '1',
              cidadeId: '1',
              endereco: 'SQN 210',
              cep: null,
              metragem: 78,
              mobiliado: false,
              tipo: 'Apartamento',
            },
          ])
        )
      )
    );

    const { result } = renderHook(() => useImoveis(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.content[0].endereco).toBe('SQN 210');
  });

  it('useClientes lê o envelope paginado', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/clientes`, () =>
        HttpResponse.json(
          pageOf([{ id: '1', nome: 'João Pereira', cpfCnpj: null, email: null, telefone: null }])
        )
      )
    );

    const { result } = renderHook(() => useClientes(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.content[0].nome).toBe('João Pereira');
  });

  it('useTiposServico lê o envelope paginado', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/tipos-servico`, () =>
        HttpResponse.json(pageOf([{ id: '1', nome: 'Entrada', ativo: true }]))
      )
    );

    const { result } = renderHook(() => useTiposServico(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data!.content[0].nome).toBe('Entrada');
  });
});
