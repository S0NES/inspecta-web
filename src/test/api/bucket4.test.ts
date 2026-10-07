import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { usePlenoSyncList, usePlenoSyncRetry } from '../../api/pleno';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '../../api/apiKeys';
import { useCobranca } from '../../api/pagamento';
import { useSolicitacaoServicos, useReatribuir } from '../../api/solicitacoes';
import { useDisponibilidade, useExcecoes } from '../../api/vistoriadores';

const BASE = 'http://localhost:8080';
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe('painel de sincronização Pleno (§5)', () => {
  it('usePlenoSyncList monta a query string com status e página', async () => {
    let recebida = '';
    server.use(
      http.get(`${BASE}/v1/pleno/sync`, ({ request }) => {
        recebida = new URL(request.url).search;
        return HttpResponse.json({ content: [], totalElements: 0, totalPages: 1, number: 0 });
      }),
    );
    const { result } = renderHook(() => usePlenoSyncList('erro', 2), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(recebida).toContain('status=erro');
    expect(recebida).toContain('page=2');
  });

  it('usePlenoSyncRetry faz POST no endpoint de retry', async () => {
    let chamado = false;
    server.use(
      http.post(`${BASE}/v1/pleno/sync/7/retry`, () => {
        chamado = true;
        return HttpResponse.json({ id: '7', recursoTipo: 'imovel', recursoId: '1', status: 'pendente', externalId: null, erro: null, ultimoSync: null, origem: 'espelho' });
      }),
    );
    const { result } = renderHook(() => usePlenoSyncRetry(), { wrapper: wrapper() });
    await result.current.mutateAsync('7');
    expect(chamado).toBe(true);
  });
});

describe('API keys (§5)', () => {
  it('useApiKeys lê a listagem de metadados (máscara, sem plaintext)', async () => {
    server.use(
      http.get(`${BASE}/v1/api-keys`, () =>
        HttpResponse.json([{ id: '1', mascara: '••••1a2b', imobiliariaId: 'imob-1', escopos: ['read'], criadoEm: '2026-01-01T00:00:00Z', expiraEm: '2027-01-01T00:00:00Z', revogado: false, expirada: false }]),
      ),
    );
    const { result } = renderHook(() => useApiKeys(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].mascara).toBe('••••1a2b');
  });

  it('useCreateApiKey envia imobiliariaId + Idempotency-Key e devolve o plaintext uma vez', async () => {
    let idem: string | null = null;
    server.use(
      http.post(`${BASE}/v1/api-keys`, async ({ request }) => {
        const body = (await request.json()) as any;
        expect(body.imobiliariaId).toBe('imob-9');
        idem = request.headers.get('Idempotency-Key');
        return HttpResponse.json({ id: '5', apiKey: 'mk_a.secret', mascara: '••••cret', imobiliariaId: body.imobiliariaId, expiraEm: body.expiraEm, aviso: 'uma vez' }, { status: 201 });
      }),
    );
    const { result } = renderHook(() => useCreateApiKey(), { wrapper: wrapper() });
    const criada = await result.current.mutateAsync({ imobiliariaId: 'imob-9', escopos: ['read'], expiraEm: '2027-01-01T00:00:00Z' });
    expect(criada.apiKey).toBe('mk_a.secret');
    expect(idem).toBeTruthy();
  });

  it('useRevokeApiKey faz DELETE', async () => {
    let del = false;
    server.use(http.delete(`${BASE}/v1/api-keys/3`, () => { del = true; return new HttpResponse(null, { status: 204 }); }));
    const { result } = renderHook(() => useRevokeApiKey(), { wrapper: wrapper() });
    await result.current.mutateAsync('3');
    expect(del).toBe(true);
  });
});

describe('cobrança e reatribuição (§1 / §5)', () => {
  it('useCobranca devolve estado vazio no 404', async () => {
    server.use(http.get(`${BASE}/v1/solicitacoes/50/pagamento`, () => new HttpResponse(null, { status: 404 })));
    const { result } = renderHook(() => useCobranca('50'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({
      pagamentoId: null,
      status: null,
      checkoutUrl: null,
      checkoutId: null,
      checkoutReady: false,
      paymentStatus: null,
      pixBrCode: null,
      pixQrCodeBase64: null,
      pixExpiraEm: null,
    });
  });

  it('useSolicitacaoServicos lê os serviços', async () => {
    server.use(
      http.get(`${BASE}/v1/solicitacoes/7/servicos`, () =>
        HttpResponse.json([{ id: '42', tipoServicoId: '1', status: 'atribuida', vistoriadorId: '3', dataAgendada: null, precoSnapshot: '250.00' }]),
      ),
    );
    const { result } = renderHook(() => useSolicitacaoServicos('7'), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].id).toBe('42');
  });

  it('useReatribuir envia motivo e vistoriadorAtual', async () => {
    let body: any;
    server.use(
      http.post(`${BASE}/v1/servicos/42/reatribuir`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ aceito: true }, { status: 202 });
      }),
    );
    const { result } = renderHook(() => useReatribuir(), { wrapper: wrapper() });
    await result.current.mutateAsync({ servicoId: '42', motivo: 'férias', vistoriadorAtual: '3' });
    expect(body).toEqual({ motivo: 'férias', vistoriadorAtual: '3' });
  });
});

describe('disponibilidade + exceções (§4)', () => {
  it('useDisponibilidade e useExcecoes leem por vistoriador', async () => {
    server.use(
      http.get(`${BASE}/v1/vistoriadores/5/disponibilidade`, () =>
        HttpResponse.json([{ id: '1', vistoriadorId: '5', diaSemana: 1, horaInicio: '08:00', horaFim: '12:00' }]),
      ),
      http.get(`${BASE}/v1/vistoriadores/5/excecoes`, () =>
        HttpResponse.json([{ id: '2', vistoriadorId: '5', tipo: 'ferias', dataInicio: '2026-12-20', dataFim: '2026-12-31' }]),
      ),
    );
    const disp = renderHook(() => useDisponibilidade('5'), { wrapper: wrapper() });
    const exc = renderHook(() => useExcecoes('5'), { wrapper: wrapper() });
    await waitFor(() => expect(disp.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(exc.result.current.isSuccess).toBe(true));
    expect(disp.result.current.data?.[0].diaSemana).toBe(1);
    expect(exc.result.current.data?.[0].tipo).toBe('ferias');
  });
});
