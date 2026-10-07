import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { RequestsBoard } from '../../../pages/requests/RequestsBoard';
import * as solicitacoesApi from '../../../api/solicitacoes';

vi.mock('../../../api/solicitacoes', () => ({ useSolicitacoes: vi.fn() }));

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

const page = <T,>(content: T[]) => ({
  content, totalElements: content.length, totalPages: 1, size: 50, number: 0, first: true, last: true,
});

const card = (id: string, status: string) => ({
  id, solicitacaoId: id, endereco: `Rua ${id}`, imagem: '', tipo: 'Entrada',
  vistoriador: 'Fulano', data: '01/09', hora: '10:00', status, valor: 'R$ 100', urgente: false,
});

describe('RequestsBoard', () => {
  let qc: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // Cada chamada de useSolicitacoes recebe um status distinto; devolve 1 card daquele status.
    vi.mocked(solicitacoesApi.useSolicitacoes).mockImplementation((f: any) => ({
      data: page([card(f.status === 'solicitada' ? '10' : '20', f.status)]),
      isLoading: false, error: null,
    } as any));
  });

  const renderIt = (props = {}) =>
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/requests']}>
          <Routes>
            <Route path="/requests" element={<><RequestsBoard {...props} /><LocationProbe /></>} />
            <Route path="*" element={<LocationProbe />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

  it('renderiza as 6 colunas de status', () => {
    renderIt();
    ['Solicitada', 'Atribuída', 'Agendada', 'Em campo', 'Concluída', 'Cancelada'].forEach((c) =>
      expect(screen.getByText(c)).toBeInTheDocument());
  });

  it('mostra os cartões agrupados e navega ao clicar', async () => {
    const user = userEvent.setup();
    renderIt();
    expect(screen.getByText('SOL-10')).toBeInTheDocument();
    await user.click(screen.getByText('SOL-10'));
    expect(currentPath()).toBe('/inspections/10');
  });

  it('statusFilter mostra só a coluna correspondente', () => {
    renderIt({ statusFilter: 'em_campo' });
    expect(screen.getByText('Em campo')).toBeInTheDocument();
    expect(screen.queryByText('Solicitada')).not.toBeInTheDocument();
  });
});
