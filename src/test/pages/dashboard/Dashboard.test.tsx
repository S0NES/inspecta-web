import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Dashboard } from '../../../pages/dashboard/Dashboard';
import { useAppStore } from '../../../store/useAppStore';
import * as solicitacoesApi from '../../../api/solicitacoes';
import * as metricsApi from '../../../api/metrics';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<><Dashboard /><LocationProbe /></>} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

vi.mock('../../../api/solicitacoes', () => ({
  useSolicitacoes: vi.fn(),
  useSolicitacoesResumo: vi.fn(),
}));

vi.mock('../../../api/metrics', () => ({
  useMetricasEnvios: vi.fn(),
  useMetricasSolicitacoes: vi.fn(),
}));

const enviosMetricas = {
  inicio: '2026-07-30',
  fim: '2026-08-28',
  buckets: [
    {
      dia: '2026-08-01',
      tipoEnvio: 'email',
      tipoComunicacao: 'conta',
      criados: 12,
      enviados: 11,
      entregues: 10,
      aberturas: 5,
      cliques: 2,
      bounces: 1,
      reclamacoes: 0,
      falhas: 0,
    },
    {
      dia: '2026-08-02',
      tipoEnvio: 'sms',
      tipoComunicacao: 'operacional',
      criados: 4,
      enviados: 4,
      entregues: 4,
      aberturas: 0,
      cliques: 0,
      bounces: 0,
      reclamacoes: 0,
      falhas: 0,
    },
  ],
  totais: {
    dia: null,
    tipoEnvio: null,
    tipoComunicacao: null,
    criados: 16,
    enviados: 15,
    entregues: 14,
    aberturas: 5,
    cliques: 2,
    bounces: 1,
    reclamacoes: 0,
    falhas: 0,
  },
};

const solicMetricas = {
  inicio: '2026-07-30',
  fim: '2026-08-28',
  buckets: [
    { dia: '2026-08-01', tipoServicoId: '1', tipoServicoNome: 'Entrada', concluidas: 3, emAndamento: 2 },
    { dia: '2026-08-02', tipoServicoId: '2', tipoServicoNome: 'Saída', concluidas: 1, emAndamento: 4 },
  ],
};

const resumo = {
  solicitada: 2,
  atribuida: 1,
  agendada: 5,
  em_campo: 3,
  concluida: 7,
  cancelada: 1,
  total: 19,
};

const fila = {
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
      status: 'Em campo',
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
      status: 'Agendada',
      valor: 'R$ 500,00',
      urgente: true,
    },
  ],
  totalElements: 19,
  totalPages: 4,
  size: 5,
  number: 0,
  first: true,
  last: false,
};

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      role: 'corretor',
      auth: {
        accessToken: 'token',
        userEmail: 'camila.duarte@inspecta.com.br',
        userId: '2',
        perfil: 'imob_gerencia',
        imobiliariaId: '1',
        loginError: null,
      },
    });

    vi.mocked(solicitacoesApi.useSolicitacoesResumo).mockReturnValue({
      data: resumo,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(solicitacoesApi.useSolicitacoes).mockReturnValue({
      data: fila,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(metricsApi.useMetricasEnvios).mockReturnValue({
      data: enviosMetricas,
      isLoading: false,
      error: null,
    } as any);

    vi.mocked(metricsApi.useMetricasSolicitacoes).mockReturnValue({
      data: solicMetricas,
      isLoading: false,
      error: null,
    } as any);
  });

  it('saúda o usuário pelo primeiro nome do email quando o nome real ainda não carregou', () => {
    renderDashboard();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Camila');
  });

  it('saúda pela primeira palavra do nome real (auth.userName), não pelo e-mail', () => {
    useAppStore.setState((s) => ({ auth: { ...s.auth, userName: 'Julio Cesar' } }));
    renderDashboard();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Julio');
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('Cesar');
  });

  it('mostra as contagens vindas do resumo', () => {
    renderDashboard();

    expect(screen.getByText('AGUARDANDO ATRIBUIÇÃO')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // solicitada
    expect(screen.getByText('5')).toBeInTheDocument(); // agendada
    expect(screen.getByText('3')).toBeInTheDocument(); // em campo
    expect(screen.getByText('7')).toBeInTheDocument(); // concluída
  });

  it('mostra o total ao lado de cada métrica', () => {
    renderDashboard();
    expect(screen.getAllByText('de 19 no total').length).toBe(4);
  });

  it('exibe traço enquanto o resumo carrega', () => {
    vi.mocked(solicitacoesApi.useSolicitacoesResumo).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderDashboard();
    expect(screen.getAllByText('—').length).toBe(4);
  });

  it('lista a fila de trabalho vinda da API', () => {
    renderDashboard();

    expect(screen.getByText('SOL-1046')).toBeInTheDocument();
    expect(screen.getByText('SQN 210, Bloco C, Apto 302')).toBeInTheDocument();
    expect(screen.getByText('Marina Alves')).toBeInTheDocument();
    expect(screen.getByText('19 solicitações')).toBeInTheDocument();
  });

  it('marca as urgentes na fila', () => {
    renderDashboard();
    expect(screen.getByText(/URGENTE/)).toBeInTheDocument();
  });

  it('mostra a seção de SLA apenas quando há urgentes', () => {
    renderDashboard();
    expect(screen.getByText('PRAZO · SLA')).toBeInTheDocument();
    expect(screen.getByText('Atenção')).toBeInTheDocument();
  });

  it('esconde a seção de SLA quando não há urgentes', () => {
    vi.mocked(solicitacoesApi.useSolicitacoes).mockReturnValue({
      data: { ...fila, content: [fila.content[0]] },
      isLoading: false,
      error: null,
    } as any);

    renderDashboard();
    expect(screen.queryByText('PRAZO · SLA')).not.toBeInTheDocument();
  });

  it('mostra carregamento da fila', () => {
    vi.mocked(solicitacoesApi.useSolicitacoes).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    renderDashboard();
    expect(screen.getByText('Carregando solicitações…')).toBeInTheDocument();
  });

  it('mostra erro da fila', () => {
    vi.mocked(solicitacoesApi.useSolicitacoes).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('boom'),
    } as any);

    renderDashboard();
    expect(screen.getByText('Erro ao carregar solicitações')).toBeInTheDocument();
  });

  it('mostra estado vazio com atalho para criar', () => {
    vi.mocked(solicitacoesApi.useSolicitacoes).mockReturnValue({
      data: { ...fila, content: [], totalElements: 0 },
      isLoading: false,
      error: null,
    } as any);

    renderDashboard();
    expect(screen.getByText('Nenhuma solicitação na fila')).toBeInTheDocument();
  });

  it('o atalho "Criar a primeira solicitação" também respeita o perfil cliente', async () => {
    const user = userEvent.setup();
    useAppStore.setState((s) => ({ role: 'cliente', auth: { ...s.auth, perfil: 'cliente' } }));
    vi.mocked(solicitacoesApi.useSolicitacoes).mockReturnValue({
      data: { ...fila, content: [], totalElements: 0 },
      isLoading: false,
      error: null,
    } as any);

    renderDashboard();
    await user.click(screen.getByRole('button', { name: /criar a primeira solicitação/i }));
    expect(currentPath()).toBe('/solicitar');
  });

  it('leva ao wizard pelo botão de nova solicitação', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByRole('button', { name: /nova solicitação/i }));
    expect(currentPath()).toBe('/requests/new');
  });

  it('para o perfil cliente, o botão vira "Solicitar Vistoria" e leva ao /solicitar (não ao wizard de outros perfis)', async () => {
    const user = userEvent.setup();
    useAppStore.setState((s) => ({ role: 'cliente', auth: { ...s.auth, perfil: 'cliente' } }));
    renderDashboard();

    expect(screen.queryByRole('button', { name: /nova solicitação/i })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /solicitar vistoria/i }));
    expect(currentPath()).toBe('/solicitar');
  });

  it('leva à listagem ao clicar numa linha da fila', async () => {
    const user = userEvent.setup();
    renderDashboard();

    await user.click(screen.getByText('SOL-1046').closest('.queue-row') as HTMLElement);
    expect(currentPath()).toBe('/requests');
  });

  describe('seção de métricas de staff', () => {
    it('esconde os cards de Envios e Solicitações para corretor', () => {
      useAppStore.setState({ role: 'corretor' });
      renderDashboard();

      expect(screen.queryByText('Métricas de envio')).not.toBeInTheDocument();
      expect(screen.queryByText('ENVIOS')).not.toBeInTheDocument();
      expect(screen.queryByText('SOLICITAÇÕES')).not.toBeInTheDocument();
    });

    it('esconde os cards para vistoriador', () => {
      useAppStore.setState({ role: 'vistoriador' });
      renderDashboard();

      expect(screen.queryByText('Métricas de envio')).not.toBeInTheDocument();
    });

    it('mostra os cards para admin com o total do período', () => {
      useAppStore.setState({ role: 'admin' });
      renderDashboard();

      expect(screen.getByText('Métricas de envio')).toBeInTheDocument();
      expect(screen.getByText('ENVIOS')).toBeInTheDocument();
      expect(screen.getByText('SOLICITAÇÕES')).toBeInTheDocument();
      expect(screen.getByText('16')).toBeInTheDocument(); // totais.criados
    });

    it('abre o modal de Envios ao clicar no card', async () => {
      const user = userEvent.setup();
      useAppStore.setState({ role: 'admin' });
      renderDashboard();

      expect(screen.queryByRole('heading', { name: 'Envios · últimos 30 dias' })).not.toBeInTheDocument();

      await user.click(screen.getByText('ENVIOS').closest('[role="button"]') as HTMLElement);

      expect(screen.getByRole('heading', { name: 'Envios · últimos 30 dias' })).toBeInTheDocument();
    });

    it('abre o modal de Solicitações com os dois gráficos ao clicar no card', async () => {
      const user = userEvent.setup();
      useAppStore.setState({ role: 'admin' });
      renderDashboard();

      await user.click(screen.getByText('SOLICITAÇÕES').closest('[role="button"]') as HTMLElement);

      expect(
        screen.getByRole('heading', { name: 'Solicitações · últimos 30 dias' })
      ).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Concluídas' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Em andamento' })).toBeInTheDocument();
    });

    it('abre o modal de Envios via teclado (Enter)', async () => {
      const user = userEvent.setup();
      useAppStore.setState({ role: 'admin' });
      renderDashboard();

      const card = screen.getByText('ENVIOS').closest('[role="button"]') as HTMLElement;
      card.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByRole('heading', { name: 'Envios · últimos 30 dias' })).toBeInTheDocument();
    });
  });
});
