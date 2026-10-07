import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Login } from '../../../pages/login/Login';
import { useAppStore } from '../../../store/useAppStore';
import * as client from '../../../api/client';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

function renderLogin(initialEntries: Array<string | { pathname: string; state?: { notice?: string } }> = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path="/login" element={<><Login /><LocationProbe /></>} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Mock the API client
vi.mock('../../../api/client', () => ({
  apiClient: {
    login: vi.fn(),
    me: vi.fn(),
  },
  decodeToken: vi.fn(),
  tenantIdsFromToken: vi.fn(() => []),
  mapPerfilToRole: vi.fn(),
}));

// Mock the roleMapper utility
vi.mock('../../../utils/roleMapper', () => ({
  mapPerfilToRole: vi.fn((perfil) => {
    if (perfil === 'admin') return 'admin';
    if (perfil === 'vistoriador') return 'vistoriador';
    return 'corretor';
  }),
}));

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      auth: {
        accessToken: null,
        userEmail: null,
        userId: null,
        perfil: null,
        imobiliariaId: null,
        loginError: null,
      },
      role: 'corretor',
      toastMessage: null,
      theme: 'light',
    });
  });

  it('should render login form with email and password inputs', () => {
    renderLogin();

    expect(screen.getByText('Bem-vindo')).toBeInTheDocument();
    expect(screen.getByText('Faça login com sua conta para continuar')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Senha')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /entrar/i })).toBeInTheDocument();
  });

  it('shows a notice passed from another screen after password reset', () => {
    renderLogin([{ pathname: '/login', state: { notice: 'Senha redefinida com sucesso — faça login com a nova senha' } }]);

    expect(screen.getByRole('status')).toHaveTextContent(
      'Senha redefinida com sucesso — faça login com a nova senha',
    );
  });

  it('should render Inspecta Vistorias logo', () => {
    renderLogin();

    const logo = screen.getByAltText('Inspecta Vistorias');
    expect(logo).toBeInTheDocument();
  });

  it('should render page title and subtitle', () => {
    renderLogin();

    expect(screen.getByText('Clareza em cada vistoria')).toBeInTheDocument();
    expect(screen.getByText(/O Inspecta Vistorias oferece/i)).toBeInTheDocument();
  });

  it('should update email input when user types', async () => {
    const user = userEvent.setup();
    renderLogin();

    const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
    await user.type(emailInput, 'test@example.com');

    expect(emailInput.value).toBe('test@example.com');
  });

  it('should update password input when user types', async () => {
    const user = userEvent.setup();
    renderLogin();

    const passwordInput = screen.getByLabelText('Senha') as HTMLInputElement;
    await user.type(passwordInput, 'password123');

    expect(passwordInput.value).toBe('password123');
  });

  it('should call login API with email and password on form submit', async () => {
    const mockLogin = vi.mocked(client.apiClient.login).mockResolvedValue({
      accessToken: 'mock-token-123',
      expiresInSeconds: 3600,
    });

    const mockDecodeToken = vi.mocked(client.decodeToken).mockReturnValue({
      sub: 'user-123',
      perfil: 'corretor',
      imobiliaria_id: '42',
      iat: 0,
      exp: 0,
    });

    const user = userEvent.setup();
    renderLogin();

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      expect(mockDecodeToken).toHaveBeenCalledWith('mock-token-123');
    });
  });

  it('should set auth state on successful login', async () => {
    vi.mocked(client.apiClient.login).mockResolvedValue({
      accessToken: 'mock-token-123',
      expiresInSeconds: 3600,
    });

    vi.mocked(client.decodeToken).mockReturnValue({
      sub: 'user-123',
      perfil: 'corretor',
      imobiliaria_id: '42',
      iat: 0,
      exp: 0,
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Senha'), 'password123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.auth.userEmail).toBe('test@example.com');
      expect(state.auth.userId).toBe('user-123');
      expect(state.auth.accessToken).toBe('mock-token-123');
    });
  });

  it('merges the real name/email from /me after a successful login', async () => {
    vi.mocked(client.apiClient.login).mockResolvedValue({
      accessToken: 'mock-token-123',
      expiresInSeconds: 3600,
    });
    vi.mocked(client.decodeToken).mockReturnValue({
      sub: 'user-123',
      perfil: 'corretor',
      imobiliaria_id: '42',
      iat: 0,
      exp: 0,
    });
    vi.mocked(client.apiClient.me).mockResolvedValue({
      id: '123',
      nome: 'Fulana de Tal',
      email: 'fulana.real@inspecta.com.br',
      perfil: 'corretor',
      status: 'ativo',
      imobiliariaId: '42',
      criadoEm: '2026-01-01T00:00:00Z',
      tema: 'dark',
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'typed@example.com');
    await user.type(screen.getByLabelText('Senha'), 'password123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      const state = useAppStore.getState();
      expect(state.auth.userName).toBe('Fulana de Tal');
      expect(state.auth.userEmail).toBe('fulana.real@inspecta.com.br');
      expect(state.theme).toBe('dark');
    });
  });

  it('still logs in when /me fails', async () => {
    vi.mocked(client.apiClient.login).mockResolvedValue({
      accessToken: 'mock-token-123',
      expiresInSeconds: 3600,
    });
    vi.mocked(client.decodeToken).mockReturnValue({
      sub: 'user-123',
      perfil: 'corretor',
      imobiliaria_id: '42',
      iat: 0,
      exp: 0,
    });
    vi.mocked(client.apiClient.me).mockRejectedValue(new Error('boom'));

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'typed@example.com');
    await user.type(screen.getByLabelText('Senha'), 'password123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      const state = useAppStore.getState();
      expect(currentPath()).toBe('/dashboard');
      expect(state.auth.userEmail).toBe('typed@example.com');
    });
  });

  it('should navigate to dashboard on successful login', async () => {
    vi.mocked(client.apiClient.login).mockResolvedValue({
      accessToken: 'mock-token-123',
      expiresInSeconds: 3600,
    });

    vi.mocked(client.decodeToken).mockReturnValue({
      sub: 'user-123',
      perfil: 'corretor',
      imobiliaria_id: '42',
      iat: 0,
      exp: 0,
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Senha'), 'password123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(currentPath()).toBe('/dashboard');
    });
  });

  it('should show loading state while submitting', async () => {
    let resolveLogin: any;
    const loginPromise = new Promise<any>((resolve) => {
      resolveLogin = resolve;
    });

    vi.spyOn(client.apiClient, 'login').mockReturnValue(loginPromise as any);

    vi.mocked(client.decodeToken).mockReturnValue({
      sub: 'user-123',
      perfil: 'corretor',
      imobiliaria_id: '42',
      iat: 0,
      exp: 0,
    });

    const user = userEvent.setup();
    renderLogin();

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Senha');
    const submitButton = screen.getByRole('button', { name: /entrar/i });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);

    expect(screen.getByRole('button', { name: /entrando/i })).toBeInTheDocument();

    resolveLogin({ accessToken: 'mock-token-123', expiresInSeconds: 3600 });
  });

  it('should display the backend generic credential-error message as-is on 401 login failure', async () => {
    // O backend já colapsa email-inexistente e senha-errada na mesma mensagem genérica
    // ("Credencial invalida") — o front não deve reinterpretar ou reescrever isso.
    vi.mocked(client.apiClient.login).mockRejectedValue(new Error('Credencial invalida'));

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Senha'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText('Credencial invalida')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('shows a link to the forgot-password flow and navigates to it', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: /esqueci minha senha/i }));

    expect(currentPath()).toBe('/forgot-password');
  });

  it('should display a generic error message when login fails for an unexpected reason', async () => {
    vi.spyOn(client.apiClient, 'login').mockRejectedValue(
      new Error('Não foi possível completar a solicitação (500).')
    );

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Senha'), 'password');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText('Não foi possível completar a solicitação (500).')).toBeInTheDocument();
    });
  });

  it('should display generic error message on other API failures', async () => {
    vi.mocked(client.apiClient.login).mockRejectedValue(
      new Error('Network error')
    );

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Senha'), 'password');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('should render error from auth state if present', () => {
    useAppStore.setState({
      auth: {
        accessToken: null,
        userEmail: null,
        userId: null,
        perfil: null,
        imobiliariaId: null,
        loginError: 'Invalid credentials',
      },
    });

    renderLogin();

    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('should have a working support link instead of a dead recovery link', () => {
    renderLogin();

    const supportLink = screen.getByText('Fale com o suporte');
    expect(supportLink).toBeInTheDocument();
    expect(supportLink.closest('a')).toHaveAttribute('href', 'mailto:suporte@inspecta.local');
  });

  it('should disable button while loading', async () => {
    let resolveLogin: any;
    const loginPromise = new Promise<any>((resolve) => {
      resolveLogin = resolve;
    });

    vi.spyOn(client.apiClient, 'login').mockReturnValue(loginPromise as any);

    vi.mocked(client.decodeToken).mockReturnValue({
      sub: 'user-123',
      perfil: 'corretor',
      imobiliaria_id: '42',
      iat: 0,
      exp: 0,
    });

    const user = userEvent.setup();
    renderLogin();

    const submitButton = screen.getByRole('button', { name: /entrar/i });

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Senha'), 'password123');
    await user.click(submitButton);

    const loadingButton = await screen.findByRole('button', { name: /entrando/i });
    expect(loadingButton).toBeDisabled();

    // Solta a promise para o componente não ficar pendurado depois do teste.
    resolveLogin({ accessToken: 'mock-token-123', expiresInSeconds: 3600 });
  });

  it('should clear login error on new login attempt', async () => {
    useAppStore.setState({
      auth: {
        accessToken: null,
        userEmail: null,
        userId: null,
        perfil: null,
        imobiliariaId: null,
        loginError: 'Previous error',
      },
    });

    vi.mocked(client.apiClient.login).mockResolvedValue({
      accessToken: 'mock-token-123',
      expiresInSeconds: 3600,
    });

    vi.mocked(client.decodeToken).mockReturnValue({
      sub: 'user-123',
      perfil: 'corretor',
      imobiliaria_id: '42',
      iat: 0,
      exp: 0,
    });

    const user = userEvent.setup();
    renderLogin();

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Senha'), 'password123');
    await user.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(useAppStore.getState().auth.loginError).toBeNull();
    });
  });
});
