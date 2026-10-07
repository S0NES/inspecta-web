import type { ReactElement, ReactNode } from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

/** QueryClient sem retry — o padrão para testes (falha rápido, sem espera). */
export function makeTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/** Sonda que expõe o pathname/search atuais do router para asserções de navegação. */
function LocationProbe() {
  const loc = useLocation();
  return (
    <div
      data-testid="location-display"
      data-pathname={loc.pathname}
      data-search={loc.search}
    />
  );
}

interface RenderWithProvidersOptions {
  /** URL inicial do MemoryRouter (default `/`). Também aceita `initialEntries`. */
  route?: string;
  initialEntries?: string[];
  /**
   * Padrão de rota sob o qual montar `ui` — necessário quando o componente lê
   * `useParams()` (ex.: `/properties/:id/edit`). Sem isso, `ui` é renderizado direto.
   */
  path?: string;
  queryClient?: QueryClient;
}

export interface RenderWithProvidersResult extends RenderResult {
  queryClient: QueryClient;
  /** Pathname atual do router (lido da sonda). */
  currentPath: () => string;
  currentSearch: () => string;
}

/**
 * Renderiza `ui` dentro de `QueryClientProvider` + `MemoryRouter`. Usado por todos os
 * testes de página/layout que navegam ou leem params da URL.
 */
export function renderWithProviders(
  ui: ReactElement,
  {
    route = '/',
    initialEntries,
    path,
    queryClient = makeTestQueryClient(),
  }: RenderWithProvidersOptions = {},
): RenderWithProvidersResult {
  const entries = initialEntries ?? [route];

  const content = (
    <>
      {ui}
      <LocationProbe />
    </>
  );

  const tree: ReactNode = path ? (
    <Routes>
      <Route path={path} element={content} />
      <Route path="*" element={content} />
    </Routes>
  ) : (
    content
  );

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={entries}>{tree}</MemoryRouter>
    </QueryClientProvider>,
  );

  const probe = () => result.getByTestId('location-display');
  return {
    ...result,
    queryClient,
    currentPath: () => probe().getAttribute('data-pathname') ?? '',
    currentSearch: () => probe().getAttribute('data-search') ?? '',
  };
}
