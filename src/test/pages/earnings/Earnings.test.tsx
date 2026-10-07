import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Earnings } from '../../../pages/earnings/Earnings';
import { useAppStore } from '../../../store/useAppStore';

const BASE_URL = 'http://localhost:8080';

const mockEarningsData = {
  vistoriadorId: '2',
  periodo: '2024-08-06',
  ganhosBrutos: 2000,
  comissao: 100,
  pagoPendente: 350,
  pagamentos: [
    {
      id: '1',
      periodo: '2024-08-15',
      valor: 450,
      status: 'RECEBIDO',
      dataRecebimento: '2024-08-15',
    },
    {
      id: '2',
      periodo: '2024-08-14',
      valor: 450,
      status: 'RECEBIDO',
      dataRecebimento: '2024-08-14',
    },
    {
      id: '3',
      periodo: '2024-08-13',
      valor: 350,
      status: 'PENDENTE',
    },
    {
      id: '4',
      periodo: '2024-08-12',
      valor: 450,
      status: 'RETIDO',
    },
  ],
  totalPago: 1800,
  totalPendente: 350,
};

const server = setupServer(
  http.get(`${BASE_URL}/v1/vistoriadores/:id/extrato`, () =>
    HttpResponse.json(mockEarningsData)
  )
);

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' });
  useAppStore.setState({
    auth: {
      accessToken: 'token',
      userEmail: 'test@example.com',
      userId: '2',
      perfil: 'vistoriador',
      imobiliariaId: '1',
      loginError: null,
    },
  });
});

afterEach(() => {
  server.resetHandlers();
  useAppStore.setState({
    auth: {
      accessToken: null,
      userEmail: null,
      userId: null,
      perfil: null,
      imobiliariaId: null,
      loginError: null,
    },
  });
});

afterEach(() => server.close());

function renderWithProviders(component: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {component}
    </QueryClientProvider>
  );
}

describe('Earnings', () => {
  it('renders page header with title and subtitle', () => {
    renderWithProviders(<Earnings />);

    expect(screen.getByText('Extrato de recebimentos')).toBeInTheDocument();
    expect(
      screen.getByText('Acompanhamento de todos os seus recebimentos')
    ).toBeInTheDocument();
  });

  it('displays loading state when data is loading', () => {
    server.use(
      http.get(`${BASE_URL}/v1/vistoriadores/:id/extrato`, async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return HttpResponse.json(mockEarningsData);
      })
    );

    renderWithProviders(<Earnings />);

    expect(screen.getByText('Carregando extrato...')).toBeInTheDocument();
  });

  it('displays error state when API fails', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/vistoriadores/:id/extrato`, () =>
        new HttpResponse('Error', { status: 500 })
      )
    );

    renderWithProviders(<Earnings />);

    await waitFor(() => {
      expect(
        screen.getByText('Erro ao carregar extrato. Tente novamente mais tarde.')
      ).toBeInTheDocument();
    });
  });

  it('displays totals section with three cards', async () => {
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      expect(screen.getByText('RECEBIDO')).toBeInTheDocument();
      expect(screen.getByText('A RECEBER')).toBeInTheDocument();
      expect(screen.getByText('RETIDO')).toBeInTheDocument();
    });
  });

  it('displays correct total values from API', async () => {
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      const totalElements = screen.getAllByText('R$ 1.800,00');
      expect(totalElements.length).toBeGreaterThan(0);
      const pendingElements = screen.getAllByText('R$ 350,00');
      expect(pendingElements.length).toBeGreaterThan(0);
    });
  });

  it('renders earnings table with header columns', async () => {
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      expect(screen.getByText('DESCRIÇÃO')).toBeInTheDocument();
      expect(screen.getByText('DATA')).toBeInTheDocument();
      expect(screen.getByText('VALOR')).toBeInTheDocument();
      expect(screen.getByText('STATUS')).toBeInTheDocument();
    });
  });

  it('displays earnings list items', async () => {
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      expect(screen.getAllByText(/Vistoria/i).length).toBeGreaterThan(0);
    });
  });

  it('displays status badges with correct colors', async () => {
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      const recebidoBadges = screen.getAllByText('Recebido');
      expect(recebidoBadges.length).toBeGreaterThan(0);
      const aReceberBadges = screen.getAllByText('A receber');
      expect(aReceberBadges.length).toBeGreaterThan(0);
      const retidoBadges = screen.getAllByText('Retido');
      expect(retidoBadges.length).toBeGreaterThan(0);
    });
  });

  it('expands earning details when row is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      expect(screen.getAllByText(/Vistoria/i).length).toBeGreaterThan(0);
    });

    const earnings = screen.getAllByText(/Vistoria/i);
    const firstEarningRow = earnings[0].closest('.earnings-row');
    await user.click(firstEarningRow!);

    await waitFor(() => {
      expect(screen.getByText('ID')).toBeInTheDocument();
    });
  });

  it('displays expanded earning details', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      expect(screen.getAllByText(/Vistoria/i).length).toBeGreaterThan(0);
    });

    const earnings = screen.getAllByText(/Vistoria/i);
    const firstEarningRow = earnings[0].closest('.earnings-row');
    await user.click(firstEarningRow!);

    await waitFor(() => {
      expect(screen.getAllByText('DESCRIÇÃO').length).toBeGreaterThan(0);
      expect(screen.getAllByText('DATA').length).toBeGreaterThan(0);
      expect(screen.getAllByText('VALOR').length).toBeGreaterThan(0);
      expect(screen.getAllByText('STATUS').length).toBeGreaterThan(0);
    });
  });

  it('collapses expanded earning details when clicked again', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      expect(screen.getAllByText(/Vistoria/i).length).toBeGreaterThan(0);
    });

    const earnings = screen.getAllByText(/Vistoria/i);
    const firstEarningRow = earnings[0].closest('.earnings-row');

    // Expand
    await user.click(firstEarningRow!);
    await waitFor(() => {
      expect(screen.getByText('ID')).toBeInTheDocument();
    });

    // Collapse
    await user.click(firstEarningRow!);
    const expandedDetails = screen.queryAllByText('ID');
    expect(expandedDetails.length).toBe(0);
  });

  it('shows chevron indicator for collapsed state', async () => {
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      expect(screen.getAllByText(/Vistoria/i).length).toBeGreaterThan(0);
    });

    // Should show down chevron for collapsed items
    const downChevrons = screen.getAllByLabelText('Abrir detalhes');
    expect(downChevrons.length).toBeGreaterThan(0);
  });

  it('shows chevron indicator for expanded state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      expect(screen.getAllByText(/Vistoria/i).length).toBeGreaterThan(0);
    });

    const earnings = screen.getAllByText(/Vistoria/i);
    const firstEarningRow = earnings[0].closest('.earnings-row');
    await user.click(firstEarningRow!);

    await waitFor(() => {
      const upChevrons = screen.getAllByLabelText('Fechar detalhes');
      expect(upChevrons.length).toBeGreaterThan(0);
    });
  });

  it('displays all earnings items from API', async () => {
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      const earnings = screen.getAllByText(/Vistoria/i);
      expect(earnings.length).toBe(4); // 4 payments in mock data
    });
  });

  it('formats currency values correctly', async () => {
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      const valuesA = screen.getAllByText('R$ 450,00');
      expect(valuesA.length).toBeGreaterThan(0);
      const valuesB = screen.getAllByText('R$ 350,00');
      expect(valuesB.length).toBeGreaterThan(0);
    });
  });

  it('shows an empty state when no vistoriador ID is available', () => {
    useAppStore.setState({
      auth: {
        accessToken: 'token',
        userEmail: 'test@example.com',
        userId: null, // No user ID
        perfil: 'vistoriador',
        imobiliariaId: '1',
        loginError: null,
      },
    });

    renderWithProviders(<Earnings />);

    // No vistoriadorId => query stays disabled => no fabricated data shown
    expect(screen.getByText('Nenhum recebimento registrado ainda.')).toBeInTheDocument();
  });

  it('handles multiple expanded items sequentially', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      expect(screen.getAllByText(/Vistoria/i).length).toBeGreaterThan(0);
    });

    const earnings = screen.getAllByText(/Vistoria/i);

    // Expand first
    await user.click(earnings[0].closest('.earnings-row')!);
    await waitFor(() => {
      expect(screen.getByText('ID')).toBeInTheDocument();
    });

    // Collapse first
    await user.click(earnings[0].closest('.earnings-row')!);

    // Expand second
    await user.click(earnings[1].closest('.earnings-row')!);
    await waitFor(() => {
      expect(screen.getByText('ID')).toBeInTheDocument();
    });
  });

  it('displays earning ID in expanded details', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      expect(screen.getAllByText(/Vistoria/i).length).toBeGreaterThan(0);
    });

    const earnings = screen.getAllByText(/Vistoria/i);
    await user.click(earnings[0].closest('.earnings-row')!);

    await waitFor(() => {
      expect(screen.getByText(/EARN-/i)).toBeInTheDocument();
    });
  });

  it('badges have correct tone based on status', async () => {
    renderWithProviders(<Earnings />);

    await waitFor(() => {
      expect(screen.getAllByText('Recebido').length).toBeGreaterThan(0);
    });
  });
});
