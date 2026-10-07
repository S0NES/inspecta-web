import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Profile } from '../../../pages/profile/Profile';
import { useAppStore } from '../../../store/useAppStore';
import { useMe } from '../../../api/usuarios';
import * as client from '../../../api/client';

vi.mock('../../../api/usuarios', () => ({
  useMe: vi.fn(() => ({ data: undefined })),
}));

vi.mock('../../../api/client', () => ({
  apiClient: {
    esqueciSenha: vi.fn(),
    redefinirSenha: vi.fn(),
    logout: vi.fn(),
  },
}));

const mockUseMe = vi.mocked(useMe);

function LocationProbe() {
  const loc = useLocation();
  const notice = (loc.state as { notice?: string } | null)?.notice ?? '';
  return <div data-testid="loc" data-pathname={loc.pathname} data-notice={notice} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/profile']}>
      <Routes>
        <Route path="/profile" element={<><Profile /><LocationProbe /></>} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(client.apiClient.esqueciSenha).mockResolvedValue(undefined);
  vi.mocked(client.apiClient.redefinirSenha).mockResolvedValue(undefined);
  vi.mocked(client.apiClient.logout).mockResolvedValue(undefined);
  mockUseMe.mockReturnValue({ data: undefined } as ReturnType<typeof useMe>);
  useAppStore.setState({
    auth: {
      accessToken: 'token',
      userEmail: 'ana.souza@inspecta.com.br',
      userId: '2',
      perfil: 'imob_gerencia',
      imobiliariaId: '1',
      loginError: null,
    },
    toastMessage: null,
  });
});

afterEach(() => {
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

describe('Profile', () => {
  it('renders page header with title and subtitle', () => {
    renderProfile();

    expect(screen.getByText('Meu perfil')).toBeInTheDocument();
    expect(screen.getByText('Dados da sua conta')).toBeInTheDocument();
  });

  it('shows the name derived from the email and the translated perfil', () => {
    renderProfile();

    expect(screen.getByText('ana souza')).toBeInTheDocument();
    expect(screen.getByText('ana.souza@inspecta.com.br')).toBeInTheDocument();
    expect(screen.getByText('Gerência')).toBeInTheDocument();
  });

  it('renders the real nome/email/perfil from the /me query', () => {
    mockUseMe.mockReturnValue({
      data: {
        id: '2',
        nome: 'Ana Carolina Souza',
        email: 'ana.real@inspecta.com.br',
        perfil: 'admin',
        status: 'ativo',
        imobiliariaId: '1',
        criadoEm: '2026-01-01T00:00:00Z',
      },
    } as ReturnType<typeof useMe>);
    renderProfile();

    expect(screen.getByText('Ana Carolina Souza')).toBeInTheDocument();
    expect(screen.getByText('ana.real@inspecta.com.br')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
  });

  it('keeps working when the /me query errors (falls back to store values)', () => {
    mockUseMe.mockReturnValue({ data: undefined, isError: true } as ReturnType<typeof useMe>);
    renderProfile();

    expect(screen.getByText('ana souza')).toBeInTheDocument();
    expect(screen.getByText('ana.souza@inspecta.com.br')).toBeInTheDocument();
  });

  it('falls back to a neutral state without an authenticated user', () => {
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
    renderProfile();

    expect(screen.getByText('Usuário')).toBeInTheDocument();
  });

  it('navigates back to the dashboard when "Voltar" is clicked', async () => {
    const user = userEvent.setup();
    renderProfile();

    await user.click(screen.getByRole('button', { name: 'Voltar' }));

    expect(currentPath()).toBe('/dashboard');
  });

  it('shows a password reset action', () => {
    renderProfile();

    expect(screen.getByRole('button', { name: 'Redefinir senha' })).toBeEnabled();
  });

  it('disables password reset when the account has no email', () => {
    useAppStore.setState({
      auth: {
        accessToken: 'token',
        userEmail: null,
        userId: '2',
        perfil: 'imob_gerencia',
        imobiliariaId: '1',
        loginError: null,
      },
    });
    renderProfile();

    expect(screen.getByRole('button', { name: 'Redefinir senha' })).toBeDisabled();
  });

  async function abrirDialogReset(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Redefinir senha' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Redefinir senha' })).toBeInTheDocument();
    return dialog;
  }

  it('sends a reset code to the account email and opens the dialog', async () => {
    const user = userEvent.setup();
    renderProfile();

    const dialog = await abrirDialogReset(user);

    expect(client.apiClient.esqueciSenha).toHaveBeenCalledWith('ana.souza@inspecta.com.br');
    expect(within(dialog).getByText(/ana.souza@inspecta.com.br/)).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Código de verificação')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Nova senha')).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Confirmar nova senha')).toBeInTheDocument();
  });

  it('opens the dialog even if sending the code fails', async () => {
    vi.mocked(client.apiClient.esqueciSenha).mockRejectedValue(new Error('network error'));
    const user = userEvent.setup();
    renderProfile();

    await abrirDialogReset(user);

    expect(client.apiClient.esqueciSenha).toHaveBeenCalled();
  });

  it('rejects a weak password without calling the API', async () => {
    const user = userEvent.setup();
    renderProfile();
    const dialog = await abrirDialogReset(user);

    await user.type(within(dialog).getByLabelText('Código de verificação'), '123456');
    await user.type(within(dialog).getByLabelText('Nova senha'), 'abc');
    await user.type(within(dialog).getByLabelText('Confirmar nova senha'), 'abc');
    await user.click(within(dialog).getByRole('button', { name: 'Redefinir senha' }));

    expect(screen.getByText('A senha não atende aos requisitos abaixo')).toBeInTheDocument();
    expect(client.apiClient.redefinirSenha).not.toHaveBeenCalled();
  });

  it('rejects mismatched password confirmation without calling the API', async () => {
    const user = userEvent.setup();
    renderProfile();
    const dialog = await abrirDialogReset(user);

    await user.type(within(dialog).getByLabelText('Código de verificação'), '123456');
    await user.type(within(dialog).getByLabelText('Nova senha'), 'Senha#Forte1');
    await user.type(within(dialog).getByLabelText('Confirmar nova senha'), 'Senha#Forte2');
    await user.click(within(dialog).getByRole('button', { name: 'Redefinir senha' }));

    expect(screen.getByText('As senhas não coincidem')).toBeInTheDocument();
    expect(client.apiClient.redefinirSenha).not.toHaveBeenCalled();
  });

  it('submits the new password, logs out and returns to login', async () => {
    const user = userEvent.setup();
    renderProfile();
    const dialog = await abrirDialogReset(user);

    await user.type(within(dialog).getByLabelText('Código de verificação'), '123456');
    await user.type(within(dialog).getByLabelText('Nova senha'), 'Senha#Forte1');
    await user.type(within(dialog).getByLabelText('Confirmar nova senha'), 'Senha#Forte1');
    await user.click(within(dialog).getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => {
      expect(client.apiClient.redefinirSenha).toHaveBeenCalledWith(
        'ana.souza@inspecta.com.br',
        '123456',
        'Senha#Forte1',
      );
    });
    expect(client.apiClient.logout).toHaveBeenCalled();
    await waitFor(() => expect(currentPath()).toBe('/login'));
    expect(screen.getByTestId('loc').getAttribute('data-notice')).toBe(
      'Senha redefinida com sucesso — faça login com a nova senha',
    );
    expect(useAppStore.getState().auth.accessToken).toBeNull();
  });

  it('keeps the dialog open if the user tries to dismiss it while saving', async () => {
    let finish!: () => void;
    vi.mocked(client.apiClient.redefinirSenha).mockImplementation(
      () => new Promise<void>((resolve) => { finish = resolve; }),
    );
    const user = userEvent.setup();
    renderProfile();
    const dialog = await abrirDialogReset(user);

    await user.type(within(dialog).getByLabelText('Código de verificação'), '123456');
    await user.type(within(dialog).getByLabelText('Nova senha'), 'Senha#Forte1');
    await user.type(within(dialog).getByLabelText('Confirmar nova senha'), 'Senha#Forte1');
    await user.click(within(dialog).getByRole('button', { name: 'Redefinir senha' }));

    await waitFor(() => expect(client.apiClient.redefinirSenha).toHaveBeenCalled());
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    finish();
  });

  it('resends the verification code without closing the dialog', async () => {
    const user = userEvent.setup();
    renderProfile();
    const dialog = await abrirDialogReset(user);
    vi.mocked(client.apiClient.esqueciSenha).mockClear();

    await user.click(within(dialog).getByRole('button', { name: 'Reenviar código' }));

    await waitFor(() => {
      expect(client.apiClient.esqueciSenha).toHaveBeenCalledWith('ana.souza@inspecta.com.br');
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
