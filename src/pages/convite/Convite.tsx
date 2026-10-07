import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import { apiClient } from '../../api/client';
import { REGRAS_SENHA, senhaAtendePolitica } from '../../utils/passwordPolicy';
import { useTranslation } from '../../i18n';
import { Icon } from '../../components/shared/Icon';
import '../login/Login.css';
import '../forgotPassword/ForgotPassword.css';
import './Convite.css';

/**
 * Tela pré-login de aceite de convite. O token vem de `?token=` na URL
 * (`useSearchParams`). O usuário define nome + senha; ao concluir, a conta é
 * ativada no backend e ele volta para o login.
 */
export const Convite: React.FC = () => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!token) {
      setErro(t.auth.invite.invalid);
      return;
    }
    if (!senhaAtendePolitica(senha)) {
      setErro(t.password.doesNotMeet);
      return;
    }
    if (senha !== confirmarSenha) {
      setErro(t.password.mismatch);
      return;
    }

    setLoading(true);
    try {
      await apiClient.aceitarConvite(token, senha, nome);
      setToast(t.auth.invite.successToast);
      setTimeout(() => setToast(null), 5000);
      navigate('/login');
    } catch {
      setErro(t.auth.invite.invalid);
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
          <h2 className="type-h2">{t.auth.invite.title}</h2>
          <p className="login-form-subtitle">{t.auth.invite.subtitle}</p>

          <form onSubmit={handleSubmit} className="login-form">
            {erro && <div className="login-error">{erro}</div>}
            <Input
              label={t.auth.invite.nameLabel}
              type="text"
              placeholder={t.auth.invite.namePlaceholder}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
            />
            <Input
              label={t.auth.invite.passwordLabel}
              type="password"
              placeholder={t.auth.common.passwordPlaceholder}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
            <Input
              label={t.auth.invite.confirmPasswordLabel}
              type="password"
              placeholder={t.auth.common.passwordPlaceholder}
              value={confirmarSenha}
              onChange={(e) => setConfirmarSenha(e.target.value)}
              required
            />

            <ul className="password-rules" aria-label={t.password.rulesLabel}>
              {REGRAS_SENHA.map((regra) => {
                const ok = senha.length > 0 && regra.valido(senha);
                return (
                  <li key={regra.label} className={ok ? 'password-rule password-rule--ok' : 'password-rule'}>
                    <span aria-hidden="true"><Icon name={ok ? 'check' : 'circle'} size={14} /></span> {regra.label}
                  </li>
                );
              })}
            </ul>

            <Button type="submit" variant="primary" size="md" style={{ width: '100%' }} disabled={loading}>
              {loading ? t.auth.invite.submitting : t.auth.invite.submit}
            </Button>
            <button type="button" className="login-forgot-link" onClick={() => navigate('/login')}>
              {t.auth.common.backToLogin}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
