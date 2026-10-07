import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Convite } from '../../../pages/convite/Convite';
import { useAppStore } from '../../../store/useAppStore';
import * as client from '../../../api/client';

vi.mock('../../../api/client', () => ({
  apiClient: {
    aceitarConvite: vi.fn(),
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState({ toastMessage: null });
});

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

function renderConvite(token: string | null = 'tok-abc') {
  const entry = token == null ? '/convite' : `/convite?token=${token}`;
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/convite" element={<><Convite /><LocationProbe /></>} />
        <Route path="/login" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

const SENHA_FORTE = 'Senha#Forte1';

async function preencher(user: ReturnType<typeof userEvent.setup>, senha: string, confirmar = senha) {
  await user.type(screen.getByLabelText('Nome completo'), 'Fulana de Tal');
  await user.type(screen.getByLabelText('Senha'), senha);
  await user.type(screen.getByLabelText('Confirmar senha'), confirmar);
  await user.click(screen.getByRole('button', { name: /ativar conta/i }));
}

describe('Convite', () => {
  it('renders the invite form', () => {
    renderConvite();
    expect(screen.getByRole('heading', { name: 'Aceitar convite' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nome completo')).toBeInTheDocument();
  });

  it('accepts the invite with a strong password and returns to login', async () => {
    vi.mocked(client.apiClient.aceitarConvite).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderConvite();

    await preencher(user, SENHA_FORTE);

    await waitFor(() => {
      expect(client.apiClient.aceitarConvite).toHaveBeenCalledWith('tok-abc', SENHA_FORTE, 'Fulana de Tal');
    });
    await waitFor(() => expect(currentPath()).toBe('/login'));
  });

  it('shows an error and does not call the API for a weak password', async () => {
    const user = userEvent.setup();
    renderConvite();

    await preencher(user, 'abc');

    expect(screen.getByText('A senha não atende aos requisitos abaixo')).toBeInTheDocument();
    expect(client.apiClient.aceitarConvite).not.toHaveBeenCalled();
  });

  it('shows a generic error when the backend rejects the token', async () => {
    vi.mocked(client.apiClient.aceitarConvite).mockRejectedValue(new Error('Convite invalido'));
    const user = userEvent.setup();
    renderConvite();

    await preencher(user, SENHA_FORTE);

    await waitFor(() => {
      expect(screen.getByText('Convite inválido ou expirado')).toBeInTheDocument();
    });
    expect(currentPath()).toBe('/convite');
  });

  it('rejects a mismatched confirmation without calling the API', async () => {
    const user = userEvent.setup();
    renderConvite();

    await preencher(user, SENHA_FORTE, 'Senha#Forte2');

    expect(screen.getByText('As senhas não coincidem')).toBeInTheDocument();
    expect(client.apiClient.aceitarConvite).not.toHaveBeenCalled();
  });

  it('errors when there is no invite token in the URL', async () => {
    const user = userEvent.setup();
    renderConvite(null);

    await preencher(user, SENHA_FORTE);

    expect(screen.getByText('Convite inválido ou expirado')).toBeInTheDocument();
    expect(client.apiClient.aceitarConvite).not.toHaveBeenCalled();
  });
});
