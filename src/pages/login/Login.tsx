import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import { Icon } from '../../components/shared/Icon';
import { apiClient, decodeToken, tenantIdsFromToken } from '../../api/client';
import { mapPerfilToRole } from '../../utils/roleMapper';
import { useTranslation } from '../../i18n';
import './Login.css';

export const Login: React.FC = () => {
  const { setRole, setAuth, setToast, setLoginError, applyTema, auth } = useAppStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setLoginError(null);

    try {
      const response = await apiClient.login(email, password);
      // No client-side token storage: the server set httpOnly inspecta_access/inspecta_refresh
      // cookies, which the browser now attaches automatically to every request. We only
      // decode the JWT locally to read its non-secret claims for the UI.

      // Decode JWT to extract claims
      const decoded = decodeToken(response.accessToken);

      // Map backend perfil to frontend role
      const frontendRole = mapPerfilToRole(decoded.perfil);

      // Store auth state
      setAuth({
        accessToken: response.accessToken,
        userEmail: email,
        userId: decoded.sub,
        perfil: decoded.perfil,
        imobiliariaId: decoded.imobiliaria_id,
        imobiliariaIds: tenantIdsFromToken(decoded),
      });

      // O JWT não traz nome/email. Busca a identidade real para o display name — mantém
      // `userEmail: email` acima como valor imediato caso `/me` esteja lento ou falhe.
      try {
        const me = await apiClient.me();
        if (me) {
          setAuth({ userName: me.nome, userEmail: me.email });
          applyTema(me.tema);
        }
      } catch {
        // identidade desconhecida — segue com o email digitado
      }

      setRole(frontendRole);
      navigate('/dashboard');
      setToast(t.auth.login.welcomeToast);
      setTimeout(() => setToast(null), 4200);
    } catch (error) {
      // O backend já responde com uma mensagem genérica ("Credencial invalida") para
      // qualquer falha de login — nunca distingue email inexistente de senha errada,
      // então basta repassar o texto como veio.
      const errorMsg = error instanceof Error ? error.message : t.auth.login.genericError;
      setLoginError(errorMsg);
      setToast(errorMsg);
      setTimeout(() => setToast(null), 4200);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-hero">
        <div className="login-hero-content">
          <img src="/inspecta-horizontal-negativo.svg" alt={t.auth.hero.logoAlt} className="login-logo" />
          <h1 className="type-h1-hero">{t.auth.hero.title}</h1>
          <p className="login-subtitle">{t.auth.hero.subtitle}</p>
        </div>
      </div>

      <div className="login-form-container">
        <div className="login-form-box">
          <h2 className="type-h2">{t.auth.login.welcomeTitle}</h2>
          <p className="login-form-subtitle">{t.auth.login.subtitle}</p>

          <form onSubmit={handleLogin} className="login-form">
            {notice && (
              <div className="login-notice" role="status">
                {notice}
              </div>
            )}
            {auth.loginError && (
              <div className="login-error">
                {auth.loginError}
              </div>
            )}

            <Input
              label={t.auth.common.emailLabel}
              type="email"
              placeholder={t.auth.common.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label={t.auth.login.passwordLabel}
              type="password"
              placeholder={t.auth.common.passwordPlaceholder}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="md"
              style={{ width: '100%' }}
              disabled={loading}
            >
              {loading ? t.auth.login.submitting : t.auth.login.submit}
            </Button>

            <button
              type="button"
              className="login-forgot-link"
              onClick={() => navigate('/forgot-password')}
            >
              {t.auth.login.forgot}
            </button>
          </form>

          <p className="login-help">
            {t.auth.login.helpPrefix}{' '}
            <a href="mailto:suporte@inspecta.local">
              <Icon name="mail" size={13} /> {t.auth.login.helpLink}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};
