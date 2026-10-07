import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Integracoes } from '../../../pages/integracoes/Integracoes';
import { useAppStore } from '../../../store/useAppStore';
import * as plenoApi from '../../../api/pleno';
import * as integracoesApi from '../../../api/integracoes';

vi.mock('../../../api/pleno', () => ({
  usePlenoSyncList: vi.fn(),
  usePlenoSyncRetry: vi.fn(),
  useAutentiqueList: vi.fn(),
  useAbacatePayList: vi.fn(),
}));

vi.mock('../../../api/integracoes', () => ({
  useIntegracoesConfig: vi.fn(),
}));

const emptyPage = { content: [], totalElements: 0, totalPages: 1, number: 0 };

function renderWithProviders() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <Integracoes />
    </QueryClientProvider>
  );
}

describe('Integracoes — painel de integrações', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ toastMessage: null });
    useAppStore.getState().setAuth({ perfil: 'admin' });

    vi.mocked(integracoesApi.useIntegracoesConfig).mockReturnValue({
      data: { payment: 'abacatepay', signature: 'autentique', pleno: 'http' },
      isError: false,
    } as any);

    vi.mocked(plenoApi.usePlenoSyncList).mockReturnValue({
      data: emptyPage, isLoading: false, error: null,
    } as any);
    vi.mocked(plenoApi.usePlenoSyncRetry).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}), isPending: false,
    } as any);
    vi.mocked(plenoApi.useAutentiqueList).mockReturnValue({
      data: emptyPage, isLoading: false, error: null,
    } as any);
    vi.mocked(plenoApi.useAbacatePayList).mockReturnValue({
      data: emptyPage, isLoading: false, error: null,
    } as any);
  });

  it('mostra o título e as abas Pleno / AbacatePay / Autentique vindas do config', () => {
    renderWithProviders();
    expect(screen.getByRole('heading', { name: 'Integrações' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pleno' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'AbacatePay' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Autentique' })).toBeInTheDocument();
  });

  it('não renderiza mais o bloco de importação de vistorias da Pleno', () => {
    renderWithProviders();
    expect(screen.queryByText('Importação de vistorias da Pleno')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Verificar agora' })).not.toBeInTheDocument();
  });

  it('usa as mesmas colunas genéricas em todas as abas', async () => {
    vi.mocked(plenoApi.usePlenoSyncList).mockReturnValue({
      data: {
        content: [{
          id: 'ps1', recursoTipo: 'imovel', recursoId: '10', recursoNome: 'Rua A, 1',
          status: 'sincronizado', externalId: 'ext-p', erro: null,
          ultimoSync: '2026-09-01T10:00:00Z', origem: 'espelho',
        }],
        totalElements: 1, totalPages: 1, number: 0,
      },
      isLoading: false, error: null,
    } as any);
    vi.mocked(plenoApi.useAutentiqueList).mockReturnValue({
      data: {
        content: [{
          id: 'a1', nome: 'Ana', email: 'ana@x.com', status: 'pendente',
          externalDocumentId: 'doc-1', externalSignerId: null,
          criadoEm: '2026-09-01T10:00:00Z', assinadoEm: null,
          documentoTipo: 'laudo', documentoId: 'd1',
        }],
        totalElements: 1, totalPages: 1, number: 0,
      },
      isLoading: false, error: null,
    } as any);
    vi.mocked(plenoApi.useAbacatePayList).mockReturnValue({
      data: {
        content: [{
          id: 'p1', solicitacaoId: 'sol-1', provider: 'abacatepay',
          externalId: 'ext-1', status: 'pendente', valor: 100,
          checkoutUrl: null, criadoEm: '2026-09-01T10:00:00Z',
        }],
        totalElements: 1, totalPages: 1, number: 0,
      },
      isLoading: false, error: null,
    } as any);

    const user = userEvent.setup();
    renderWithProviders();

    const colunas = ['NOME', 'TIPO', 'STATUS', 'ID EXTERNO', 'ATUALIZADO'];
    expect(screen.getByText('Rua A, 1')).toBeInTheDocument();
    for (const col of colunas) expect(screen.getByText(col)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Autentique' }));
    expect(screen.getByText('Ana')).toBeInTheDocument();
    for (const col of colunas) expect(screen.getByText(col)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'AbacatePay' }));
    expect(screen.getByText('Solicitação sol-1')).toBeInTheDocument();
    for (const col of colunas) expect(screen.getByText(col)).toBeInTheDocument();
  });

  it('esconde a aba de provedor não configurado e mostra o aviso vermelho listando os que faltam', async () => {
    vi.mocked(integracoesApi.useIntegracoesConfig).mockReturnValue({
      data: { payment: 'mock', signature: 'autentique', pleno: 'http' },
      isError: false,
    } as any);
    const user = userEvent.setup();
    renderWithProviders();

    expect(screen.getByRole('button', { name: 'Pleno' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Autentique' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'AbacatePay' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Não configurado' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Provedores não configurados' }));
    expect(
      screen.getByText('Não foi possível descobrir os seguintes provedores ativos: pagamento'),
    ).toBeInTheDocument();
  });

  it('lista assinatura e pagamento quando nenhum dos dois está configurado', () => {
    vi.mocked(integracoesApi.useIntegracoesConfig).mockReturnValue({
      data: { payment: 'mock', signature: 'mock', pleno: 'http' },
      isError: false,
    } as any);
    renderWithProviders();
    expect(
      screen.getByText('Não foi possível descobrir os seguintes provedores ativos: assinatura, pagamento'),
    ).toBeInTheDocument();
  });

  it('abre o modal de filtros a partir do header', async () => {
    const user = userEvent.setup();
    renderWithProviders();

    await user.click(screen.getByRole('button', { name: /^filtros/i }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Buscar por nome')).toBeInTheDocument();
  });
});
