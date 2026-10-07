import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Templates } from '../../../pages/templates/Templates';
import { TemplateEditor } from '../../../pages/templates/TemplateEditor';
import { useAppStore } from '../../../store/useAppStore';

const BASE = 'http://localhost:8080';
const UUID = '00000000-0000-4000-8000-000000000001';

const emailTemplates = [
  { uuid: UUID, versao: 1, canal: 'email', nome: 'Convite', assunto: 'Bem-vindo', corpo: 'Ola {{nome}}', ativo: true, atualizadoEm: '2026-01-01T00:00:00Z' },
];
const pdfTemplates = [
  { id: '5', uuid: 'pdf-uuid', chave: 'laudo', imobiliariaId: null, versao: 2, nome: 'Laudo padrão', html: '<html></html>', css: null, ativo: true, atualizadoEm: '2026-01-01T00:00:00Z' },
];
const SYS_UUID = '00000000-0000-4000-8000-0000000000ff';
const utilidades = [
  { utilidade: 'password_reset', rotulo: 'Redefinição de senha', variaveis: ['codigo'], templateId: SYS_UUID, templateNome: 'Sistema' },
  { utilidade: 'user_invited', rotulo: 'Convite de usuário', variaveis: ['nome', 'link'], templateId: SYS_UUID, templateNome: 'Sistema' },
];

const server = setupServer(
  http.get(`${BASE}/v1/notify/templates`, () => HttpResponse.json(emailTemplates)),
  http.get(`${BASE}/v1/notify/templates/utilidades`, () => HttpResponse.json(utilidades)),
  http.get(`${BASE}/v1/pdf-templates`, () => HttpResponse.json(pdfTemplates)),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} data-search={loc.search} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');
const currentSearch = () => screen.getByTestId('loc').getAttribute('data-search');

function renderPage(entry = '/settings/templates') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/settings/templates" element={<><Templates /><LocationProbe /></>} />
          <Route path="/settings/templates/:canal/new" element={<><TemplateEditor /><LocationProbe /></>} />
          <Route path="/settings/templates/:canal/:id/edit" element={<><TemplateEditor /><LocationProbe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => useAppStore.setState((s) => ({ toastMessage: null, auth: { ...s.auth, perfil: null } })));

describe('Templates', () => {
  it('lista os templates de e-mail', async () => {
    renderPage();
    expect(await screen.findByRole('button', { name: /Convite v1/ })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Templates de e-mail' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Templates' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar template' })).toBeInTheDocument();
  });

  it('abre a criação de e-mail numa página própria, sem substituir a lista no mesmo path', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(await screen.findByRole('button', { name: /Convite v1/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Criar template' }));

    expect(currentPath()).toBe('/settings/templates/email/new');
    expect(screen.queryByRole('button', { name: /Convite v1/ })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Novo template de e-mail' })).toBeInTheDocument();
    expect(screen.getByTitle('Prévia do e-mail')).toBeInTheDocument();
    expect(screen.getByLabelText(/Corpo/)).toBeInTheDocument();
  });

  it('abre a edição de e-mail numa página própria', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Convite v1/ }));

    expect(currentPath()).toBe(`/settings/templates/email/${UUID}/edit`);
    expect(screen.queryByRole('button', { name: /Convite v1/ })).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Convite')).toBeInTheDocument();
  });

  it('abre a criação de PDF na aba PDF numa página própria', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'PDF' }));
    await screen.findByText('Laudo padrão');
    await user.click(screen.getByRole('button', { name: 'Criar template' }));

    expect(currentPath()).toBe('/settings/templates/pdf/new');
    expect(screen.queryByText('Laudo padrão')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Novo template de PDF' })).toBeInTheDocument();
  });

  it('publica uma nova versão de um template de e-mail existente', async () => {
    let bodyRecebido: any = null;
    server.use(
      http.post(`${BASE}/v1/notify/templates/${UUID}/versao`, async ({ request }) => {
        bodyRecebido = await request.json();
        return HttpResponse.json({ ...emailTemplates[0], versao: 2 });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Convite v1/ }));
    const corpo = screen.getByLabelText(/Corpo/);
    await user.clear(corpo);
    await user.type(corpo, 'Novo corpo do template');
    await user.click(screen.getByRole('button', { name: /Publicar nova versão/ }));

    await waitFor(() => expect(bodyRecebido).toMatchObject({ corpo: 'Novo corpo do template' }));
    await waitFor(() => expect(useAppStore.getState().toastMessage).toMatch(/nova versão/i));
    await waitFor(() => expect(currentPath()).toBe('/settings/templates'));
  });

  it('mostra a lista de erros quando o backend rejeita um template PDF (422)', async () => {
    server.use(
      http.post(`${BASE}/v1/pdf-templates`, () =>
        HttpResponse.json(
          { detail: 'Template invalido', errors: ['campo obrigatorio ausente: nome', 'sintaxe FreeMarker invalida'] },
          { status: 422 },
        ),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'PDF' }));
    await screen.findByText('Laudo padrão');
    await user.click(screen.getByRole('button', { name: 'Criar template' }));
    await user.type(screen.getByLabelText('Nome'), 'Meu laudo');
    await user.type(screen.getByLabelText(/Código do template/), '<#if>');
    await user.click(screen.getByRole('button', { name: /Publicar nova versão|Criar template/ }));

    expect(await screen.findByText('campo obrigatorio ausente: nome')).toBeInTheDocument();
    expect(screen.getByText('sintaxe FreeMarker invalida')).toBeInTheDocument();
    expect(currentPath()).toBe('/settings/templates/pdf/new');
  });

  it('volta para a lista PDF depois de criar um template PDF', async () => {
    server.use(
      http.post(`${BASE}/v1/pdf-templates`, () =>
        HttpResponse.json({ ...pdfTemplates[0], id: '9', nome: 'Meu laudo', versao: 1 }),
      ),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'PDF' }));
    await screen.findByText('Laudo padrão');
    await user.click(screen.getByRole('button', { name: 'Criar template' }));
    await user.type(screen.getByLabelText('Nome'), 'Meu laudo');
    await user.type(screen.getByLabelText(/Código do template/), '<h1>ok</h1>');
    await user.click(screen.getByRole('button', { name: /Criar template/ }));

    await waitFor(() => expect(currentPath()).toBe('/settings/templates'));
    expect(currentSearch()).toBe('?aba=pdf');
  });

  it('envia um template de e-mail para uma lista de endereços', async () => {
    let enviado: any = null;
    server.use(
      http.post(`${BASE}/v1/notify/templates/${UUID}/enviar`, async ({ request }) => {
        enviado = await request.json();
        return HttpResponse.json({ enfileirados: enviado.emails.length });
      }),
    );
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Ações de Convite/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Enviar/ }));
    const dialog = await screen.findByRole('dialog');
    await user.type(
      within(dialog).getByLabelText(/E-mails de destino/),
      'ana@x.com, bea@x.com nao-vale',
    );
    await user.click(within(dialog).getByRole('button', { name: /Enviar \(2\)/ }));

    await waitFor(() => expect(enviado).toEqual({ emails: ['ana@x.com', 'bea@x.com'] }));
    await waitFor(() => expect(useAppStore.getState().toastMessage).toMatch(/enfileirado para 2/i));
  });

  it('mostra erro de carga na lista PDF em vez da lista vazia', async () => {
    server.use(http.get(`${BASE}/v1/pdf-templates`, () => new HttpResponse(null, { status: 500 })));
    renderPage('/settings/templates?aba=pdf');
    expect(
      await screen.findByText('Não foi possível carregar.', {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/o laudo usa o layout embutido/)).not.toBeInTheDocument();
  });

  it('mostra não encontrado ao editar um PDF cujo id não está na lista', async () => {
    renderPage('/settings/templates/pdf/inexistente/edit');
    expect(await screen.findByText('Template não encontrado.')).toBeInTheDocument();
    expect(screen.queryByText(/o laudo usa o layout embutido/)).not.toBeInTheDocument();
  });

  it('atualiza a prévia em tempo real enquanto o código é digitado', async () => {
    const user = userEvent.setup();
    renderPage('/settings/templates/email/new');

    const corpo = screen.getByLabelText(/Corpo/);
    const previa = screen.getByTitle('Prévia do e-mail');
    await user.type(corpo, '<p>Ola mundo</p>');

    await waitFor(() => expect(previa).toHaveAttribute('srcdoc', expect.stringContaining('Ola mundo')));
  });

  // As telas de "Utilidades" (vínculo utilidade→template) foram extraídas para
  // Utilidades.tsx — a cobertura vive em Utilidades.test.tsx.
});
