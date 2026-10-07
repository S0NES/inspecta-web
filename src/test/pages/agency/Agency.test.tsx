import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Agency } from '../../../pages/agency/Agency';
import { useAppStore } from '../../../store/useAppStore';

function LocationProbe() {
  const loc = useLocation();
  return <div data-testid="loc" data-pathname={loc.pathname} />;
}
const currentPath = () => screen.getByTestId('loc').getAttribute('data-pathname');

const BASE_URL = 'http://localhost:8080';

const mockCidades = {
  content: [
    { id: 'c1', nome: 'São Paulo', uf: 'SP' },
    { id: 'c2', nome: 'Campinas', uf: 'SP' },
  ],
  totalElements: 2,
  totalPages: 1,
  size: 100,
  number: 0,
};

const mockCreateResponse = {
  id: '1',
  razaoSocial: 'Nova Imobiliária',
  nomeFantasia: null,
  cnpj: '11.222.333/0001-81',
  ativa: true,
};

const mockExistingAgency = {
  id: '7',
  razaoSocial: 'Imob Existente Ltda',
  nomeFantasia: 'Imob Existente',
  cnpj: '11.222.333/0001-44',
  ativa: true,
  pix: 'financeiro@imob.com',
  emailFinanceiro: 'financeiro@imob.com',
  telefone: '11999998888',
  // Endereço já cadastrado — o wizard de edição passa pelo passo Endereço sem travar.
  cep: '',
  endereco: 'Rua das Acácias',
  numero: '100',
  complemento: '',
  cidadeId: 'c1',
};

const server = setupServer(
  http.get(`${BASE_URL}/v1/cidades`, () => HttpResponse.json(mockCidades)),
  http.get('https://viacep.com.br/ws/:cep/json/', () =>
    HttpResponse.json({
      cep: '01310-100',
      logradouro: 'Rua das Flores',
      complemento: '',
      bairro: 'Bela Vista',
      localidade: 'São Paulo',
      uf: 'SP',
    }),
  ),
  http.post(`${BASE_URL}/v1/imobiliarias`, () => HttpResponse.json(mockCreateResponse)),
  http.get(`${BASE_URL}/v1/imobiliarias/7`, () => HttpResponse.json(mockExistingAgency)),
  http.patch(`${BASE_URL}/v1/imobiliarias/7`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ ...mockExistingAgency, ...(body as object) });
  }),
  http.get(`${BASE_URL}/v1/imobiliarias/7/contrato`, () =>
    HttpResponse.json({ modo: 'faixa', percentual: null, percentualMinimo: null, grupos: [], faixas: [] }),
  ),
  http.put(`${BASE_URL}/v1/imobiliarias/7/contrato`, () =>
    HttpResponse.json({ modo: 'faixa', percentual: null, percentualMinimo: null, grupos: [], faixas: [] }),
  ),
  http.put(`${BASE_URL}/v1/imobiliarias/7/contrato/grupos`, () => HttpResponse.json([])),
  http.put(`${BASE_URL}/v1/imobiliarias/7/contrato/faixas`, () =>
    HttpResponse.json({ faixas: [], faixaReferencia: [] }),
  ),
  http.get(`${BASE_URL}/v1/servicos`, () => HttpResponse.json([])),
);

beforeEach(() => {
  server.listen({ onUnhandledRequest: 'error' });
  useAppStore.setState({ toastMessage: null, realEstateWizardStep: 0 });
});

afterEach(() => {
  server.resetHandlers();
  useAppStore.setState({ toastMessage: null, realEstateWizardStep: 0 });
});

afterEach(() => server.close());

/** editId definido → modo edição sob `/agencies/:id/edit`; senão `/agencies/new`. */
function renderWithProviders(_component: React.ReactElement, editId?: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={['/agencies', editId ? `/agencies/${editId}/edit` : '/agencies/new']}
        initialIndex={1}
      >
        <Routes>
          <Route path="/agencies/new" element={<><Agency /><LocationProbe /></>} />
          <Route path="/agencies/:id/edit" element={<><Agency /><LocationProbe /></>} />
          <Route path="*" element={<LocationProbe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

const proximo = () => screen.getByRole('button', { name: /^próximo$/i });

/** Preenche o passo Endereço via CEP (cidade e rua vêm do ViaCEP) e avança. */
async function preencherEndereco(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(screen.getByLabelText('CEP')).toBeInTheDocument());
  await user.type(screen.getByLabelText('CEP'), '01310100');
  await waitFor(() => {
    expect((screen.getByLabelText('Cidade') as HTMLInputElement).value).toBe('São Paulo/SP');
  });
  const rua = screen.getByLabelText('Endereço') as HTMLInputElement;
  if (!rua.value) await user.type(rua, 'Rua das Flores');
  await user.click(proximo());
}

describe('Agency (Real Estate) — 5-step wizard', () => {
  it('does not render the aside Resumo panel', () => {
    renderWithProviders(<Agency />);
    expect(screen.queryByRole('heading', { name: 'Resumo' })).not.toBeInTheDocument();
  });

  it('renders the numbered step chrome and the InfoHint header', () => {
    renderWithProviders(<Agency />);

    expect(screen.getByRole('heading', { name: 'Criar imobiliária' })).toBeInTheDocument();
    expect(screen.getByText('Cadastre uma nova imobiliária parceira')).toBeInTheDocument();
    ['Dados', 'Endereço', 'Financeiro', 'Biletagem', 'Confirmação'].forEach((l) =>
      expect(screen.getAllByText(l).length).toBeGreaterThanOrEqual(1),
    );
    ['01', '02', '03', '04', '05'].forEach((n) =>
      expect(screen.getByText(n)).toBeInTheDocument(),
    );
  });

  it('step 1 (Dados) shows razaoSocial and cnpj only — sem nome fantasia', () => {
    renderWithProviders(<Agency />);

    expect(screen.getByLabelText('Nome da empresa')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nome fantasia')).not.toBeInTheDocument();
    expect(screen.getByLabelText('CNPJ')).toBeInTheDocument();
    // Endereço e contato só nos passos seguintes (Pagamento fica montado mas oculto).
    expect(screen.queryByLabelText('CEP')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Telefone')).not.toBeVisible();
    expect(screen.getByLabelText('Chave PIX')).not.toBeVisible();
  });

  it('blocks advancing from step 1 when required fields are empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Agency />);

    await user.click(proximo());

    await waitFor(() => {
      expect(useAppStore.getState().toastMessage).toBe('Preencha todos os campos obrigatórios');
    });
    expect(screen.getByLabelText('Nome da empresa')).toBeInTheDocument();
  });

  it('blocks advancing when the CNPJ does not match the pattern', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Agency />);

    await user.type(screen.getByLabelText('Nome da empresa'), 'Teste');
    await user.type(screen.getByLabelText('CNPJ'), '11.111.111/1111-11');
    await user.click(proximo());

    await waitFor(() => {
      expect(useAppStore.getState().toastMessage).toBe('CNPJ inválido');
    });
  });

  it('step 2 (Endereço) requires endereco and cidade', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Agency />);

    await user.type(screen.getByLabelText('Nome da empresa'), 'Viva Imóveis Ltda');
    await user.type(screen.getByLabelText('CNPJ'), '11.222.333/0001-81');
    await user.click(proximo());

    await waitFor(() => expect(screen.getByLabelText('CEP')).toBeInTheDocument());
    await user.click(proximo());

    await waitFor(() => {
      expect(useAppStore.getState().toastMessage).toBe('Informe o endereço e a cidade');
    });
  });

  it('advances through the 5 steps and reaches the confirmation summary', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Agency />);

    await user.type(screen.getByLabelText('Nome da empresa'), 'Viva Imóveis Ltda');
    await user.type(screen.getByLabelText('CNPJ'), '11.222.333/0001-81');
    await user.click(proximo());

    await preencherEndereco(user); // → Financeiro

    await waitFor(() => expect(screen.getByLabelText('Telefone')).toBeInTheDocument());
    await user.type(screen.getByLabelText('Telefone'), '11987654321');
    await user.type(screen.getByLabelText('Email para receber faturas'), 'financeiro@imob.com');
    await user.click(proximo()); // → Biletagem
    await waitFor(() => expect(screen.getByText('Produtos oferecidos')).toBeVisible());
    await user.click(proximo()); // → Confirmação

    await waitFor(() => expect(screen.getByText('Confirme os dados')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /criar imobiliária/i })).toBeInTheDocument();
  });

  it('submits the create payload with the real DTO field names (incl. endereço)', async () => {
    const user = userEvent.setup();
    let capturedBody: any;
    server.use(
      http.post(`${BASE_URL}/v1/imobiliarias`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json(mockCreateResponse);
      }),
    );

    renderWithProviders(<Agency />);

    await user.type(screen.getByLabelText('Nome da empresa'), 'Nova Imobiliária Ltda');
    await user.type(screen.getByLabelText('CNPJ'), '11.222.333/0001-81');
    await user.click(proximo());

    await preencherEndereco(user);

    await waitFor(() => expect(screen.getByLabelText('Email para receber faturas')).toBeInTheDocument());
    await user.type(screen.getByLabelText('Email para receber faturas'), 'financeiro@imob.com');
    await user.click(proximo()); // → Biletagem
    await user.click(proximo()); // → Confirmação

    await waitFor(() => expect(screen.getByText('Confirme os dados')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /criar imobiliária/i }));

    await waitFor(() => {
      expect(useAppStore.getState().toastMessage).toBe('Imobiliária criada com sucesso');
    });
    expect(capturedBody).toEqual({
      razaoSocial: 'Nova Imobiliária Ltda',
      cnpj: '11222333000181',
      cep: '01310100',
      endereco: 'Rua das Flores',
      cidadeId: 'c1',
      emailFinanceiro: 'financeiro@imob.com',
      contrato: {
        modo: 'faixa',
        percentualMinimo: null,
        grupos: [],
        faixas: [],
      },
    });
  });

  it('shows the "Criando..." pending label while submitting', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${BASE_URL}/v1/imobiliarias`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json(mockCreateResponse);
      }),
    );

    renderWithProviders(<Agency />);

    await user.type(screen.getByLabelText('Nome da empresa'), 'Nova Imobiliária Ltda');
    await user.type(screen.getByLabelText('CNPJ'), '11.222.333/0001-81');
    await user.click(proximo());
    await preencherEndereco(user);
    await user.click(proximo()); // → Biletagem
    await user.click(proximo()); // → Confirmação
    await user.click(screen.getByRole('button', { name: /criar imobiliária/i }));

    await waitFor(() => expect(screen.getByText('Criando...')).toBeInTheDocument());
  });

  it('surfaces a clean toast on API error (never the raw backend body)', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${BASE_URL}/v1/imobiliarias`, () => new HttpResponse('Error', { status: 500 })),
    );

    renderWithProviders(<Agency />);

    await user.type(screen.getByLabelText('Nome da empresa'), 'Nova Imobiliária Ltda');
    await user.type(screen.getByLabelText('CNPJ'), '11.222.333/0001-81');
    await user.click(proximo());
    await preencherEndereco(user);
    await user.click(proximo()); // → Biletagem
    await user.click(proximo()); // → Confirmação
    await user.click(screen.getByRole('button', { name: /criar imobiliária/i }));

    await waitFor(() => {
      const toast = useAppStore.getState().toastMessage;
      expect(toast).toBeTruthy();
      expect(toast).not.toContain('Error');
      expect(toast).toBe('Não foi possível completar a solicitação (500).');
    });
  });

  it('the top "Voltar" link returns to the previous page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Agency />);

    // O link do topo é o primeiro "Voltar" da árvore (o do rodapé navega entre etapas).
    await user.click(screen.getAllByRole('button', { name: 'Voltar' })[0]);

    expect(currentPath()).toBe('/agencies');
  });
});

describe('Agency — edit mode (route /agencies/:id/edit)', () => {
  const renderEdit = () => renderWithProviders(<Agency />, '7');

  it('renders the "Editar imobiliária" heading and pre-fills company data', async () => {
    renderEdit();

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Editar imobiliária' })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect((screen.getByLabelText('Nome da empresa') as HTMLInputElement).value).toBe('Imob Existente Ltda');
    });
    expect((screen.getByLabelText('CNPJ') as HTMLInputElement).value).toBe('11.222.333/0001-44');
  });

  it('disables the CNPJ field in edit mode', async () => {
    renderEdit();

    await waitFor(() => {
      expect((screen.getByLabelText('CNPJ') as HTMLInputElement).disabled).toBe(true);
    });
  });

  it('pre-fills the address step from the agency payload', async () => {
    const user = userEvent.setup();
    renderEdit();

    await waitFor(() => {
      expect((screen.getByLabelText('Nome da empresa') as HTMLInputElement).value).toBe('Imob Existente Ltda');
    });
    await user.click(proximo());

    await waitFor(() => {
      expect((screen.getByLabelText('Endereço') as HTMLInputElement).value).toBe('Rua das Acácias');
    });
    expect((screen.getByLabelText('Cidade') as HTMLInputElement).value).toBe('São Paulo/SP');
  });

  it('blocks advancing when razaoSocial is cleared', async () => {
    const user = userEvent.setup();
    renderEdit();

    await waitFor(() => {
      expect((screen.getByLabelText('Nome da empresa') as HTMLInputElement).value).toBe('Imob Existente Ltda');
    });
    await user.clear(screen.getByLabelText('Nome da empresa'));
    await user.click(proximo());

    await waitFor(() => {
      expect(useAppStore.getState().toastMessage).toBe('Razão social é obrigatória');
    });
  });

  it('renders the Biletagem section on its own step (step 4), not on step 1', async () => {
    const user = userEvent.setup();
    renderEdit();

    await waitFor(() => {
      expect((screen.getByLabelText('Nome da empresa') as HTMLInputElement).value).toBe('Imob Existente Ltda');
    });
    expect(screen.getByText('Produtos oferecidos')).not.toBeVisible();
    await user.click(proximo()); // Endereço
    await user.click(proximo()); // Financeiro
    await user.click(proximo()); // Biletagem
    await waitFor(() => expect(screen.getByText('Produtos oferecidos')).toBeVisible());
  });

  it('does not render the Pleno cadastro externo in edit mode', async () => {
    const user = userEvent.setup();
    renderEdit();

    await waitFor(() => {
      expect((screen.getByLabelText('Nome da empresa') as HTMLInputElement).value).toBe('Imob Existente Ltda');
    });
    await user.click(proximo()); // Endereço
    await user.click(proximo()); // Contato

    await waitFor(() => expect(screen.getByLabelText('Chave PIX')).toBeInTheDocument());
    expect(screen.queryByText(/cli_codigo na Pleno/i)).not.toBeInTheDocument();
  });

  it('shows "Salvar alterações" and PATCHes only the changed fields', async () => {
    const user = userEvent.setup();
    let capturedBody: any;
    server.use(
      http.patch(`${BASE_URL}/v1/imobiliarias/7`, async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ ...mockExistingAgency, ...(capturedBody as object) });
      }),
    );

    renderEdit();

    await waitFor(() => {
      expect((screen.getByLabelText('Nome da empresa') as HTMLInputElement).value).toBe('Imob Existente Ltda');
    });

    await user.clear(screen.getByLabelText('Nome da empresa'));
    await user.type(screen.getByLabelText('Nome da empresa'), 'Imob Renomeada Ltda');
    await user.click(proximo()); // Endereço
    await user.click(proximo()); // Financeiro
    await user.click(proximo()); // Biletagem
    await user.click(proximo()); // Confirmação
    await user.click(screen.getByRole('button', { name: /salvar alterações/i }));

    await waitFor(() => expect(capturedBody).toEqual({ razaoSocial: 'Imob Renomeada Ltda' }));
    await waitFor(() => expect(currentPath()).toBe('/agencies'));
  });

  it('returns to the previous page from the top "Voltar" link', async () => {
    const user = userEvent.setup();
    renderEdit();

    await waitFor(() => {
      expect((screen.getByLabelText('Nome da empresa') as HTMLInputElement).value).toBe('Imob Existente Ltda');
    });
    await user.click(screen.getAllByRole('button', { name: 'Voltar' })[0]);

    expect(currentPath()).toBe('/agencies');
  });
});
