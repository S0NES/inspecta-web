import type { ReactElement } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAppStore, type Role } from './store/useAppStore';
import { AppLayout } from './components/layouts/AppLayout';
import { Login } from './pages/login';
import { ForgotPassword } from './pages/forgotPassword';
import { Convite } from './pages/convite';
import { Dashboard } from './pages/dashboard';
import { Requests } from './pages/requests';
import { Wizard } from './pages/wizard';
import { Laudos } from './pages/laudos';
import { Extrato } from './pages/extratos';
import { Detail } from './pages/detail';
import { Earnings } from './pages/earnings';
import { Admin } from './pages/admin';
import { Agency } from './pages/agency';
import { Catalog } from './pages/catalog';
import { Tipagem } from './pages/tipagem';
import { BiletagemCliente } from './pages/biletagemCliente';
import { Vistoriadores } from './pages/vistoriadores';
import { Usuarios } from './pages/usuarios';
import { Clientes } from './pages/clientes';
import { ClienteWizard } from './pages/clienteWizard';
import { ClienteSolicitar } from './pages/clienteSolicitar';
import { Integracoes } from './pages/integracoes';
import { ApiKeys } from './pages/apiKeys';
import { Templates, TemplateEditor } from './pages/templates';
import { Utilidades } from './pages/utilidades';
import { Properties } from './pages/properties';
import { PropertyWizard } from './pages/propertyWizard';
import { Profile } from './pages/profile';
import { PagarSolicitacao } from './pages/pagamento';
import { PagamentoRetorno } from './pages/pagamento';
import { PagamentoConcluido } from './pages/pagamento';
import { PlaceholderPage } from './pages/placeholder';

/** Guard: exige sessão. Sem `accessToken` após o bootstrap → manda para `/login`. */
function RequireAuth({ children }: { children: ReactElement }): ReactElement {
  const token = useAppStore((s) => s.auth.accessToken);
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

/** Guard de papel (bucket grosso): quem não está em `roles` volta para `/dashboard`. */
function RequireRole({ roles, children }: { roles: Role[]; children: ReactElement }): ReactElement {
  const role = useAppStore((s) => s.role);
  if (!roles.includes(role)) return <Navigate to="/dashboard" replace />;
  return children;
}

/**
 * Guard de perfil granular (`UsuarioPerfil` do backend, não o `Role` do frontend): usado onde
 * o bucket `corretor` (gerência/operação/cliente) precisa ser diferenciado — ex.: só gerência
 * entra em Clientes/Usuários, nunca operação/cliente/vistoriador.
 */
function RequirePerfil({ perfis, children }: { perfis: string[]; children: ReactElement }): ReactElement {
  const perfil = useAppStore((s) => s.auth.perfil);
  if (!perfil || !perfis.includes(perfil)) return <Navigate to="/dashboard" replace />;
  return children;
}

/** `/login` e `/` já autenticado → `/dashboard`. */
function RedirectIfAuthed({ children }: { children: ReactElement }): ReactElement {
  const token = useAppStore((s) => s.auth.accessToken);
  const location = useLocation();
  if (token) {
    const to = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    return <Navigate to={to} replace />;
  }
  return children;
}

const adminOnly = (el: ReactElement) => <RequireRole roles={['admin']}>{el}</RequireRole>;

/** Clientes/Usuários: ADMIN, SUPORTE (bucket `admin`) e IMOB_GERENCIA (dentro de `corretor`). */
const clientesOnly = (el: ReactElement) => (
  <RequirePerfil perfis={['admin', 'suporte', 'imob_gerencia']}>{el}</RequirePerfil>
);

/** Clientes B2C (cadastro/wizard): só ADMIN e SUPORTE — não é a mesma tela de "Clientes/Usuários"
 *  da imobiliária (essa é `clientesOnly`, acima) e não é visível para IMOB_GERENCIA. */
const clientesB2cOnly = (el: ReactElement) => (
  <RequirePerfil perfis={['admin', 'suporte']}>{el}</RequirePerfil>
);

/** Wizard de solicitação do próprio Cliente B2C — só o bucket `cliente` (1:1 com o perfil
 *  `cliente`, sem recorte fino adicional, ao contrário de `corretor`). */
const clienteOnly = (el: ReactElement) => <RequireRole roles={['cliente']}>{el}</RequireRole>;

export function AppRoutes(): ReactElement {
  return (
    <Routes>
      {/* Públicas (sem shell) */}
      <Route path="/login" element={<RedirectIfAuthed><Login /></RedirectIfAuthed>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/convite" element={<Convite />} />

      {/* Landings de provedor de pagamento (sem shell, sem sessão) */}
      <Route path="/pagamento/retorno" element={<PagamentoRetorno />} />
      <Route path="/pagamento/concluido" element={<PagamentoConcluido />} />

      {/* Autenticadas (shell AppLayout) */}
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/requests" element={<Requests />} />
        <Route path="/requests/new" element={<Wizard />} />

        <Route path="/properties" element={<Properties />} />
        <Route path="/properties/new" element={<PropertyWizard />} />
        <Route path="/properties/:id/edit" element={<PropertyWizard />} />

        {/* A lista /inspections foi removida — /requests cobre a fila. A tela de
            captura de fotos (/inspections/:id) continua; a URL é mantida porque
            vários pontos já linkam para ela. */}
        <Route path="/inspections/:id" element={<Detail />} />

        <Route path="/laudos" element={<Laudos />} />
        <Route path="/extrato" element={<Extrato />} />
        <Route path="/earnings" element={<Earnings />} />
        <Route path="/audit" element={<Navigate to="/laudos" replace />} />

        <Route path="/agencies" element={clientesOnly(<Admin />)} />
        <Route path="/agencies/new" element={clientesOnly(<Agency />)} />
        <Route path="/agencies/:id/edit" element={clientesOnly(<Agency />)} />
        <Route path="/usuarios" element={clientesOnly(<Usuarios />)} />

        <Route path="/clientes" element={clientesB2cOnly(<Clientes />)} />
        <Route path="/clientes/new" element={clientesB2cOnly(<ClienteWizard />)} />
        <Route path="/clientes/:id/edit" element={clientesB2cOnly(<ClienteWizard />)} />

        <Route path="/cities" element={adminOnly(<Catalog />)} />
        <Route path="/vistoriadores" element={clientesOnly(<Vistoriadores />)} />
        <Route path="/solicitar" element={clienteOnly(<ClienteSolicitar />)} />
        <Route path="/profile" element={<Profile />} />

        {/* URL de contrato — NÃO traduzir */}
        <Route path="/solicitacoes/:id/pagar" element={<PagarSolicitacao />} />

        {/* Configurações — só admin. Usuários (admin/suporte/gerência) mudou para /usuarios. */}
        <Route path="/settings/tipagem" element={adminOnly(<Tipagem />)} />
        <Route path="/settings/biletagem-cliente" element={adminOnly(<BiletagemCliente />)} />
        <Route path="/settings/integracoes" element={adminOnly(<Integracoes />)} />
        <Route path="/settings/pleno" element={<Navigate to="/settings/integracoes" replace />} />
        <Route path="/settings/api-keys" element={adminOnly(<ApiKeys />)} />
        <Route path="/settings/templates" element={adminOnly(<Templates />)} />
        <Route path="/settings/templates/:canal/new" element={adminOnly(<TemplateEditor />)} />
        <Route path="/settings/templates/:canal/:id/edit" element={adminOnly(<TemplateEditor />)} />
        <Route path="/settings/utilities" element={adminOnly(<Utilidades />)} />

        <Route path="*" element={<PlaceholderPage />} />
      </Route>
    </Routes>
  );
}
