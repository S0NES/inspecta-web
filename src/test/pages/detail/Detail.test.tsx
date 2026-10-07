import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Detail } from '../../../pages/detail/Detail';
import { useAppStore } from '../../../store/useAppStore';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

const BASE_URL = 'http://localhost:8080';

const mockSolicitacoesPage = {
  content: [
    {
      id: 'SOL-1042',
      solicitacaoId: '1042',
      endereco: 'Rua das Flores, 123 · Brasília · DF',
      imagem: 'IMV-0812',
      tipo: 'Entrada',
      vistoriador: 'Marina Alves',
      data: '15 ago',
      hora: '14:30',
      status: 'Em campo',
      valor: 'R$ 450,00',
      urgente: false,
    },
  ],
  totalElements: 1,
  totalPages: 1,
  size: 100,
  number: 0,
  first: true,
  last: true,
};

const mockArquivos = [
  { id: '1', mime: 'image/jpeg', tamanho: 120000, criadoEm: '2026-08-15T14:35:00Z' },
];

const server = setupServer(
  http.post(`${BASE_URL}/v1/uploads`, () => HttpResponse.json({ arquivoId: '123' })),
  http.get(`${BASE_URL}/v1/solicitacoes`, () => HttpResponse.json(mockSolicitacoesPage)),
  http.get(`${BASE_URL}/v1/uploads`, () => HttpResponse.json(mockArquivos))
);

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' });
  useAppStore.setState({
    inspectionPhotos: {},
  });
});

afterEach(() => {
  server.resetHandlers();
  useAppStore.setState({
    inspectionPhotos: {},
  });
});

afterEach(() => server.close());

/** Renderiza Detail sob a rota `/inspections/:id` (default id `1042`; `null` = sem id). */
function renderWithProviders(_component: React.ReactElement, id: string | null = '1042') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[id == null ? '/inspections' : `/inspections/${id}`]}>
        <Routes>
          <Route path="/inspections/:id" element={<><Detail /><LocationProbe /></>} />
          <Route path="/inspections" element={<><Detail /><LocationProbe /></>} />
          {/* A lista /inspections saiu; "voltar" agora vai para /requests. */}
          <Route path="/requests" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('Detail', () => {
  it('renders inspection header with title and address from the real solicitação', async () => {
    renderWithProviders(<Detail />);

    await waitFor(() => {
      expect(screen.getByText('SOL-1042')).toBeInTheDocument();
      expect(screen.getByText('Rua das Flores, 123 · Brasília · DF')).toBeInTheDocument();
    });
  });

  it('displays real inspection info cards, not a fabricated client name', async () => {
    renderWithProviders(<Detail />);

    await waitFor(() => {
      expect(screen.getByText('TIPO')).toBeInTheDocument();
      expect(screen.getByText('Entrada')).toBeInTheDocument();
      expect(screen.getByText('VISTORIADOR')).toBeInTheDocument();
      expect(screen.getByText('Marina Alves')).toBeInTheDocument();
    });
    expect(screen.queryByText('CLIENTE')).not.toBeInTheDocument();
  });

  it('shows empty state when inspection is not found', async () => {
    renderWithProviders(<Detail />, '9999');

    await waitFor(() => {
      expect(screen.getByText('Vistoria não encontrada')).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /voltar para solicitações/i })).toBeInTheDocument();
  });

  it('shows empty state when there is no inspection selected at all', () => {
    renderWithProviders(<Detail />, null);

    expect(screen.getByText('Vistoria não encontrada')).toBeInTheDocument();
  });

  it('renders all environment cards', async () => {
    renderWithProviders(<Detail />);

    await waitFor(() => expect(screen.getByText('Sala')).toBeInTheDocument());
    expect(screen.getByText('Cozinha')).toBeInTheDocument();
    expect(screen.getByText('Quarto 1')).toBeInTheDocument();
    expect(screen.getByText('Quarto 2')).toBeInTheDocument();
    expect(screen.getByText('Banheiro')).toBeInTheDocument();
    expect(screen.getByText('Área de serviço')).toBeInTheDocument();
  });

  it('shows progress bar initially at 0%', async () => {
    renderWithProviders(<Detail />);

    await waitFor(() => {
      expect(screen.getByText(/0 de 8 ambientes documentados/)).toBeInTheDocument();
    });
  });

  it('shows the real total of already-saved photos alongside the session checklist', async () => {
    renderWithProviders(<Detail />);

    await waitFor(() => {
      expect(screen.getByText(/1 foto salva no total/)).toBeInTheDocument();
    });
  });

  it('displays "SEM FOTO" badge for environments without photos', async () => {
    renderWithProviders(<Detail />);

    await waitFor(() => {
      const semFotoBadges = screen.getAllByText('SEM FOTO');
      expect(semFotoBadges.length).toBeGreaterThan(0);
    });
  });

  it('renders upload button for each environment', async () => {
    renderWithProviders(<Detail />);

    await waitFor(() => {
      const uploadButtons = screen.getAllByRole('button', { name: 'Adicionar foto' });
      expect(uploadButtons.length).toBe(8);
    });
  });

  it('disables "Concluir vistoria" button when not all environments have photos', async () => {
    renderWithProviders(<Detail />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /concluir vistoria/i });
      expect(button).toBeDisabled();
    });
  });

  it('enables "Concluir vistoria" button when all environments have photos this session', async () => {
    const ambientes = ['sala', 'cozinha', 'quarto1', 'quarto2', 'banheiro', 'areaServico', 'varanda', 'fachada'];
    const newPhotos: Record<string, string[]> = {};
    ambientes.forEach((ambienteId) => {
      newPhotos[`SOL-1042-${ambienteId}`] = ['photo-url'];
    });
    useAppStore.setState({ inspectionPhotos: newPhotos });

    renderWithProviders(<Detail />);

    await waitFor(() => {
      const button = screen.getByRole('button', { name: /concluir vistoria/i });
      expect(button).not.toBeDisabled();
    });
  });

  it('displays photo count badge when photos exist this session', async () => {
    useAppStore.setState({
      inspectionPhotos: { 'SOL-1042-sala': ['photo1', 'photo2'] },
    });

    renderWithProviders(<Detail />);

    await waitFor(() => {
      expect(screen.getByText('2 fotos')).toBeInTheDocument();
    });
  });

  it('shows completion status when all environments documented', async () => {
    const ambientes = ['sala', 'cozinha', 'quarto1', 'quarto2', 'banheiro', 'areaServico', 'varanda', 'fachada'];
    const newPhotos: Record<string, string[]> = {};
    ambientes.forEach((ambienteId) => {
      newPhotos[`SOL-1042-${ambienteId}`] = ['photo-url'];
    });
    useAppStore.setState({ inspectionPhotos: newPhotos });

    renderWithProviders(<Detail />);

    await waitFor(() => {
      expect(screen.getByText('Todos os ambientes foram documentados')).toBeInTheDocument();
    });
  });

  it('shows incomplete status when environments are missing', async () => {
    renderWithProviders(<Detail />);

    await waitFor(() => {
      expect(screen.getByText(/faltam \d+ ambientes para fotografar/i)).toBeInTheDocument();
    });
  });

  it('renders a timeline built from real photo timestamps and the real schedule', async () => {
    renderWithProviders(<Detail />);

    await waitFor(() => {
      expect(screen.getByText('TIMELINE')).toBeInTheDocument();
      expect(screen.getByText(/Vistoria agendada para 15 ago/)).toBeInTheDocument();
      expect(screen.getByText('Foto adicionada')).toBeInTheDocument();
    });
  });

  it('navigates back to /requests when back button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Detail />);

    await waitFor(() => expect(screen.getByText('SOL-1042')).toBeInTheDocument());
    const backButton = screen.getByRole('button', { name: /voltar/i });
    await user.click(backButton);

    expect(currentPath()).toBe('/requests');
  });

  it('navigates back to /requests when empty state back button is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Detail />, '9999');

    await waitFor(() => screen.getByRole('button', { name: /voltar para solicitações/i }));
    const backButton = screen.getByRole('button', { name: /voltar para solicitações/i });
    await user.click(backButton);

    expect(currentPath()).toBe('/requests');
  });

  it('renders hidden file inputs for each environment', async () => {
    renderWithProviders(<Detail />);

    await waitFor(() => {
      const fileInputs = document.querySelectorAll('input[type="file"]');
      expect(fileInputs.length).toBe(8);
      fileInputs.forEach((input) => {
        const fileInput = input as HTMLInputElement;
        expect(fileInput.type).toBe('file');
        expect(fileInput.accept).toBe('image/*');
        expect(fileInput.style.display).toBe('none');
      });
    });
  });

  it('shows photo grid when photos exist this session', async () => {
    useAppStore.setState({
      inspectionPhotos: { 'SOL-1042-sala': ['photo1', 'photo2', 'photo3'] },
    });

    renderWithProviders(<Detail />);

    await waitFor(() => {
      const photoItems = screen.queryAllByText('▣');
      expect(photoItems.length).toBeGreaterThan(0);
    });
  });

  it('renders back button in header', async () => {
    renderWithProviders(<Detail />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /voltar/i })).toBeInTheDocument();
    });
  });
});
