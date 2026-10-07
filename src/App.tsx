import { useEffect, useState } from 'react';
import { useAppStore } from './store/useAppStore';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { apiClient, decodeToken, tenantIdsFromToken } from './api/client';
import { mapPerfilToRole } from './utils/roleMapper';
import { AppRoutes } from './routes';
import { useTranslation } from './i18n';
import './styles/tokens.css';
import './App.css';

function App() {
  const theme = useAppStore((s) => s.theme);
  const setAuth = useAppStore((s) => s.setAuth);
  const setRole = useAppStore((s) => s.setRole);
  const applyTema = useAppStore((s) => s.applyTema);
  const { t } = useTranslation();
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // A hard reload loses all in-memory Zustand state but the httpOnly refresh
  // cookie (7d) is still valid — silently exchange it for a fresh access token
  // before the router decides between the login screen and the app shell. The
  // current URL is preserved: convite / pagamento landings never require a
  // session, and authenticated deep links (e.g. /solicitacoes/:id/pagar) survive
  // the reload because the router keeps the location instead of forcing /dashboard.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await apiClient.refresh();
      if (cancelled) return;

      if (result) {
        const decoded = decodeToken(result.accessToken);
        setAuth({
          accessToken: result.accessToken,
          userId: decoded.sub,
          perfil: decoded.perfil,
          imobiliariaId: decoded.imobiliaria_id,
          imobiliariaIds: tenantIdsFromToken(decoded),
        });
        setRole(mapPerfilToRole(decoded.perfil));
      }

      setBootstrapping(false);

      // O JWT não traz nome/email — busca a identidade real para o header/sidebar.
      // Roda depois de liberar o render: se `/me` falhar (null), a sidebar só cai no fallback.
      if (result) {
        const me = await apiClient.me();
        if (!cancelled && me) {
          setAuth({ userEmail: me.email, userName: me.nome });
          applyTema(me.tema);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (bootstrapping) {
    return (
      <div className="app-bootstrap-loading" role="status" aria-live="polite">
        {t.app.bootstrapping}
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  );
}

export default App;
