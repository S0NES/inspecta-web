import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Admin } from '../../../pages/admin/Admin';
import { useAppStore } from '../../../store/useAppStore';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

const BASE_URL = 'http://localhost:8080';

const mockImobiliariasData = {
  content: [
    { id: '1', razaoSocial: 'Imobiliária XYZ', nomeFantasia: 'XYZ Imóveis', cnpj: '11.222.333/0001-81', ativa: true },
    { id: '2', razaoSocial: 'Imobiliária ABC', nomeFantasia: null, cnpj: '98.765.432/0001-90', ativa: false },
  ],
  totalElements: 2,
  totalPages: 1,
  size: 50,
  number: 0,
};

const server = setupServer(
  http.get(`${BASE_URL}/v1/imobiliarias`, () => HttpResponse.json(mockImobiliariasData)),
);

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' });
  useAppStore.setState({ toastMessage: null });
});

afterEach(() => {
  server.resetHandlers();
  useAppStore.setState({ toastMessage: null });
});

afterEach(() => server.close());

function renderWithProviders(component: React.ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/agencies']}>
        <Routes>
          <Route path="/agencies" element={<>{component}<LocationProbe /></>} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Admin (Real Estate — só imobiliárias)', () => {
  it('renders the page title with the hover "Sobre esta tela" hint (no permanent description)', () => {
    renderWithProviders(<Admin />);

    expect(screen.getByRole('heading', { name: 'Imobiliaria' })).toBeInTheDocument();
    expect(screen.getByText(/Cadastro das/i)).toBeInTheDocument();
  });

  it('has no tabs — it is a single agencies list, not the old Vistoriadores/Corretores tabs', () => {
    renderWithProviders(<Admin />);

    expect(screen.queryByRole('button', { name: /^vistoriadores$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^usuários da imobiliária$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^imobiliárias$/i })).not.toBeInTheDocument();
  });

  it('displays agencies by razaoSocial', async () => {
    renderWithProviders(<Admin />);

    await waitFor(() => {
      expect(screen.getByText('Imobiliária XYZ')).toBeInTheDocument();
      expect(screen.getByText('Imobiliária ABC')).toBeInTheDocument();
    });
  });

  it('shows empty state when no agencies exist', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/imobiliarias`, () => HttpResponse.json({ ...mockImobiliariasData, content: [] })),
    );

    renderWithProviders(<Admin />);

    await waitFor(() => expect(screen.getByText('Nenhuma imobiliária encontrada')).toBeInTheDocument());
  });

  it('filters the agencies list by the search input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Admin />);

    await waitFor(() => expect(screen.getByText('Imobiliária XYZ')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: /^filtros/i }));
    await user.type(await screen.findByPlaceholderText('Buscar por nome...'), 'xyz');

    await waitFor(() => {
      expect(screen.getByText('Imobiliária XYZ')).toBeInTheDocument();
      expect(screen.queryByText('Imobiliária ABC')).not.toBeInTheDocument();
    });
  });

  it('"+ Nova imobiliária" navigates to the agency creation screen', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Admin />);

    await user.click(screen.getByRole('button', { name: /nova imobiliária/i }));

    expect(currentPath()).toBe('/agencies/new');
  });

  it('clicking an agency row opens a read-only compact detail (no edit form)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Admin />);

    await waitFor(() => expect(screen.getByText('Imobiliária XYZ')).toBeInTheDocument());

    const row = screen.getByText('Imobiliária XYZ').closest('.admin-row') as HTMLElement;
    await user.click(row);

    expect(screen.getByText('RAZÃO SOCIAL')).toBeInTheDocument();
    const detail = screen.getByText('RAZÃO SOCIAL').closest('.detail-grid') as HTMLElement;
    expect(within(detail).getByText('CNPJ')).toBeInTheDocument();
    expect(within(detail).getByText('11.222.333/0001-81')).toBeInTheDocument();

    await user.click(row);
    expect(screen.queryByText('RAZÃO SOCIAL')).not.toBeInTheDocument();
  });

  it('"Editar" on an agency row navigates to Agency pre-selected, without expanding the row detail', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Admin />);

    await waitFor(() => expect(screen.getByText('Imobiliária XYZ')).toBeInTheDocument());

    const row = screen.getByText('Imobiliária XYZ').closest('.admin-row') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /ações de/i }));
    await user.click(screen.getByRole('menuitem', { name: /^editar$/i }));

    expect(currentPath()).toBe('/agencies/1/edit');
    expect(screen.queryByText('RAZÃO SOCIAL')).not.toBeInTheDocument();
  });

  it('does not toggle the agency row detail when clicking status or action menu', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Admin />);

    await waitFor(() => expect(screen.getByText('Imobiliária XYZ')).toBeInTheDocument());

    const row = screen.getByText('Imobiliária XYZ').closest('.admin-row') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: /inativar imobiliária/i }));

    expect(screen.queryByText('RAZÃO SOCIAL')).not.toBeInTheDocument();
  });

});
