import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ForgotPassword } from '../../../pages/forgotPassword/ForgotPassword';
import { useAppStore } from '../../../store/useAppStore';
import * as client from '../../../api/client';

vi.mock('../../../api/client', () => ({
  apiClient: {
    esqueciSenha: vi.fn(),
    redefinirSenha: vi.fn(),
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

function renderForgot() {
  return render(
    <MemoryRouter initialEntries={['/forgot-password']}>
      <Routes>
        <Route path="/forgot-password" element={<><ForgotPassword /><LocationProbe /></>} />
        <Route path="/login" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ForgotPassword', () => {
  it('renders the email step first', () => {
    renderForgot();

    expect(screen.getByText('Esqueci minha senha')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.queryByLabelText('Código de verificação')).not.toBeInTheDocument();
  });

  it('requests a code and advances to the code step regardless of whether the email exists', async () => {
    vi.mocked(client.apiClient.esqueciSenha).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForgot();

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /enviar código/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Redefinir senha' })).toBeInTheDocument();
    });
    expect(client.apiClient.esqueciSenha).toHaveBeenCalledWith('user@example.com');
  });

  it('advances to the code step even if the request fails (never reveals whether the email exists)', async () => {
    vi.mocked(client.apiClient.esqueciSenha).mockRejectedValue(new Error('network error'));
    const user = userEvent.setup();
    renderForgot();

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /enviar código/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Redefinir senha' })).toBeInTheDocument();
    });
  });

  async function avancarParaCodigo(user: ReturnType<typeof userEvent.setup>) {
    vi.mocked(client.apiClient.esqueciSenha).mockResolvedValue(undefined);
    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: /enviar código/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Redefinir senha' })).toBeInTheDocument());
  }

  it('shows all password rules and marks them as met while typing a strong password', async () => {
    const user = userEvent.setup();
    renderForgot();
    await avancarParaCodigo(user);

    expect(screen.getByText('Entre 5 e 50 caracteres')).toBeInTheDocument();
    expect(screen.getByText('Uma letra maiúscula')).toBeInTheDocument();
    expect(screen.getByText('Uma letra minúscula')).toBeInTheDocument();
    expect(screen.getByText('Um caractere especial')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Nova senha'), 'Senha#Forte1');

    const okRules = document.querySelectorAll('.password-rule--ok');
    expect(okRules.length).toBe(4);
  });

  it('rejects a weak password without calling the API', async () => {
    const user = userEvent.setup();
    renderForgot();
    await avancarParaCodigo(user);

    await user.type(screen.getByLabelText('Código de verificação'), '123456');
    await user.type(screen.getByLabelText('Nova senha'), 'abc');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'abc');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    expect(screen.getByText('A senha não atende aos requisitos abaixo')).toBeInTheDocument();
    expect(client.apiClient.redefinirSenha).not.toHaveBeenCalled();
  });

  it('rejects mismatched password confirmation without calling the API', async () => {
    const user = userEvent.setup();
    renderForgot();
    await avancarParaCodigo(user);

    await user.type(screen.getByLabelText('Código de verificação'), '123456');
    await user.type(screen.getByLabelText('Nova senha'), 'Senha#Forte1');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'Senha#Forte2');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    expect(screen.getByText('As senhas não coincidem')).toBeInTheDocument();
    expect(client.apiClient.redefinirSenha).not.toHaveBeenCalled();
  });

  it('submits the code and strong password, then returns to login on success', async () => {
    vi.mocked(client.apiClient.redefinirSenha).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderForgot();
    await avancarParaCodigo(user);

    await user.type(screen.getByLabelText('Código de verificação'), '123456');
    await user.type(screen.getByLabelText('Nova senha'), 'Senha#Forte1');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'Senha#Forte1');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(client.apiClient.redefinirSenha).toHaveBeenCalledWith(
        'user@example.com',
        '123456',
        'Senha#Forte1'
      );
    });
    await waitFor(() => expect(currentPath()).toBe('/login'));
  });

  it('shows the generic credential error from the backend on an invalid or expired code', async () => {
    vi.mocked(client.apiClient.redefinirSenha).mockRejectedValue(new Error('Credencial invalida'));
    const user = userEvent.setup();
    renderForgot();
    await avancarParaCodigo(user);

    await user.type(screen.getByLabelText('Código de verificação'), '000000');
    await user.type(screen.getByLabelText('Nova senha'), 'Senha#Forte1');
    await user.type(screen.getByLabelText('Confirmar nova senha'), 'Senha#Forte1');
    await user.click(screen.getByRole('button', { name: /redefinir senha/i }));

    await waitFor(() => {
      expect(screen.getByText('Credencial invalida')).toBeInTheDocument();
    });
  });

  it('navigates back to login from the email step', async () => {
    const user = userEvent.setup();
    renderForgot();

    await user.click(screen.getByRole('button', { name: /voltar para o login/i }));

    expect(currentPath()).toBe('/login');
  });
});
