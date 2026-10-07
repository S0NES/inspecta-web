import React, { useId, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Card, Dialog } from '../../components/shared/DataDisplay';
import { Input } from '../../components/shared/Input';
import { InfoHint } from '../../components/shared/InfoHint';
import { Icon } from '../../components/shared/Icon';
import { useMe } from '../../api/usuarios';
import { apiClient } from '../../api/client';
import { REGRAS_SENHA, senhaAtendePolitica } from '../../utils/passwordPolicy';
import { useTranslation, fmt } from '../../i18n';
import '../forgotPassword/ForgotPassword.css';
import './Profile.css';

export const Profile: React.FC = () => {
  const { auth, logout, setToast } = useAppStore();
  const { t } = useTranslation();
  const tp = t.profile;
  /** Rótulo de exibição de cada perfil vindo do backend — mesmo mapeamento da Sidebar. */
  const PERFIL_LABEL: Record<string, string> = t.layout.sidebar.roles;
  const navigate = useNavigate();
  const formId = useId();
  // `/me` traz nome/email/perfil reais; enquanto carrega (ou se falhar) cai nos valores da store.
  const { data: me } = useMe();

  const storeName = auth.userName?.trim() || '';
  const email = me?.email ?? auth.userEmail ?? '';
  const emailName = email ? email.split('@')[0].replace(/[._-]/g, ' ') : '';
  const displayName = me?.nome?.trim() || storeName || emailName || tp.defaultUser;
  const perfil = me?.perfil ?? auth.perfil;
  const perfilLabel = perfil ? PERFIL_LABEL[perfil] ?? perfil : '—';

  const [dialogAberto, setDialogAberto] = useState(false);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [emailDestino, setEmailDestino] = useState('');
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);

  const limparForm = () => {
    setCodigo('');
    setNovaSenha('');
    setConfirmarSenha('');
    setErro(null);
  };

  const fecharDialog = () => {
    if (salvando) return;
    setDialogAberto(false);
    limparForm();
  };

  const enviarCodigo = async () => {
    const destino = email.trim();
    if (!destino) return;
    setEnviandoCodigo(true);
    try {
      // O backend sempre responde 202 aqui, exista o email ou não — nunca revela isso.
      await apiClient.esqueciSenha(destino);
    } catch {
      // Mesmo uma falha de rede não deve travar o fluxo nem dar pista sobre o email.
    } finally {
      setEmailDestino(destino);
      setEnviandoCodigo(false);
      setDialogAberto(true);
      setToast(fmt(t.auth.forgot.codeSentToast, { email: destino }));
      setTimeout(() => setToast(null), 5000);
    }
  };

  const reenviarCodigo = async () => {
    const destino = emailDestino || email.trim();
    if (!destino || enviandoCodigo || salvando) return;
    setEnviandoCodigo(true);
    try {
      await apiClient.esqueciSenha(destino);
    } catch {
      // mesma política do esqueci-senha público
    } finally {
      setEnviandoCodigo(false);
      setToast(fmt(t.auth.forgot.codeSentToast, { email: destino }));
      setTimeout(() => setToast(null), 5000);
    }
  };

  const handleRedefinir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    setErro(null);

    if (!senhaAtendePolitica(novaSenha)) {
      setErro(t.password.doesNotMeet);
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErro(t.password.mismatch);
      return;
    }

    const destino = emailDestino || email.trim();
    setSalvando(true);
    try {
      await apiClient.redefinirSenha(destino, codigo.trim(), novaSenha);
      try {
        await apiClient.logout();
      } catch {
        // O reset já revoga as sessões — limpa o estado local mesmo se o logout falhar.
      }
      logout();
      // O Toast vive no AppLayout (atrás do RequireAuth). Sem `state.notice` a
      // mensagem some no unmount; o login mostra o aviso na própria tela.
      navigate('/login', { replace: true, state: { notice: t.auth.forgot.successToast } });
    } catch (error) {
      setErro(error instanceof Error ? error.message : t.auth.forgot.genericError);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-header">
        <div>
          <InfoHint title={tp.hintTitle}>
            <p>{tp.hintBody}</p>
          </InfoHint>
        </div>
        <Button variant="ghost" size="md" onClick={() => navigate('/dashboard')}>
          {t.common.back}
        </Button>
      </div>

      <Card>
        <div className="profile-info">
          <div className="profile-field">
            <span className="profile-field-label">{tp.fieldName}</span>
            <span className="profile-field-value">{displayName}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">{tp.fieldEmail}</span>
            <span className="profile-field-value">{email || '—'}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">{tp.fieldRole}</span>
            <span className="profile-field-value">{perfilLabel}</span>
          </div>
        </div>
        <div className="profile-actions">
          <Button
            variant="primary"
            size="md"
            onClick={enviarCodigo}
            disabled={!email || enviandoCodigo}
            title={!email ? tp.resetNoEmail : undefined}
          >
            {enviandoCodigo ? tp.resetSending : tp.resetPassword}
          </Button>
        </div>
      </Card>

      <Dialog
        isOpen={dialogAberto}
        onClose={fecharDialog}
        title={t.auth.forgot.resetTitle}
        actions={
          <>
            <Button variant="ghost" size="md" onClick={fecharDialog} disabled={salvando}>
              {t.common.cancel}
            </Button>
            <Button
              variant="primary"
              size="md"
              type="submit"
              form={formId}
              disabled={salvando}
            >
              {salvando ? t.auth.forgot.submitting : t.auth.forgot.submit}
            </Button>
          </>
        }
      >
        <p className="profile-reset-hint">{fmt(tp.resetDialogHint, { email: emailDestino || email })}</p>
        <form id={formId} onSubmit={handleRedefinir}>
          {erro && <div className="profile-error" role="alert">{erro}</div>}
          <Input
            label={t.auth.forgot.codeLabel}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder={t.auth.forgot.codePlaceholder}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            disabled={salvando}
            required
          />
          <Input
            label={t.auth.forgot.newPasswordLabel}
            type="password"
            autoComplete="new-password"
            placeholder={t.auth.common.passwordPlaceholder}
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
            disabled={salvando}
            required
          />
          <Input
            label={t.auth.forgot.confirmNewPasswordLabel}
            type="password"
            autoComplete="new-password"
            placeholder={t.auth.common.passwordPlaceholder}
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            disabled={salvando}
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
          <button type="button" className="profile-resend" onClick={reenviarCodigo} disabled={enviandoCodigo || salvando}>
            {tp.resetResend}
          </button>
        </form>
      </Dialog>
    </div>
  );
};
