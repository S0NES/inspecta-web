import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { Extrato } from '../../../pages/extratos/Extrato';
import { useAppStore } from '../../../store/useAppStore';
import * as relatoriosApi from '../../../api/relatorios';
import * as adminApi from '../../../api/admin';

vi.mock('../../../api/relatorios', () => ({
  useExtratoVistorias: vi.fn(),
  useConsumoCrossImobiliaria: vi.fn(),
}));
vi.mock('../../../api/admin', () => ({ useImobiliarias: vi.fn() }));
// O painel de faturas tem teste próprio (FaturasPanel.test.tsx); aqui só a tabela/filtros do Extrato.
vi.mock('../../../pages/extratos/FaturasPanel', () => ({ FaturasPanel: () => null }));

const mockPage: relatoriosApi.VistoriasPage = {
  content: [
    {
      id: 'ss1', solicitacaoId: 's1', imobiliariaId: '1', imobiliariaNome: 'QA Imóveis',
      endereco: 'Rua das Flores, 100', tipoServico: 'Entrada', vistoriador: 'João Souza',
      status: 'concluida', criadoEm: '2026-09-05T12:00:00Z', valor: 320, laudoId: 'l1',
    },
    {
      id: 'ss2', solicitacaoId: 's2', imobiliariaId: null, imobiliariaNome: null,
      endereco: 'Av. Central, 200', tipoServico: 'Saída', vistoriador: null,
      status: 'pendente', criadoEm: '2026-09-07T12:00:00Z', valor: 280, laudoId: null,
    },
  ],
  totalElements: 2,
  totalPages: 1,
  number: 0,
  totalFaturado: 600,
};

describe('Extrato', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    useAppStore.setState({
      toastMessage: null,
      role: 'corretor',
      auth: {
        accessToken: 't', userEmail: 'g@demo.com', userId: '2', perfil: 'imob_gerencia',
        imobiliariaId: '1', imobiliariaIds: ['1'], loginError: null,
      },
    });
    vi.mocked(relatoriosApi.useExtratoVistorias).mockReturnValue({
      data: mockPage, isLoading: false, error: null,
    } as any);
    vi.mocked(adminApi.useImobiliarias).mockReturnValue({
      data: { content: [{ id: '1', razaoSocial: 'QA Imóveis LTDA', nomeFantasia: 'QA Imóveis', cnpj: '1', ativa: true }] },
    } as any);
  });

  const renderComponent = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Extrato />
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it('renderiza o cabeçalho e o subtítulo da tela pensada', () => {
    renderComponent();
    expect(screen.getByRole('heading', { name: 'Extrato' })).toBeInTheDocument();
    expect(screen.getByText(/Avulso/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /exportar extrato/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^filtros$/i })).toBeInTheDocument();
  });

  it('abre o modal de filtros com Mês e busca por vistoriador/vistoria, nessa ordem', async () => {
    const user = userEvent.setup();
    renderComponent();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^filtros$/i }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();

    const labels = Array.from(dialog.querySelectorAll('label')).map((l) => l.textContent);
    expect(labels).toEqual(['Mês', 'Pesquisar por nome do vistoriador/vistoria']);
  });

  it('mostra KPIs reais do recorte', () => {
    renderComponent();
    expect(screen.getByText('Total faturado no período')).toBeInTheDocument();
    expect(screen.getByText('Nº de vistorias')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*600,00/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('lista as vistorias com endereço, vistoriador e status', () => {
    renderComponent();
    expect(screen.getByText('Rua das Flores, 100')).toBeInTheDocument();
    expect(screen.getByText('Av. Central, 200')).toBeInTheDocument();
    expect(screen.getByText('João Souza')).toBeInTheDocument();
    expect(screen.getByText('Concluída')).toBeInTheDocument();
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText('Avulso · B2C')).toBeInTheDocument();
  });

  it('não mostra coluna "Nº do laudo" nem calendário de período', () => {
    renderComponent();
    expect(screen.queryByText(/Nº do laudo/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Vistorias no período')).not.toBeInTheDocument();
    expect(screen.queryByText('Selecione uma imobiliária para ver as vistorias.')).not.toBeInTheDocument();
  });

  it('ActionMenu: "Ver laudo" só quando há laudoId', async () => {
    const user = userEvent.setup();
    renderComponent();
    const menus = screen.getAllByRole('button', { name: 'Mais ações' });
    await user.click(menus[0]);
    expect(screen.getByText('Ver solicitação')).toBeInTheDocument();
    expect(screen.getByText('Ver laudo')).toBeInTheDocument();

    await user.click(menus[0]);
    await user.click(menus[1]);
    expect(screen.getAllByText('Ver solicitação').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ver laudo')).not.toBeInTheDocument();
  });

  describe('admin', () => {
    beforeEach(() => {
      useAppStore.setState({
        role: 'admin',
        auth: {
          accessToken: 't', userEmail: 'a@demo.com', userId: '1', perfil: 'admin',
          imobiliariaId: null, imobiliariaIds: [], loginError: null,
        },
      });
    });

    it('lista vistorias sem exigir seleção de imobiliária', async () => {
      const user = userEvent.setup();
      renderComponent();
      expect(screen.getByText('Rua das Flores, 100')).toBeInTheDocument();
      expect(screen.queryByText('Selecione uma imobiliária para ver as vistorias.')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /^filtros$/i }));
      expect(screen.getByLabelText('Imobiliária')).toBeInTheDocument();
    });
  });
});
