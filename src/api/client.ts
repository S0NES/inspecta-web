const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

export interface TokenResponse {
  accessToken: string;
  expiresInSeconds: number;
}

export interface LoginRequest {
  email: string;
  senha: string;
}

/**
 * GET /v1/usuarios/me — a identidade do usuário logado, resolvida a partir do cookie de auth.
 * O JWT só carrega sub/perfil/imobiliaria_id(s); nome e email vêm daqui. `perfil` é o mesmo
 * enum/casing da claim `perfil` do token, então `mapPerfilToRole(me.perfil)` funciona igual.
 */
export interface MeResponse {
  id: string;
  nome: string;
  email: string;
  perfil: string;
  status: string;
  /** `null` para perfis sem vínculo de tenant (admin/suporte). */
  imobiliariaId: string | null;
  criadoEm: string;
  /** Preferência de tema persistida na conta. Ausente em respostas antigas. */
  tema?: 'light' | 'dark';
}

/** UUID nulo — sentinela de "nenhum" para claims/campos de id que antes usavam `0`/`<=0`. */
export const NIL_UUID = '00000000-0000-0000-0000-000000000000';

export interface DecodedToken {
  sub: string; // user id
  perfil: string; // role: admin, suporte, imob_gerencia, imob_operacao, vistoriador, cliente
  imobiliaria_id: string; // NIL_UUID se nenhuma — imobiliária primária/ativa
  imobiliaria_ids?: string; // V25: CSV de todos os vínculos ("" quando nenhum)
  iat: number;
  exp: number;
}

/** V25: lista de imobiliárias vinculadas ao usuário, a partir do token. */
export function tenantIdsFromToken(t: DecodedToken): string[] {
  const csv = (t.imobiliaria_ids ?? '').trim();
  if (csv) {
    return csv.split(',').map((s) => s.trim()).filter((s) => s.length > 0 && s !== NIL_UUID);
  }
  return t.imobiliaria_id && t.imobiliaria_id !== NIL_UUID ? [t.imobiliaria_id] : [];
}

// Simple JWT decode (client-side only, for parsing)
export function decodeToken(token: string): DecodedToken {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const decoded = JSON.parse(atob(parts[1]));
  return decoded as DecodedToken;
}

/**
 * Erro de resposta HTTP não-2xx. Carrega o `status` e o `body` já parseado (quando
 * é JSON) para os call-sites que precisam do código de negócio — ex.: 409
 * `{ codigo: "SEM_VISTORIADOR", servicos:[...] }` no checkout, 422 do preço-preview.
 * `message` continua sendo a string amigável (RFC-7807 → texto), então
 * `err instanceof Error` / `.message` seguem funcionando igual.
 */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

// The backend's ApiExceptionHandler returns RFC-7807 problem-detail bodies
// ({type, title, status, detail, instance, errors?}). Extract a clean human
// message from it instead of surfacing the raw JSON/text to the user; fall back
// to a generic message when the body isn't a recognizable problem-detail (never
// echo arbitrary server text — could be an HTML error page, a stack trace, etc.).
async function parseError(response: Response): Promise<{ message: string; body: unknown }> {
  const text = await response.text();
  let body: unknown = undefined;
  if (text) {
    try {
      const problem = JSON.parse(text);
      body = problem;
      if (problem && typeof problem === 'object') {
        const parts: string[] = [];
        if (typeof problem.detail === 'string' && problem.detail.trim()) {
          parts.push(problem.detail);
        } else if (typeof problem.title === 'string' && problem.title.trim()) {
          parts.push(problem.title);
        }
        if (Array.isArray(problem.errors) && problem.errors.length > 0) {
          parts.push(problem.errors.join('; '));
        }
        if (parts.length > 0) {
          return { message: parts.join(' — '), body };
        }
      }
    } catch {
      // Corpo não é JSON — cai no fallback genérico abaixo, nunca expõe o texto cru.
    }
  }
  return { message: `Não foi possível completar a solicitação (${response.status}).`, body };
}

// Auth is entirely cookie-based (httpOnly `inspecta_access` + `inspecta_refresh`, set by the
// server). The browser attaches them automatically via credentials:'include' — the client
// never stores the token itself (no sessionStorage/localStorage), only the decoded,
// non-secret claims (perfil/sub) for UI display, kept in the Zustand store.

// Single-flight na mesma aba + navigator.locks entre abas para /v1/auth/refresh.
// N callers na mesma aba (401s concorrentes, StrictMode) compartilham um POST;
// abas diferentes serializam no lock e cada uma ainda faz o próprio POST.
let refreshInFlight: Promise<TokenResponse | null> | null = null;

export const apiClient = {
  async request<T>(
    path: string,
    options: RequestInit = {},
    _isRetry = false
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...Object.fromEntries(
        Object.entries(options.headers || {}).map(([k, v]) => [k, String(v)])
      ),
    };

    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    // Cookie may have expired mid-session: try one silent refresh, then retry once.
    // Os endpoints públicos de auth (login e o fluxo "esqueci minha senha") nunca dependem
    // de sessão — um 401 aí significa credencial/código inválido, não cookie expirado.
    // Se tentarmos refresh+retry nesses casos, o refresh falha (não há sessão) e a mensagem
    // real do backend ("Credencial invalida") é trocada por um "Unauthorized" genérico —
    // foi o que fazia a página de redefinir senha parecer que "não redefine nada".
    const PUBLIC_AUTH_PATHS = [
      '/v1/auth/refresh',
      '/v1/auth/login',
      '/v1/auth/esqueci-senha',
      '/v1/auth/redefinir-senha',
      '/v1/auth/invite/accept',
    ];
    if (response.status === 401 && !_isRetry && !PUBLIC_AUTH_PATHS.includes(path)) {
      const refreshed = await this.refresh();
      if (refreshed) {
        return this.request<T>(path, options, true);
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const { message, body } = await parseError(response);
      throw new ApiError(message, response.status, body);
    }

    // Some endpoints return 2xx with no body (e.g. POST /v1/usuarios invite is
    // 202 Accepted with a void body, not 204) — treat any empty body as null
    // instead of only special-casing 204, which used to throw on `.json()`.
    const text = await response.text();
    if (!text) {
      return null as any;
    }

    return JSON.parse(text) as T;
  },

  /**
   * Identidade do usuário logado. `request()` já faz o refresh+retry silencioso no 401,
   * então uma sessão com cookie válido resolve. Qualquer falha vira `null` ("identidade
   * desconhecida") — nunca lança, nunca desloga.
   */
  async me(): Promise<MeResponse | null> {
    try {
      return await this.request<MeResponse>('/v1/usuarios/me');
    } catch {
      return null;
    }
  },

  /** Persiste o tema na conta (PATCH /v1/usuarios/me). Falha de rede fica a cargo do caller. */
  async atualizarTema(tema: 'light' | 'dark'): Promise<MeResponse> {
    return this.request<MeResponse>('/v1/usuarios/me', {
      method: 'PATCH',
      body: JSON.stringify({ tema }),
    });
  },

  async login(email: string, senha: string): Promise<TokenResponse> {
    return this.request<TokenResponse>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha }),
    });
  },

  async refresh(): Promise<TokenResponse | null> {
    if (refreshInFlight) return refreshInFlight;

    const exec = () =>
      this.request<TokenResponse>('/v1/auth/refresh', { method: 'POST' }, true)
        .catch(() => null);

    // navigator.locks serializa abas do mesmo origin; o single-flight acima
    // cobre callers na mesma aba. O finally é no promise de fora para não
    // prender refreshInFlight se locks.request rejeitar antes de chamar exec.
    const locks = globalThis.navigator?.locks;
    refreshInFlight = Promise.resolve(
      locks?.request ? locks.request('inspecta-auth-refresh', exec) : exec()
    )
      .catch(() => null)
      .finally(() => {
        refreshInFlight = null;
      });
    return refreshInFlight;
  },

  async logout(): Promise<void> {
    await this.request('/v1/auth/logout', { method: 'POST' }, true);
  },

  /** Sempre "sucesso" do ponto de vista do chamador — o backend nunca revela se o email existe. */
  async esqueciSenha(email: string): Promise<void> {
    await this.request('/v1/auth/esqueci-senha', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async redefinirSenha(email: string, codigo: string, novaSenha: string): Promise<void> {
    await this.request('/v1/auth/redefinir-senha', {
      method: 'POST',
      body: JSON.stringify({ email, codigo, novaSenha }),
    });
  },

  /** Aceita um convite: valida o token, define a senha e ativa a conta. Endpoint em permitAll. */
  async aceitarConvite(token: string, senha: string, nome: string): Promise<void> {
    await this.request('/v1/auth/invite/accept', {
      method: 'POST',
      body: JSON.stringify({ token, senha, nome }),
    });
  },
};
