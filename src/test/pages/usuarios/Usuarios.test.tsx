import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Usuarios } from '../../../pages/usuarios/Usuarios';
import { useAppStore } from '../../../store/useAppStore';

const BASE_URL = 'http://localhost:8080';

const mockUsuariosData = {
  content: [
    { id: '1', nome: 'João Silva', email: 'joao@example.com', perfil: 'admin', status: 'ativo', imobiliariaId: null, senhaDefinida: true, criadoEm: '2026-01-01T00:00:00Z' },
    { id: '2', nome: 'Maria Santos', email: 'maria@example.com', perfil: 'imob_gerencia', status: 'convidado', imobiliariaId: '1', senhaDefinida: false, criadoEm: '2026-01-02T00:00:00Z' },
    { id: '3', nome: 'Carlos Oliveira', email: 'carlos@example.com', perfil: 'imob_operacao', status: 'inativo', imobiliariaId: '1', senhaDefinida: true, criadoEm: '2026-01-03T00:00:00Z' },
  ],
  totalElements: 3,
  totalPages: 1,
  size: 20,
  number: 0,
};

const pageUsuarios = (request: Request, source = mockUsuariosData.content) => {
  const url = new URL(request.url);
  const page = Number(url.searchParams.get('page') ?? 0);
  const size = Number(url.searchParams.get('size') ?? 20);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const perfil = url.searchParams.get('perfil');
  const status = url.searchParams.get('status');
  let rows = source;
  if (q) rows = rows.filter((u) => u.nome.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));
  if (perfil) rows = rows.filter((u) => u.perfil === perfil);
  if (status) rows = rows.filter((u) => u.status === status);
  const start = page * size;
  return HttpResponse.json({
    content: rows.slice(start, start + size),
    totalElements: rows.length,
    totalPages: Math.ceil(rows.length / size) || 0,
    size,
    number: page,
  });
};

const mockImobiliariasData = {
  content: [{ id: '1', razaoSocial: 'Imobiliária XYZ', nomeFantasia: 'XYZ Imóveis', cnpj: '11.222.333/0001-81', ativa: true }],
  totalElements: 1,
  totalPages: 1,
  size: 50,
  number: 0,
};

const server = setupServer(
  http.get(`${BASE_URL}/v1/usuarios`, ({ request }) => pageUsuarios(request)),
  http.get(`${BASE_URL}/v1/imobiliarias`, () => HttpResponse.json(mockImobiliariasData)),
  http.post(`${BASE_URL}/v1/usuarios`, () => new HttpResponse(null, { status: 202 })),
  http.post(`${BASE_URL}/v1/usuarios/:id/reenviar-convite`, () => new HttpResponse(null, { status: 202 })),
  http.patch(`${BASE_URL}/v1/usuarios/:id`, () => new HttpResponse(null, { status: 204 })),
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

const asPerfil = (perfil: string, userId = '99') =>
  useAppStore.setState({
    auth: {
      accessToken: 'token',
      userEmail: `${perfil}@example.com`,
      userName: null,
      userId,
      perfil,
      imobiliariaId: null,
      loginError: null,
    } as any,
  });

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/usuarios']}>
        <Usuarios />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Usuarios — ADMIN/SUPORTE (veem tudo, criam tudo)', () => {
  beforeEach(() => asPerfil('admin'));

  it('renders the title and lists users of every perfil', async () => {
    renderPage();

    expect(screen.getByRole('heading', { name: 'Usuários' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.getByText('Carlos Oliveira')).toBeInTheDocument();
    });
  });

  it('shows the "Convidar usuário" action and offers every invitable perfil', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /convidar usuário/i }));
    const perfil = screen.getByLabelText('Perfil');
    const options = Array.from(perfil.querySelectorAll('option')).map((o) => o.textContent);

    expect(options).toEqual(['Administrador', 'Suporte', 'Gerência', 'Operação', 'Vistoriador']);
  });

  it('sends an invite with the chosen profile', async () => {
    const user = userEvent.setup();
    let capturedBody: any;
    server.use(
      http.post(`${BASE_URL}/v1/usuarios`, async ({ request }) => {
        capturedBody = await request.json();
        return new HttpResponse(null, { status: 202 });
      }),
    );

    renderPage();
    await user.click(screen.getByRole('button', { name: /convidar usuário/i }));
    await user.type(screen.getByLabelText('Nome'), 'Novo Suporte');
    await user.type(screen.getByLabelText('E-mail'), 'suporte@exemplo.com');
    await user.selectOptions(screen.getByLabelText('Perfil'), 'suporte');
    await user.click(screen.getByRole('button', { name: /^enviar convite$/i }));

    await waitFor(() => expect(useAppStore.getState().toastMessage).toBe('Convite enviado para suporte@exemplo.com'));
    expect(capturedBody).toEqual({ nome: 'Novo Suporte', email: 'suporte@exemplo.com', perfil: 'suporte' });
  });

  it('renders perfil and status as chips, never as row controls', async () => {
    renderPage();

    await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());

    expect(screen.queryByLabelText(/^perfil de/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reenviar convite/i })).not.toBeInTheDocument();

    const maria = screen.getByText('Maria Santos').closest('.sysu-row') as HTMLElement;
    const joao = screen.getByText('João Silva').closest('.sysu-row') as HTMLElement;
    const carlos = screen.getByText('Carlos Oliveira').closest('.sysu-row') as HTMLElement;
    expect(within(maria).getByText('Convidado')).toBeInTheDocument();
    expect(within(joao).getByText('Ativo')).toBeInTheDocument();
    expect(within(carlos).getByText('Inativo')).toBeInTheDocument();
  });

  it('opens the edit modal from the row menu with e-mail disabled', async () => {
    const user = userEvent.setup();
    let captured: { id?: string; body?: Record<string, unknown> } = {};
    server.use(
      http.patch(`${BASE_URL}/v1/usuarios/:id`, async ({ params, request }) => {
        captured = { id: String(params.id), body: (await request.json()) as Record<string, unknown> };
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Ações de João Silva' }));
    await user.click(screen.getByRole('menuitem', { name: /^editar$/i }));

    const email = screen.getByLabelText('E-mail') as HTMLInputElement;
    expect(email).toHaveAttribute('readOnly');
    expect(email).not.toBeDisabled();
    expect(email.value).toBe('joao@example.com');

    await user.click(screen.getByRole('button', { name: /^salvar$/i }));
    await waitFor(() => expect(captured.id).toBe('1'));
    expect(captured.body).toMatchObject({ nome: 'João Silva', perfil: 'admin' });
  });

  it('offers resend and delete-invite in the invited user menu, not on the status chip', async () => {
    const user = userEvent.setup();
    let resent = false;
    let deleted: { id?: string; body?: Record<string, unknown> } = {};
    server.use(
      http.post(`${BASE_URL}/v1/usuarios/:id/reenviar-convite`, () => {
        resent = true;
        return new HttpResponse(null, { status: 202 });
      }),
      http.patch(`${BASE_URL}/v1/usuarios/:id`, async ({ params, request }) => {
        deleted = { id: String(params.id), body: (await request.json()) as Record<string, unknown> };
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText('Maria Santos')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Ações de Maria Santos' }));
    expect(screen.getByRole('menuitem', { name: /^editar$/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /reenviar convite/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /excluir convite/i })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: /reenviar convite/i }));
    await waitFor(() =>
      expect(useAppStore.getState().toastMessage).toBe('Convite reenviado para maria@example.com'),
    );
    expect(resent).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Ações de Maria Santos' }));
    await user.click(screen.getByRole('menuitem', { name: /excluir convite/i }));
    expect(deleted.id).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /^excluir convite$/i }));
    await waitFor(() => expect(deleted.id).toBe('2'));
    expect(deleted.body).toEqual({ status: 'inativo' });
    expect(useAppStore.getState().toastMessage).toBe('Convite excluído');
  });

  it('does not offer Reativar for an inactive user who never set a password', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${BASE_URL}/v1/usuarios`, () =>
        HttpResponse.json({
          ...mockUsuariosData,
          content: [
            {
              id: '4',
              nome: 'Ana Lima',
              email: 'ana@example.com',
              perfil: 'suporte',
              status: 'inativo',
              imobiliariaId: null,
              senhaDefinida: false,
              criadoEm: '2026-01-04T00:00:00Z',
            },
          ],
        }),
      ),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText('Ana Lima')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Ações de Ana Lima' }));
    expect(screen.queryByRole('menuitem', { name: /reativar usuário/i })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /reenviar convite/i })).toBeInTheDocument();
  });

  it('requires an agency when editing a user into Gerência', async () => {
    const user = userEvent.setup();
    let captured: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${BASE_URL}/v1/usuarios/:id`, async ({ request }) => {
        captured = (await request.json()) as Record<string, unknown>;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Ações de João Silva' }));
    await user.click(screen.getByRole('menuitem', { name: /^editar$/i }));
    await user.selectOptions(screen.getByLabelText('Perfil'), 'imob_gerencia');
    await user.click(screen.getByRole('button', { name: /^salvar$/i }));

    await waitFor(() => expect(useAppStore.getState().toastMessage).toBe('Selecione a imobiliária do usuário'));
    expect(captured).toBeUndefined();

    await user.selectOptions(screen.getByLabelText('Imobiliária'), '1');
    await user.click(screen.getByRole('button', { name: /^salvar$/i }));
    await waitFor(() => expect(captured).toMatchObject({
      nome: 'João Silva',
      perfil: 'imob_gerencia',
      imobiliariaId: '1',
    }));
  });

  it('keeps the search field inside the filter modal, next to invite in the header', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());

    const headerActions = screen.getByRole('button', { name: /^filtros/i }).closest('.sysu-header-actions');
    expect(headerActions).toContainElement(screen.getByRole('button', { name: /convidar usuário/i }));
    expect(screen.queryByLabelText('Nome ou e-mail')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^filtros/i }));
    await user.type(await screen.findByLabelText('Nome ou e-mail'), 'maria');

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
      expect(screen.queryByText('Carlos Oliveira')).not.toBeInTheDocument();
    });
  });

  it('filters the list by perfil', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /^filtros/i }));
    await user.selectOptions(await screen.findByLabelText('Filtrar por perfil'), 'Gerência');

    await waitFor(() => {
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.queryByText('João Silva')).not.toBeInTheDocument();
      expect(screen.queryByText('Carlos Oliveira')).not.toBeInTheDocument();
    });
  });

  it('asks GET /v1/usuarios for the next page instead of slicing locally', async () => {
    const user = userEvent.setup();
    const seen: string[] = [];
    const page1 = {
      id: 'p1', nome: 'Ana Página 1', email: 'ana@example.com', perfil: 'admin',
      status: 'ativo', imobiliariaId: null, senhaDefinida: true, criadoEm: '2026-01-01T00:00:00Z',
    };
    const page2 = {
      id: 'p2', nome: 'Beto Página 2', email: 'beto@example.com', perfil: 'suporte',
      status: 'ativo', imobiliariaId: null, senhaDefinida: true, criadoEm: '2026-01-02T00:00:00Z',
    };
    server.use(
      http.get(`${BASE_URL}/v1/usuarios`, ({ request }) => {
        const url = new URL(request.url);
        const page = url.searchParams.get('page');
        const size = url.searchParams.get('size');
        seen.push(`${page}:${size}`);
        const row = page === '1' ? page2 : page1;
        return HttpResponse.json({
          content: [row],
          totalElements: 21,
          totalPages: 2,
          size: Number(size),
          number: Number(page),
        });
      }),
    );

    renderPage();
    await waitFor(() => expect(screen.getByText('Ana Página 1')).toBeInTheDocument());
    expect(screen.queryByText('Beto Página 2')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /próxima/i }));
    await waitFor(() => expect(screen.getByText('Beto Página 2')).toBeInTheDocument());
    expect(screen.queryByText('Ana Página 1')).not.toBeInTheDocument();
    expect(seen[0]).toBe('0:20');
    expect(seen).toContain('1:20');
  });
});

describe('Usuarios — SUPORTE (não gerencia admin)', () => {
  beforeEach(() => asPerfil('suporte'));

  it('does not offer Administrador when inviting and has no menu on admin rows', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(screen.getByText('João Silva')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Ações de João Silva' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ações de Maria Santos' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /convidar usuário/i }));
    const perfil = screen.getByLabelText('Perfil');
    const options = Array.from(perfil.querySelectorAll('option')).map((o) => o.textContent);
    expect(options).toEqual(['Suporte', 'Gerência', 'Operação', 'Vistoriador']);
  });
});

describe('Usuarios — IMOB_GERENCIA (só vê a equipe, sem convidar/editar)', () => {
  beforeEach(() => asPerfil('imob_gerencia'));

  it('does not show the "Convidar usuário" action', () => {
    renderPage();
    expect(screen.queryByRole('button', { name: /convidar usuário/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^filtros/i })).toBeInTheDocument();
  });

  it('renders the (backend-scoped) team list read-only, without an action menu', async () => {
    server.use(
      http.get(`${BASE_URL}/v1/usuarios`, () =>
        HttpResponse.json({ ...mockUsuariosData, content: mockUsuariosData.content.slice(1) }),
      ),
    );

    renderPage();

    await waitFor(() => expect(screen.getByText('Maria Santos')).toBeInTheDocument());
    expect(screen.getByText('Carlos Oliveira')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ações de/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^perfil de/i)).not.toBeInTheDocument();
  });
});
