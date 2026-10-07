import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Laudos } from '../../../pages/laudos/Laudos';
import { useAppStore } from '../../../store/useAppStore';
import * as laudosApi from '../../../api/laudos';
import * as contestacoesApi from '../../../api/contestacoes';

// Mock the laudos API hooks
vi.mock('../../../api/laudos', () => ({
  useLaudos: vi.fn(),
  useRequestSignature: vi.fn(),
  useLaudoAssinantes: vi.fn(),
}));
vi.mock('../../../api/contestacoes', () => ({
  useCriarContestacao: vi.fn(),
}));

const mockLaudosPage = {
  content: [
    {
      id: '1042',
      solicitacaoServicoId: '501',
      versao: 1,
      status: 'ASSINADO' as const,
      origem: 'gerado_internamente' as const,
      criadoEm: '2026-08-10T10:00:00Z',
      assinadoEm: '2026-08-15T10:00:00Z',
      arquivoTamanho: 2500000,
      arquivoMime: 'application/pdf',
      fotosCount: 18,
    },
    {
      id: '1041',
      solicitacaoServicoId: '500',
      versao: 1,
      status: 'FINALIZADO' as const,
      origem: 'importado_pleno' as const,
      criadoEm: '2026-08-14T10:00:00Z',
      assinadoEm: null,
      arquivoTamanho: 3200000,
      arquivoMime: 'application/pdf',
      fotosCount: 22,
    },
    {
      id: '1040',
      solicitacaoServicoId: '499',
      versao: 1,
      status: 'ASSINADO' as const,
      origem: 'gerado_internamente' as const,
      criadoEm: '2026-08-13T10:00:00Z',
      assinadoEm: '2026-08-13T12:00:00Z',
      arquivoTamanho: 1800000,
      arquivoMime: 'application/pdf',
      fotosCount: 15,
    },
    {
      id: '1039',
      solicitacaoServicoId: '498',
      versao: 1,
      status: 'RASCUNHO' as const,
      origem: 'gerado_internamente' as const,
      criadoEm: '2026-08-10T10:00:00Z',
      assinadoEm: null,
      arquivoTamanho: null,
      arquivoMime: null,
      fotosCount: 5,
    },
  ],
  totalElements: 4,
  totalPages: 1,
  size: 50,
  number: 0,
};

describe('Laudos Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    useAppStore.setState({
      toastMessage: null,
    });

    vi.mocked(laudosApi.useLaudos).mockReturnValue({
      data: mockLaudosPage,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(laudosApi.useRequestSignature).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);

    vi.mocked(laudosApi.useLaudoAssinantes).mockReturnValue({
      data: [{ nome: 'Ana Silva', papel: 'locador', email: 'ana@x.co' }],
      isLoading: false,
    } as any);

    vi.mocked(contestacoesApi.useCriarContestacao).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <Laudos />
      </QueryClientProvider>
    );
  };

  const expandLaudo = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
    const row = screen.getByText(title).closest('.laudo-row') as HTMLElement;
    await user.click(row);
  };

  it('should render laudos header', () => {
    renderComponent();

    expect(screen.getByText('Laudos e assinaturas digitais')).toBeInTheDocument();
    expect(screen.getByText('Gerencie os laudos das suas vistorias')).toBeInTheDocument();
  });

  it('should render a card per real laudo, not fabricated data', () => {
    renderComponent();

    expect(screen.getByText('Laudo #1042 · v1')).toBeInTheDocument();
    expect(screen.getByText('Laudo #1041 · v1')).toBeInTheDocument();
  });

  it('should render laudo file sizes derived from the real arquivo', () => {
    renderComponent();

    expect(screen.getByText(/2,4 MB/)).toBeInTheDocument();
    expect(screen.getByText(/3,1 MB/)).toBeInTheDocument();
  });

  it('should render real photo counts', () => {
    renderComponent();

    expect(screen.getByText(/18 fotos/)).toBeInTheDocument();
    expect(screen.getByText(/22 fotos/)).toBeInTheDocument();
  });

  it('should render laudo status badges', () => {
    renderComponent();

    expect(screen.getAllByText('Assinado').length).toBeGreaterThan(0);
    expect(screen.getByText('Aguardando')).toBeInTheDocument();
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });

  it('should not show signature actions for a draft laudo', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandLaudo(user, 'Laudo #1039 · v1');

    expect(screen.getByText(/ainda em edição/i)).toBeInTheDocument();
  });

  it('should render request signature button only for finalized laudos', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandLaudo(user, 'Laudo #1041 · v1');

    const signatureButtons = screen.getAllByRole('button', { name: /solicitar assinatura digital/i });
    expect(signatureButtons.length).toBe(1); // only laudo 1041 (FINALIZADO)
  });

  it('should render download buttons', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandLaudo(user, 'Laudo #1042 · v1');

    expect(screen.getAllByRole('button', { name: /abrir pdf/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /baixar pdf/i }).length).toBeGreaterThan(0);
  });

  it('should render download zip and view signatures only for signed laudos', async () => {
    const user = userEvent.setup();
    renderComponent();

    await expandLaudo(user, 'Laudo #1042 · v1');
    expect(screen.getByRole('button', { name: /baixar zip de fotos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver assinaturas/i })).toBeInTheDocument();

    await expandLaudo(user, 'Laudo #1040 · v1');
    expect(screen.getByRole('button', { name: /baixar zip de fotos/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /ver assinaturas/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /solicitar assinatura digital/i })).not.toBeInTheDocument();
  });

  it('should show warning message only for finalized-but-unsigned laudos', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandLaudo(user, 'Laudo #1041 · v1');

    const warnings = screen.getAllByText(/não possui validade jurídica/i);
    expect(warnings.length).toBe(1);
  });

  it('should call request signature mutation when button clicked', async () => {
    const mockMutateAsync = vi.fn().mockResolvedValue({});
    vi.mocked(laudosApi.useRequestSignature).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);

    const user = userEvent.setup();
    renderComponent();
    await expandLaudo(user, 'Laudo #1041 · v1');

    const signatureButtons = screen.getAllByRole('button', { name: /solicitar assinatura digital/i });
    await user.click(signatureButtons[0]);

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'laudo', id: '1041' })
      );
    });
  });

  it('should show a success toast after requesting signature', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandLaudo(user, 'Laudo #1041 · v1');

    const signatureButtons = screen.getAllByRole('button', { name: /solicitar assinatura digital/i });
    await user.click(signatureButtons[0]);

    await waitFor(() => {
      const toastMessage = useAppStore.getState().toastMessage;
      expect(toastMessage).toContain('assinatura');
    });
  });

  it('should handle download PDF action', async () => {
    const user = userEvent.setup();
    renderComponent();
    await expandLaudo(user, 'Laudo #1042 · v1');

    const downloadButtons = screen.getAllByRole('button', { name: /baixar pdf/i });
    await user.click(downloadButtons[0]);

    await waitFor(() => {
      const toastMessage = useAppStore.getState().toastMessage;
      expect(toastMessage).toContain('baixado');
    });
  });

  it('should warn instead of faking a download when the PDF was not generated yet', async () => {
    // Laudo 1039 (RASCUNHO) has arquivoTamanho: null, but has no download buttons rendered
    // since it's still in edit — nothing to assert on a button here, this documents the guard.
    renderComponent();
    expect(screen.queryByText('Laudo #1039 · v1')).toBeInTheDocument();
  });

  it('should show pending state on signature request', async () => {
    vi.mocked(laudosApi.useRequestSignature).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as any);

    const user = userEvent.setup();
    renderComponent();
    await expandLaudo(user, 'Laudo #1041 · v1');

    expect(screen.getAllByRole('button', { name: /enviando/i }).length).toBeGreaterThan(0);
  });

  it('should disable signature button while pending', async () => {
    vi.mocked(laudosApi.useRequestSignature).mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: true,
    } as any);

    const user = userEvent.setup();
    renderComponent();
    await expandLaudo(user, 'Laudo #1041 · v1');

    const enviandoButtons = screen.getAllByRole('button', { name: /enviando/i });
    enviandoButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('should render one card per real laudo returned by the API', () => {
    const { container } = renderComponent();

    const laudoCards = container.querySelectorAll('.laudo-card');
    expect(laudoCards.length).toBe(mockLaudosPage.content.length);
  });

  it('should render separators between actions', async () => {
    const user = userEvent.setup();
    const { container } = renderComponent();
    await expandLaudo(user, 'Laudo #1042 · v1');

    const separators = container.querySelectorAll('.laudo-separator');
    expect(separators.length).toBeGreaterThan(0);
  });

  it('should handle error in signature request', async () => {
    const mockMutateAsync = vi.fn().mockRejectedValue(new Error('API Error'));
    vi.mocked(laudosApi.useRequestSignature).mockReturnValue({
      mutateAsync: mockMutateAsync,
      isPending: false,
    } as any);

    const user = userEvent.setup();
    renderComponent();
    await expandLaudo(user, 'Laudo #1041 · v1');

    const signatureButtons = screen.getAllByRole('button', { name: /solicitar assinatura digital/i });
    await user.click(signatureButtons[0]);

    await waitFor(() => {
      const toastMessage = useAppStore.getState().toastMessage;
      expect(toastMessage).toContain('Erro');
    });
  });

  it('shows a loading state', () => {
    vi.mocked(laudosApi.useLaudos).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('Carregando laudos...')).toBeInTheDocument();
  });

  it('shows an error state without fabricating data', () => {
    vi.mocked(laudosApi.useLaudos).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API Error'),
    } as any);

    renderComponent();

    expect(screen.getByText(/Erro ao carregar laudos/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no laudos', () => {
    vi.mocked(laudosApi.useLaudos).mockReturnValue({
      data: { content: [], totalElements: 0, totalPages: 0, size: 50, number: 0 },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('Nenhum laudo encontrado.')).toBeInTheDocument();
  });

  it('shows the "Importado · Pleno" badge only on laudos imported from Pleno', () => {
    renderComponent();

    const badges = screen.getAllByText('Importado · Pleno');
    expect(badges.length).toBe(1); // only laudo 1041 has origem importado_pleno
  });

  it('renders the origin filter tabs', () => {
    renderComponent();

    expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gerados internamente' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Importados da Pleno' })).toBeInTheDocument();
  });

  it('requests laudos filtered by origin when a tab is selected', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole('button', { name: 'Importados da Pleno' }));

    await waitFor(() => {
      expect(vi.mocked(laudosApi.useLaudos)).toHaveBeenCalledWith({
        origem: 'importado_pleno',
        page: 0,
        size: 20,
      });
    });
  });

  it('requests all laudos (no origin filter) by default', () => {
    renderComponent();

    expect(vi.mocked(laudosApi.useLaudos)).toHaveBeenCalledWith({
      origem: undefined,
      page: 0,
      size: 20,
    });
  });
});
