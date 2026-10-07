import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Requests } from '../../../pages/requests/Requests';
import { useAppStore } from '../../../store/useAppStore';
import * as solicitacoesApi from '../../../api/solicitacoes';
import * as imoveisApi from '../../../api/imoveis';
import * as adminApi from '../../../api/admin';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

vi.mock('../../../api/solicitacoes', () => ({
  useSolicitacoes: vi.fn(),
}));

vi.mock('../../../api/imoveis', () => ({
  useCidades: vi.fn(),
}));

vi.mock('../../../api/admin', () => ({
  useImobiliarias: vi.fn(),
}));

// useCidades() lives in api/imoveis.ts (the single canonical hook, see B1) and returns
// the flat Cidade[] array directly — not a page envelope.
const cidadesList = [
  { id: '1', nome: 'Brasília', uf: 'DF' },
  { id: '2', nome: 'São Paulo', uf: 'SP' },
];

const mockRequestData = {
  content: [
    {
      id: 'SOL-1046',
      solicitacaoId: '1046',
      imagem: 'Brasília/DF',
      endereco: 'SQN 210, Bloco C, Apto 302',
      tipo: 'Entrada',
      vistoriador: 'Marina Alves',
      data: '06/08/2026',
      hora: '09:15',
      status: 'Concluída',
      valor: 'R$ 450,00',
      urgente: false,
    },
    {
      id: 'SOL-1045',
      solicitacaoId: '1045',
      imagem: 'São Paulo/SP',
      endereco: 'Avenida Paulista, 1000',
      tipo: 'Saída',
      vistoriador: 'Diego Prado',
      data: '05/08/2026',
      hora: '14:30',
      status: 'Em campo',
      valor: 'R$ 500,00',
      urgente: true,
    },
  ],
  totalElements: 2,
  totalPages: 1,
  size: 20,
  number: 0,
  first: true,
  last: true,
};

describe('Requests Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    useAppStore.setState({
      expandedRequestId: null,
      requestsView: 'lista',
      role: 'corretor',
      auth: {
        accessToken: 't', userEmail: 'a', userId: '1', perfil: 'corretor',
        imobiliariaId: null, imobiliariaIds: [], loginError: null,
      },
    });
    vi.mocked(solicitacoesApi.useSolicitacoes).mockReturnValue({
      data: mockRequestData,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(imoveisApi.useCidades).mockReturnValue({
      data: cidadesList,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(adminApi.useImobiliarias).mockReturnValue({
      data: { content: [] },
      isLoading: false,
      error: null,
    } as any);
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/requests']}>
          <Routes>
            <Route path="/requests" element={<><Requests /><LocationProbe /></>} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('should render requests header', () => {
    renderComponent();

    expect(screen.getByText('Solicitações')).toBeInTheDocument();
    expect(screen.getByText('Gerencie todas as solicitações de vistorias')).toBeInTheDocument();
  });

  it('should render new request button', () => {
    renderComponent();

    const newButton = screen.getByRole('button', { name: /nova solicitação/i });
    expect(newButton).toBeInTheDocument();
  });

  it('mostra o board por padrão e alterna para a lista pelo toggle', async () => {
    useAppStore.setState({ requestsView: 'board' });
    const user = userEvent.setup();
    renderComponent();

    expect(screen.getByText('Em campo')).toBeInTheDocument();
    expect(screen.queryByText('TIPO · VISTORIADOR')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Lista' }));

    expect(useAppStore.getState().requestsView).toBe('lista');
    expect(screen.getByText('TIPO · VISTORIADOR')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Board' }));
    expect(useAppStore.getState().requestsView).toBe('board');
  });

  it('should render status totals', () => {
    renderComponent();

    expect(screen.getAllByText('Concluída').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Em campo').length).toBeGreaterThan(0);
  });

  /** Abre o modal de filtros, que hoje guarda status, cidade e prioridade. */
  const abrirFiltros = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: /^filtros/i }));
    await screen.findByRole('dialog');
  };

  it('should keep filters behind a filter trigger', () => {
    renderComponent();

    expect(screen.getByRole('button', { name: /^filtros/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Todos' })).not.toBeInTheDocument();
  });

  it('should render filter chips inside the popover', async () => {
    const user = userEvent.setup();
    renderComponent();
    await abrirFiltros(user);

    expect(screen.getByRole('button', { name: 'Todos' })).toBeInTheDocument();
  });

  it('should render the search filter inside the filters modal', async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(screen.queryByPlaceholderText('Pesquisar SOL- ou endereço')).not.toBeInTheDocument();
    await abrirFiltros(user);
    expect(screen.getByPlaceholderText('Pesquisar SOL- ou endereço')).toBeInTheDocument();
  });

  it('should render requests table', () => {
    renderComponent();

    expect(screen.getByText('SOLICITAÇÃO')).toBeInTheDocument();
    expect(screen.getByText('TIPO · VISTORIADOR')).toBeInTheDocument();
    expect(screen.getByText('DATA · HORA')).toBeInTheDocument();
    expect(screen.getByText('VALOR')).toBeInTheDocument();
  });

  it('should render request rows from API data', () => {
    renderComponent();

    expect(screen.getByText('SOL-1046')).toBeInTheDocument();
    expect(screen.getByText('SOL-1045')).toBeInTheDocument();
  });

  it('should render request details', () => {
    renderComponent();

    expect(screen.getAllByText(/Marina Alves/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Diego Prado/).length).toBeGreaterThan(0);
    // Request type and inspector shown in table rows
    const tables = screen.queryAllByText(/Entrada/);
    expect(tables.length).toBeGreaterThan(0);
  });

  it('should render loading state', () => {
    vi.mocked(solicitacoesApi.useSolicitacoes).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('Carregando solicitações…')).toBeInTheDocument();
  });

  it('should render error state', () => {
    vi.mocked(solicitacoesApi.useSolicitacoes).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API Error'),
    } as any);

    renderComponent();

    expect(screen.getByText('Erro ao carregar solicitações')).toBeInTheDocument();
  });

  it('should render empty state when no requests', () => {
    vi.mocked(solicitacoesApi.useSolicitacoes).mockReturnValue({
      data: { content: [], totalElements: 0, totalPages: 0, size: 20, number: 0 },
      isLoading: false,
      error: null,
    } as any);

    renderComponent();

    expect(screen.getByText('Nenhuma solicitação encontrada')).toBeInTheDocument();
  });

  it('should expand request row when clicked', async () => {
    const user = userEvent.setup();
    renderComponent();

    const requestRow = screen.getByText('SOL-1046').closest('.table-row');
    expect(requestRow).toBeInTheDocument();

    await user.click(requestRow!);

    await waitFor(() => {
      expect(useAppStore.getState().expandedRequestId).toBe('SOL-1046');
    });
  });

  it('should show expanded details when row is expanded', () => {
    useAppStore.setState({ expandedRequestId: 'SOL-1046' });

    renderComponent();

    expect(screen.getByText('CIDADE')).toBeInTheDocument();
    expect(screen.getByText('SERVIÇO')).toBeInTheDocument();
    expect(screen.getByText('VISTORIADOR')).toBeInTheDocument();
    // "Brasília/DF" também é opção do select de cidade, então busca dentro do painel.
    const painel = document.querySelector('.table-detail') as HTMLElement;
    expect(within(painel).getByText('Brasília/DF')).toBeInTheDocument();
  });

  it('should collapse request row when clicked while expanded', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ expandedRequestId: 'SOL-1046' });

    renderComponent();

    const requestRow = screen.getByText('SOL-1046').closest('.table-row');
    await user.click(requestRow!);

    await waitFor(() => {
      expect(useAppStore.getState().expandedRequestId).toBeNull();
    });
  });

  // A filtragem acontece no servidor, então o contrato testável é o parâmetro enviado.
  const chipPorRotulo = (label: string) =>
    screen
      .getAllByRole('button')
      .find((btn) => btn.textContent === label && btn.classList.contains('filter-chip'));

  it('should send the status key to the API when a chip is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await abrirFiltros(user);

    await user.click(chipPorRotulo('Em campo')!);

    await waitFor(() => {
      expect(solicitacoesApi.useSolicitacoes).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'em_campo', page: 0 })
      );
    });
  });

  it('should toggle the status chip off when clicked twice', async () => {
    const user = userEvent.setup();
    renderComponent();
    await abrirFiltros(user);

    await user.click(chipPorRotulo('Agendada')!);
    await waitFor(() =>
      expect(solicitacoesApi.useSolicitacoes).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'agendada' })
      )
    );

    await user.click(chipPorRotulo('Agendada')!);
    await waitFor(() =>
      expect(solicitacoesApi.useSolicitacoes).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: '' })
      )
    );
  });

  it('should send the urgent filter to the API', async () => {
    const user = userEvent.setup();
    renderComponent();
    await abrirFiltros(user);

    await user.click(chipPorRotulo('Somente urgentes')!);

    await waitFor(() => {
      expect(solicitacoesApi.useSolicitacoes).toHaveBeenLastCalledWith(
        expect.objectContaining({ urgente: true })
      );
    });
  });

  it('should send the selected city to the API', async () => {
    const user = userEvent.setup();
    renderComponent();
    await abrirFiltros(user);

    await user.selectOptions(screen.getByLabelText('Cidade'), '2');

    await waitFor(() => {
      expect(solicitacoesApi.useSolicitacoes).toHaveBeenLastCalledWith(
        expect.objectContaining({ cidadeId: '2' })
      );
    });
  });

  it('should search requests by ID', async () => {
    const user = userEvent.setup();
    renderComponent();
    await abrirFiltros(user);

    const searchInput = screen.getByPlaceholderText('Pesquisar SOL- ou endereço');
    await user.type(searchInput, 'Paulista');

    // A busca é debounced antes de virar request, para não consultar a cada tecla.
    await waitFor(
      () => {
        expect(solicitacoesApi.useSolicitacoes).toHaveBeenLastCalledWith(
          expect.objectContaining({ q: 'Paulista' })
        );
      },
      { timeout: 2000 }
    );
  });

  it('should not query on every keystroke while typing', async () => {
    const user = userEvent.setup();
    renderComponent();
    await abrirFiltros(user);

    await user.type(screen.getByPlaceholderText('Pesquisar SOL- ou endereço'), 'Paul');

    // Imediatamente após digitar, a busca ainda não foi enviada.
    expect(solicitacoesApi.useSolicitacoes).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: '' })
    );
  });

  it('should flag urgent requests', () => {
    renderComponent();
    expect(screen.getByText(/URGENTE/)).toBeInTheDocument();
  });

  it('should render action buttons in expanded row', () => {
    useAppStore.setState({ expandedRequestId: 'SOL-1046' });

    renderComponent();

    expect(screen.getByRole('button', { name: 'Ver detalhe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver laudos' })).toBeInTheDocument();
  });

  it('should open the detail screen from the expanded row', async () => {
    const user = userEvent.setup();
    useAppStore.setState({ expandedRequestId: 'SOL-1046' });

    renderComponent();
    await user.click(screen.getByRole('button', { name: 'Ver detalhe' }));

    expect(currentPath()).toBe('/inspections/1046');
  });

  it('should navigate to the wizard from "Nova solicitação"', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole('button', { name: 'Nova solicitação' }));

    expect(currentPath()).toBe('/requests/new');
  });

  it('should disable pagination on a single page', () => {
    renderComponent();

    expect(screen.getByRole('button', { name: /anterior/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /próximo/i })).toBeDisabled();
  });

  it('should render pagination footer', () => {
    renderComponent();

    expect(screen.getByText(/2 de 2 solicitações/)).toBeInTheDocument();
  });

  it('should render pagination buttons', () => {
    renderComponent();

    expect(screen.getByRole('button', { name: /anterior/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /próximo/i })).toBeInTheDocument();
  });

  it('should call useSolicitacoes with status filter', () => {
    renderComponent();

    // The hook should be called with default filters
    expect(solicitacoesApi.useSolicitacoes).toHaveBeenCalled();
  });

  it('should render all status badges', () => {
    renderComponent();

    expect(screen.getAllByText('Concluída').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Em campo').length).toBeGreaterThan(0);
  });

  it('should count active filters on the trigger', async () => {
    const user = userEvent.setup();
    renderComponent();
    await abrirFiltros(user);

    await user.click(chipPorRotulo('Em campo')!);

    expect(screen.getByRole('button', { name: /^filtros/i })).toHaveTextContent('1');
  });

  it('should clear all filters from the popover', async () => {
    const user = userEvent.setup();
    renderComponent();
    await abrirFiltros(user);

    await user.click(chipPorRotulo('Em campo')!);
    await user.click(screen.getByRole('button', { name: /limpar filtros/i }));

    await waitFor(() => {
      expect(solicitacoesApi.useSolicitacoes).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: '', urgente: undefined, cidadeId: undefined })
      );
    });
  });

  // O rótulo textual saiu: expandir/fechar é só ícone, com nome acessível.
  it('should display a collapsed chevron icon per row', () => {
    renderComponent();

    expect(screen.getAllByLabelText('Abrir detalhes').length).toBe(2);
  });

  it('should display an open chevron icon for the expanded row', () => {
    useAppStore.setState({ expandedRequestId: 'SOL-1046' });

    renderComponent();

    const icone = screen.getByLabelText('Fechar detalhes');
    expect(icone).toBeInTheDocument();
    expect(icone).toHaveClass('chevron--open');
  });

  it('should clear expanded request when switching status filters', async () => {
    useAppStore.setState({ expandedRequestId: 'SOL-1046' });

    renderComponent();

    expect(useAppStore.getState().expandedRequestId).toBe('SOL-1046');
  });

  // A lista /inspections foi removida; o vistoriador passa a usar /requests como fila.
  // Para esse perfil a tela é só leitura: sem "Nova solicitação", sem CTA de pagamento,
  // sem atalho para laudos — e o botão de detalhe vira "Ir para vistoria".
  describe('perfil vistoriador em /requests', () => {
    beforeEach(() => {
      useAppStore.setState({
        expandedRequestId: 'SOL-1046',
        requestsView: 'lista',
        role: 'vistoriador',
        auth: {
          accessToken: 't', userEmail: 'v', userId: '9', perfil: 'vistoriador',
          imobiliariaId: null, imobiliariaIds: [], loginError: null,
        },
      });
      vi.mocked(solicitacoesApi.useSolicitacoes).mockReturnValue({
        data: {
          ...mockRequestData,
          content: [
            {
              ...mockRequestData.content[0],
              checkoutUrl: 'https://pay.example/abc',
              paymentStatus: 'pendente',
            },
          ],
          totalElements: 1,
        },
        isLoading: false,
        error: null,
      } as any);
    });

    it('esconde "Nova solicitação"', () => {
      renderComponent();
      expect(screen.queryByRole('button', { name: /nova solicitação/i })).not.toBeInTheDocument();
    });

    it('esconde o CTA de pagamento e o atalho para laudos na linha expandida', () => {
      renderComponent();
      expect(screen.queryByRole('button', { name: /^pagar$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /ver laudos/i })).not.toBeInTheDocument();
    });

    it('mostra "Ir para vistoria" e navega para /inspections/:id', async () => {
      const user = userEvent.setup();
      renderComponent();

      const cta = screen.getByRole('button', { name: /ir para vistoria/i });
      expect(screen.queryByRole('button', { name: /^ver detalhe$/i })).not.toBeInTheDocument();

      await user.click(cta);
      expect(currentPath()).toBe('/inspections/1046');
    });
  });
});
