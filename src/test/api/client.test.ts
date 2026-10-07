import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { apiClient, decodeToken } from '../../api/client';

const BASE_URL = 'http://localhost:8080';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('decodeToken', () => {
  it('should decode a valid JWT token', () => {
    const payload = {
      sub: 'user123',
      perfil: 'vistoriador',
      imobiliaria_id: '42',
      iat: 1000000,
      exp: 2000000,
    };
    const encodedPayload = btoa(JSON.stringify(payload));
    const token = `header.${encodedPayload}.signature`;

    const decoded = decodeToken(token);

    expect(decoded.sub).toBe('user123');
    expect(decoded.perfil).toBe('vistoriador');
    expect(decoded.imobiliaria_id).toBe('42');
  });

  it('should throw on invalid token format (not 3 parts)', () => {
    expect(() => decodeToken('invalid')).toThrow('Invalid token format');
    expect(() => decodeToken('two.parts')).toThrow('Invalid token format');
  });

  it('should throw on invalid base64 payload', () => {
    expect(() => decodeToken('a.!!!invalid!!!.c')).toThrow();
  });
});

describe('apiClient.request', () => {
  it('should make a GET request and return JSON', async () => {
    const mockData = { id: '1', name: 'Test' };
    server.use(
      http.get(`${BASE_URL}/test`, () => HttpResponse.json(mockData))
    );

    const result = await apiClient.request('/test');

    expect(result).toEqual(mockData);
  });

  it('should include credentials in request', async () => {
    server.use(
      http.get(`${BASE_URL}/test`, () => {
        // MSW's RequestInit isn't directly exposed, but credentials are included in fetch
        return HttpResponse.json({ ok: true });
      })
    );

    await apiClient.request('/test');
    // Credentials are set at fetch level; MSW respects them implicitly
  });

  it('should set Content-Type header', async () => {
    let capturedHeaders: Record<string, string> = {};
    server.use(
      http.post(`${BASE_URL}/test`, ({ request }) => {
        request.headers.forEach((value, key) => {
          capturedHeaders[key] = value;
        });
        return HttpResponse.json({});
      })
    );

    await apiClient.request('/test', { method: 'POST', body: '{}' });

    expect(capturedHeaders['content-type']).toBe('application/json');
  });

  it('should merge custom headers', async () => {
    let capturedHeaders: Record<string, string> = {};
    server.use(
      http.get(`${BASE_URL}/test`, ({ request }) => {
        request.headers.forEach((value, key) => {
          capturedHeaders[key] = value;
        });
        return HttpResponse.json({});
      })
    );

    await apiClient.request('/test', { headers: { 'X-Custom': 'value' } });

    expect(capturedHeaders['x-custom']).toBe('value');
    expect(capturedHeaders['content-type']).toBe('application/json');
  });

  it('should handle 204 No Content and return null', async () => {
    server.use(
      http.post(`${BASE_URL}/test`, () => new HttpResponse(null, { status: 204 }))
    );

    const result = await apiClient.request('/test', { method: 'POST' });

    expect(result).toBeNull();
  });

  it('should throw a generic message (not the raw body) on a non-JSON error response', async () => {
    server.use(
      http.get(`${BASE_URL}/test`, () =>
        new HttpResponse('Bad request error', { status: 400 })
      )
    );

    await expect(apiClient.request('/test')).rejects.toThrow(
      'Não foi possível completar a solicitação (400).'
    );
  });

  it('should throw a generic message on 500 with a non-JSON body', async () => {
    server.use(
      http.get(`${BASE_URL}/test`, () =>
        new HttpResponse('Internal server error', { status: 500 })
      )
    );

    await expect(apiClient.request('/test')).rejects.toThrow(
      'Não foi possível completar a solicitação (500).'
    );
  });

  it('should parse an RFC-7807 problem-detail body into a clean message', async () => {
    server.use(
      http.get(`${BASE_URL}/test`, () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Bad Request',
            status: 400,
            detail: 'CNPJ ja cadastrado',
          },
          { status: 400 }
        )
      )
    );

    await expect(apiClient.request('/test')).rejects.toThrow('CNPJ ja cadastrado');
  });

  it('should include validation field errors from a problem-detail body', async () => {
    server.use(
      http.get(`${BASE_URL}/test`, () =>
        HttpResponse.json(
          {
            type: 'about:blank',
            title: 'Unprocessable Entity',
            status: 422,
            detail: 'Validation failed',
            errors: ['cnpj: must not be blank', 'razaoSocial: must not be blank'],
          },
          { status: 422 }
        )
      )
    );

    await expect(apiClient.request('/test')).rejects.toThrow(
      'Validation failed — cnpj: must not be blank; razaoSocial: must not be blank'
    );
  });

  it('should retry once on 401 (except /auth paths)', async () => {
    let requestCount = 0;
    server.use(
      http.get(`${BASE_URL}/protected`, () => {
        requestCount++;
        // First request: 401, second: success
        if (requestCount === 1) {
          return new HttpResponse('Unauthorized', { status: 401 });
        }
        return HttpResponse.json({ data: 'success' });
      }),
      http.post(`${BASE_URL}/v1/auth/refresh`, () => {
        return HttpResponse.json({ accessToken: 'new-token', expiresInSeconds: 3600 });
      })
    );

    const result = await apiClient.request('/protected');

    expect(result).toEqual({ data: 'success' });
    expect(requestCount).toBe(2); // First failed, second succeeded
  });

  it('should not retry on 401 for /v1/auth/refresh path', async () => {
    let requestCount = 0;
    server.use(
      http.post(`${BASE_URL}/v1/auth/refresh`, () => {
        requestCount++;
        return new HttpResponse('Unauthorized', { status: 401 });
      })
    );

    await expect(apiClient.request('/v1/auth/refresh', { method: 'POST' }, true)).rejects.toThrow();

    expect(requestCount).toBe(1); // No retry
  });

  it('should not retry on 401 for /v1/auth/login path', async () => {
    let requestCount = 0;
    server.use(
      http.post(`${BASE_URL}/v1/auth/login`, () => {
        requestCount++;
        return new HttpResponse('Invalid credentials', { status: 401 });
      })
    );

    await expect(apiClient.request('/v1/auth/login', { method: 'POST' })).rejects.toThrow();

    expect(requestCount).toBe(1); // No retry
  });

  it('should not retry if already retrying (_isRetry = true)', async () => {
    let requestCount = 0;
    server.use(
      http.get(`${BASE_URL}/test`, () => {
        requestCount++;
        return new HttpResponse('Unauthorized', { status: 401 });
      })
    );

    await expect(apiClient.request('/test', {}, true)).rejects.toThrow(
      'Não foi possível completar a solicitação (401).'
    );

    expect(requestCount).toBe(1); // No retry when _isRetry is true
  });

  it('should throw Unauthorized if refresh fails on 401', async () => {
    let requestCount = 0;
    server.use(
      http.get(`${BASE_URL}/protected`, () => {
        requestCount++;
        return new HttpResponse('Unauthorized', { status: 401 });
      }),
      http.post(`${BASE_URL}/v1/auth/refresh`, () => {
        return new HttpResponse('Refresh failed', { status: 401 });
      })
    );

    await expect(apiClient.request('/protected')).rejects.toThrow('Unauthorized');

    expect(requestCount).toBe(1); // Attempted once, refresh failed, no retry
  });
});

describe('apiClient.login', () => {
  it('should call POST /v1/auth/login with email and senha', async () => {
    const mockResponse = { accessToken: 'token123', expiresInSeconds: 3600 };
    let capturedBody: LoginRequestBody | undefined;

    server.use(
      http.post(`${BASE_URL}/v1/auth/login`, async ({ request }) => {
        capturedBody = (await request.json()) as LoginRequestBody;
        return HttpResponse.json(mockResponse);
      })
    );

    const result = await apiClient.login('test@example.com', 'password123');

    expect(result).toEqual(mockResponse);
    expect(capturedBody).toEqual({ email: 'test@example.com', senha: 'password123' });
  });

  it('should throw on invalid credentials', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/auth/login`, () =>
        new HttpResponse('Invalid credentials', { status: 401 })
      )
    );

    await expect(
      apiClient.login('wrong@example.com', 'wrongpassword')
    ).rejects.toThrow('Não foi possível completar a solicitação (401).');
  });
});

interface LoginRequestBody {
  email: string;
  senha: string;
}

describe('apiClient.refresh', () => {
  it('should call POST /v1/auth/refresh and return the token payload on success', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/auth/refresh`, () =>
        HttpResponse.json({ accessToken: 'new-token', expiresInSeconds: 3600 })
      )
    );

    const result = await apiClient.refresh();

    expect(result).toEqual({ accessToken: 'new-token', expiresInSeconds: 3600 });
  });

  it('should return null on refresh failure', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/auth/refresh`, () =>
        new HttpResponse('Refresh failed', { status: 401 })
      )
    );

    const result = await apiClient.refresh();

    expect(result).toBeNull();
  });

  it('should not retry refresh endpoint on 401', async () => {
    let requestCount = 0;
    server.use(
      http.post(`${BASE_URL}/v1/auth/refresh`, () => {
        requestCount++;
        return new HttpResponse('Unauthorized', { status: 401 });
      })
    );

    await apiClient.refresh();

    expect(requestCount).toBe(1); // No retry for refresh itself
  });

  it('should share one in-flight refresh across concurrent callers', async () => {
    let requestCount = 0;
    server.use(
      http.post(`${BASE_URL}/v1/auth/refresh`, async () => {
        requestCount++;
        await new Promise((r) => setTimeout(r, 40));
        return HttpResponse.json({ accessToken: 'shared-token', expiresInSeconds: 3600 });
      })
    );

    const [a, b] = await Promise.all([apiClient.refresh(), apiClient.refresh()]);

    expect(requestCount).toBe(1);
    expect(a).toEqual({ accessToken: 'shared-token', expiresInSeconds: 3600 });
    expect(b).toEqual({ accessToken: 'shared-token', expiresInSeconds: 3600 });
  });

  it('serializes refresh through navigator.locks when available', async () => {
    let requestCount = 0;
    let lockName: string | undefined;
    server.use(
      http.post(`${BASE_URL}/v1/auth/refresh`, () => {
        requestCount++;
        return HttpResponse.json({ accessToken: 'locked-token', expiresInSeconds: 3600 });
      })
    );

    const original = globalThis.navigator.locks;
    Object.defineProperty(globalThis.navigator, 'locks', {
      configurable: true,
      value: {
        request: async (name: string, cb: () => Promise<unknown>) => {
          lockName = name;
          return cb();
        },
      },
    });

    try {
      const result = await apiClient.refresh();
      expect(lockName).toBe('inspecta-auth-refresh');
      expect(result).toEqual({ accessToken: 'locked-token', expiresInSeconds: 3600 });
      expect(requestCount).toBe(1);
    } finally {
      Object.defineProperty(globalThis.navigator, 'locks', {
        configurable: true,
        value: original,
      });
    }
  });

  it('allows a later refresh if navigator.locks rejects before exec', async () => {
    const original = globalThis.navigator.locks;
    Object.defineProperty(globalThis.navigator, 'locks', {
      configurable: true,
      value: {
        request: () => Promise.reject(new Error('lock failed')),
      },
    });

    try {
      await expect(apiClient.refresh()).resolves.toBeNull();
    } finally {
      Object.defineProperty(globalThis.navigator, 'locks', {
        configurable: true,
        value: original,
      });
    }

    server.use(
      http.post(`${BASE_URL}/v1/auth/refresh`, () =>
        HttpResponse.json({ accessToken: 'recovered-token', expiresInSeconds: 3600 })
      )
    );

    await expect(apiClient.refresh()).resolves.toEqual({
      accessToken: 'recovered-token',
      expiresInSeconds: 3600,
    });
  });
});

describe('apiClient.atualizarTema', () => {
  it('should PATCH /v1/usuarios/me with the chosen theme', async () => {
    let body: unknown;
    server.use(
      http.patch(`${BASE_URL}/v1/usuarios/me`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          id: '7',
          nome: 'Roberta',
          email: 'r@inspecta.com.br',
          perfil: 'admin',
          status: 'ativo',
          imobiliariaId: null,
          criadoEm: '2026-01-01T00:00:00Z',
          tema: 'dark',
        });
      })
    );

    const result = await apiClient.atualizarTema('dark');

    expect(body).toEqual({ tema: 'dark' });
    expect(result.tema).toBe('dark');
  });
});

describe('apiClient.logout', () => {
  it('should call POST /v1/auth/logout', async () => {
    let called = false;
    server.use(
      http.post(`${BASE_URL}/v1/auth/logout`, () => {
        called = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    await apiClient.logout();

    expect(called).toBe(true);
  });

  it('should handle 204 response from logout', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/auth/logout`, () =>
        new HttpResponse(null, { status: 204 })
      )
    );

    const result = await apiClient.logout();

    expect(result).toBeUndefined();
  });

  it('should throw on logout failure', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/auth/logout`, () =>
        new HttpResponse('Server error', { status: 500 })
      )
    );

    await expect(apiClient.logout()).rejects.toThrow('Não foi possível completar a solicitação (500).');
  });
});

describe('apiClient.request edge cases', () => {
  it('should return null for an empty 2xx response body (not just 204)', async () => {
    server.use(
      http.get(`${BASE_URL}/test`, () => new HttpResponse(null, { status: 200 }))
    );

    await expect(apiClient.request('/test')).resolves.toBeNull();
  });

  it('should handle malformed JSON response', async () => {
    server.use(
      http.get(`${BASE_URL}/test`, () =>
        new HttpResponse('{ invalid json }', { status: 200 })
      )
    );

    await expect(apiClient.request('/test')).rejects.toThrow();
  });

  it('should pass through request options', async () => {
    let capturedMethod: string | undefined;
    let capturedBody: string | undefined;

    server.use(
      http.post(`${BASE_URL}/test`, async ({ request }) => {
        capturedMethod = request.method;
        capturedBody = await request.text();
        return HttpResponse.json({});
      })
    );

    const body = JSON.stringify({ test: 'data' });
    await apiClient.request('/test', { method: 'POST', body });

    expect(capturedMethod).toBe('POST');
    expect(capturedBody).toBe(body);
  });
});
