import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import { apiClient } from '../../api/client';
import { REGRAS_SENHA, senhaAtendePolitica } from '../../utils/passwordPolicy';
import { isEmail } from '../../utils/pessoaDocumento';
import { useTranslation, fmt } from '../../i18n';
import { Icon } from '../../components/shared/Icon';
import '../login/Login.css';
import './ForgotPassword.css';

type Passo = 'email' | 'codigo';

export const ForgotPassword: React.FC = () => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [passo, setPasso] = useState<Passo>('email');
  const [email, setEmail] = useState('');
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const handleEnviarCodigo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmail(email)) {
      setErro(t.validation.emailInvalid);
      return;
    }
    setLoading(true);
    setErro(null);
    try {
      // O backend sempre responde 202 aqui, exista o email ou não — nunca revela isso.
      await apiClient.esqueciSenha(email.trim());
    } catch {
      // Mesmo uma falha de rede não deve travar o fluxo nem dar pista sobre o email.
    } finally {
      setLoading(false);
      setPasso('codigo');
      setToast(fmt(t.auth.forgot.codeSentToast, { email }));
      setTimeout(() => setToast(null), 5000);
    }
  };

  const handleRedefinir = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);

    if (!senhaAtendePolitica(novaSenha)) {
      setErro(t.password.doesNotMeet);
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro(t.password.mismatch);
      return;
    }

    setLoading(true);
    try {
      // Código colado de app de email costuma vir com espaço/quebra de linha em volta;
      // sem o trim o hash não bate e o backend responde "Credencial invalida".
      await apiClient.redefinirSenha(email.trim(), codigo.trim(), novaSenha);
      setToast(t.auth.forgot.successToast);
      setTimeout(() => setToast(null), 5000);
      navigate('/login');
    } catch (error) {
      setErro(error instanceof Error ? error.message : t.auth.forgot.genericError);
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
          {passo === 'email' ? (
            <>
              <h2 className="type-h2">{t.auth.forgot.requestTitle}</h2>
              <p className="login-form-subtitle">{t.auth.forgot.requestSubtitle}</p>

              <form onSubmit={handleEnviarCodigo} className="login-form">
                {erro && <div className="login-error">{erro}</div>}
                <Input
                  label={t.auth.common.emailLabel}
                  type="email"
                  placeholder={t.auth.common.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" variant="primary" size="md" style={{ width: '100%' }} disabled={loading}>
                  {loading ? t.auth.forgot.sendingCode : t.auth.forgot.sendCode}
                </Button>
                <button type="button" className="login-forgot-link" onClick={() => navigate('/login')}>
                  {t.auth.common.backToLogin}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="type-h2">{t.auth.forgot.resetTitle}</h2>
              <p className="login-form-subtitle">
                {t.auth.forgot.resetSubtitlePrefix} <strong>{email}</strong> {t.auth.forgot.resetSubtitleSuffix}
              </p>

              <form onSubmit={handleRedefinir} className="login-form">
                {erro && <div className="login-error">{erro}</div>}
                <Input
                  label={t.auth.forgot.codeLabel}
                  type="text"
                  inputMode="numeric"
                  placeholder={t.auth.forgot.codePlaceholder}
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value)}
                  required
                />
                <Input
                  label={t.auth.forgot.newPasswordLabel}
                  type="password"
                  placeholder={t.auth.common.passwordPlaceholder}
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  required
                />
                <Input
                  label={t.auth.forgot.confirmNewPasswordLabel}
                  type="password"
                  placeholder={t.auth.common.passwordPlaceholder}
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  required
                />

                <ul className="password-rules" aria-label={t.password.rulesLabel}>
                  {REGRAS_SENHA.map((regra) => {
                    const ok = novaSenha.length > 0 && regra.valido(novaSenha);
                    return (
                      <li key={regra.label} className={ok ? 'password-rule password-rule--ok' : 'password-rule'}>
                        <span aria-hidden="true"><Icon name={ok ? 'check' : 'circle'} size={14} /></span> {regra.label}
                      </li>
                    );
                  })}
                </ul>

                <Button type="submit" variant="primary" size="md" style={{ width: '100%' }} disabled={loading}>
                  {loading ? t.auth.forgot.submitting : t.auth.forgot.submit}
                </Button>
                <button type="button" className="login-forgot-link" onClick={() => setPasso('email')}>
                  {t.auth.forgot.retryCode}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
