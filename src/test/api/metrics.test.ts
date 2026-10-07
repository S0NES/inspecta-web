import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  useMetricasEnvios,
  useMetricasSolicitacoes,
  janelaPadrao,
  type EnviosResponse,
  type SolicitacoesResponse,
} from '../../api/metrics';

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

const enviosResposta: EnviosResponse = {
  inicio: '2026-07-30',
  fim: '2026-08-28',
  buckets: [
    {
      dia: '2026-08-01',
      tipoEnvio: 'email',
      tipoComunicacao: 'conta',
      criados: 10,
      enviados: 9,
      entregues: 8,
      aberturas: 4,
      cliques: 2,
      bounces: 1,
      reclamacoes: 0,
      falhas: 0,
    },
  ],
  totais: {
    dia: null,
    tipoEnvio: null,
    tipoComunicacao: null,
    criados: 10,
    enviados: 9,
    entregues: 8,
    aberturas: 4,
    cliques: 2,
    bounces: 1,
    reclamacoes: 0,
    falhas: 0,
  },
};

const solicitacoesResposta: SolicitacoesResponse = {
  inicio: '2026-07-30',
  fim: '2026-08-28',
  buckets: [
    { dia: '2026-08-01', tipoServicoId: '1', tipoServicoNome: 'Entrada', concluidas: 3, emAndamento: 2 },
  ],
};

describe('janelaPadrao', () => {
  it('devolve uma janela de 30 dias terminando ontem (D-1)', () => {
    const hoje = new Date('2026-08-28T12:00:00Z');
    const { inicio, fim } = janelaPadrao(hoje);

    expect(fim).toBe('2026-08-27');
    expect(inicio).toBe('2026-07-29');
    const dias = (Date.parse(fim) - Date.parse(inicio)) / 86_400_000;
    expect(dias).toBe(29);
  });
});

describe('useMetricasEnvios', () => {
  it('busca a série de envios e devolve o shape do backend', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/metricas/envios`, () => HttpResponse.json(enviosResposta))
    );

    const { result } = renderHook(() => useMetricasEnvios({ enabled: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.buckets[0].tipoEnvio).toBe('email');
    expect(result.current.data!.buckets[0].criados).toBe(10);
    expect(result.current.data!.totais.criados).toBe(10);
    expect(result.current.data!.totais.dia).toBeNull();
  });

  it('envia inicio e fim (janela padrão D-1, 30 dias) na query', async () => {
    let url = '';
    server.use(
      http.get(`${BASE_URL}/v1/metricas/envios`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(enviosResposta);
      })
    );

    const { result } = renderHook(() => useMetricasEnvios({ enabled: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const { inicio, fim } = janelaPadrao();
    const sp = new URL(url).searchParams;
    expect(sp.get('inicio')).toBe(inicio);
    expect(sp.get('fim')).toBe(fim);
  });

  it('respeita inicio e fim explícitos', async () => {
    let url = '';
    server.use(
      http.get(`${BASE_URL}/v1/metricas/envios`, ({ request }) => {
        url = request.url;
        return HttpResponse.json(enviosResposta);
      })
    );

    const { result } = renderHook(
      () => useMetricasEnvios({ inicio: '2026-01-01', fim: '2026-01-31', enabled: true }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const sp = new URL(url).searchParams;
    expect(sp.get('inicio')).toBe('2026-01-01');
    expect(sp.get('fim')).toBe('2026-01-31');
  });

  it('não dispara a requisição quando enabled é false', async () => {
    let chamou = false;
    server.use(
      http.get(`${BASE_URL}/v1/metricas/envios`, () => {
        chamou = true;
        return HttpResponse.json(enviosResposta);
      })
    );

    const { result } = renderHook(() => useMetricasEnvios({ enabled: false }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'), { timeout: 500 });
    expect(chamou).toBe(false);
  });

  it('propaga erro da API', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/metricas/envios`, () => new HttpResponse(null, { status: 500 }))
    );

    const { result } = renderHook(() => useMetricasEnvios({ enabled: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe('useMetricasSolicitacoes', () => {
  it('busca a série de solicitações e devolve o shape do backend', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/metricas/solicitacoes`, () =>
        HttpResponse.json(solicitacoesResposta)
      )
    );

    const { result } = renderHook(() => useMetricasSolicitacoes({ enabled: true }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data!.buckets[0].tipoServicoNome).toBe('Entrada');
    expect(result.current.data!.buckets[0].concluidas).toBe(3);
    expect(result.current.data!.buckets[0].emAndamento).toBe(2);
  });

  it('não dispara a requisição quando enabled é false', async () => {
    let chamou = false;
    server.use(
      http.get(`${BASE_URL}/v1/metricas/solicitacoes`, () => {
        chamou = true;
        return HttpResponse.json(solicitacoesResposta);
      })
    );

    const { result } = renderHook(() => useMetricasSolicitacoes({ enabled: false }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.fetchStatus).toBe('idle'), { timeout: 500 });
    expect(chamou).toBe(false);
  });
});
