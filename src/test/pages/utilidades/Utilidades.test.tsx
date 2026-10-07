import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Utilidades } from '../../../pages/utilidades/Utilidades';
import { useAppStore } from '../../../store/useAppStore';

const BASE = 'http://localhost:8080';
const UUID = '00000000-0000-4000-8000-000000000001';
const SYS_UUID = '00000000-0000-4000-8000-0000000000ff';

const emailTemplates = [
  { uuid: UUID, versao: 1, canal: 'email', nome: 'Convite', assunto: 'Bem-vindo', corpo: 'Ola {{nome}}', ativo: true, atualizadoEm: '2026-01-01T00:00:00Z' },
];
const utilidades = [
  { utilidade: 'password_reset', rotulo: 'Redefinição de senha', variaveis: ['codigo'], templateId: SYS_UUID, templateNome: 'Sistema' },
  { utilidade: 'user_invited', rotulo: 'Convite de usuário', variaveis: ['nome', 'link'], templateId: SYS_UUID, templateNome: 'Sistema' },
];

const server = setupServer(
  http.get(`${BASE}/v1/notify/templates`, () => HttpResponse.json(emailTemplates)),
  http.get(`${BASE}/v1/notify/templates/utilidades`, () => HttpResponse.json(utilidades)),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <Utilidades />
    </QueryClientProvider>,
  );
}

beforeEach(() => useAppStore.setState((s) => ({ toastMessage: null, auth: { ...s.auth, perfil: null } })));

describe('Utilidades', () => {
  it('lista as utilidades', async () => {
    renderPage();
    expect(await screen.findByText('Redefinição de senha')).toBeInTheDocument();
    expect(screen.getByText('Convite de usuário')).toBeInTheDocument();
  });

  it('ADMIN troca o template vinculado a uma utilidade', async () => {
    useAppStore.setState((s) => ({ auth: { ...s.auth, perfil: 'admin' } }));
    const OUTRO = '00000000-0000-4000-8000-000000000099';
    let put: unknown = null;
    server.use(
      http.get(`${BASE}/v1/notify/templates`, () =>
        HttpResponse.json([
          ...emailTemplates,
          { uuid: OUTRO, versao: 1, canal: 'email', nome: 'Reset novo', assunto: 'x', corpo: '{{codigo}}', ativo: true, atualizadoEm: '2026-01-01T00:00:00Z' },
        ]),
      ),
      http.put(`${BASE}/v1/notify/templates/utilidades/password_reset`, async ({ request }) => {
        put = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    const select = await screen.findByLabelText('Template de "Redefinição de senha"');
    expect(select).not.toBeDisabled();
    await user.selectOptions(select, OUTRO);

    await waitFor(() => expect(put).toEqual({ templateId: OUTRO }));
    await waitFor(() => expect(useAppStore.getState().toastMessage).toMatch(/atualizada/i));
  });

  it('não-ADMIN vê as utilidades mas não pode alterar', async () => {
    useAppStore.setState((s) => ({ auth: { ...s.auth, perfil: 'suporte' } }));
    renderPage();
    const select = await screen.findByLabelText('Template de "Redefinição de senha"');
    expect(select).toBeDisabled();
  });
});
