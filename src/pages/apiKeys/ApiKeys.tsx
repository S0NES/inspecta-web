import React, { useState } from 'react';
import { Card, Badge, Dialog } from '../../components/shared/DataDisplay';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import { InfoHint } from '../../components/shared/InfoHint';
import { Icon } from '../../components/shared/Icon';
import { useAppStore } from '../../store/useAppStore';
import { useApiKeys, useCreateApiKey, useRevokeApiKey, type CreatedApiKey } from '../../api/apiKeys';
import { useImobiliarias } from '../../api/admin';
import { newIdempotencyKey } from '../../utils/idempotency';
import { copyText } from '../../utils/clipboard';
import { useTranslation, fmt } from '../../i18n';
import './ApiKeys.css';

const ESCOPOS = ['read', 'write'];

export const ApiKeys: React.FC = () => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tk = t.apiKeys;
  const lista = useApiKeys();
  const criar = useCreateApiKey();
  const revogar = useRevokeApiKey();
  const imobiliarias = useImobiliarias({ size: 200 }).data?.content ?? [];

  const [modalAberto, setModalAberto] = useState(false);
  const [imobiliariaId, setImobiliariaId] = useState('');
  const [escopos, setEscopos] = useState<string[]>(['read']);
  const [expiraEm, setExpiraEm] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [novaChave, setNovaChave] = useState<CreatedApiKey | null>(null);
  const [copiado, setCopiado] = useState(false);

  const chaves = lista.data ?? [];
  const nomeImob = (id: string | null) =>
    imobiliarias.find((i) => i.id === id)?.nomeFantasia
    || imobiliarias.find((i) => i.id === id)?.razaoSocial
    || '—';

  const abrirModal = () => {
    setIdempotencyKey(newIdempotencyKey());
    setModalAberto(true);
  };

  const toggleEscopo = (e: string) =>
    setEscopos((atual) => (atual.includes(e) ? atual.filter((x) => x !== e) : [...atual, e]));

  const gerar = async () => {
    if (!imobiliariaId || !expiraEm) {
      setToast(tk.provideAgencyExpiry);
      setTimeout(() => setToast(null), 3000);
      return;
    }
    if (escopos.length === 0) {
      setToast(tk.selectScope);
      setTimeout(() => setToast(null), 3000);
      return;
    }
    try {
      const criada = await criar.mutateAsync({
        imobiliariaId,
        escopos,
        expiraEm: new Date(expiraEm).toISOString(),
        idempotencyKey,
      });
      setNovaChave(criada);
      setCopiado(false);
      setImobiliariaId('');
      setExpiraEm('');
      setModalAberto(false);
    } catch (e: any) {
      setToast(e?.message || tk.createError);
      setTimeout(() => setToast(null), 3500);
    }
  };

  const copiar = async () => {
    if (!novaChave) return;
    if (await copyText(novaChave.apiKey)) {
      setCopiado(true);
    } else {
      setToast(tk.copyFailed);
      setTimeout(() => setToast(null), 3500);
    }
  };

  const revogarChave = async (id: string) => {
    try {
      await revogar.mutateAsync(id);
      setToast(tk.revoked);
    } catch (e: any) {
      setToast(e?.message || tk.revokeError);
    }
    setTimeout(() => setToast(null), 3000);
  };

  return (
    <div className="apikeys-container">
      <div className="apikeys-header">
        <div>
          <InfoHint title={t.nav.config.apiKeys}>
            <p>{tk.hintBody}</p>
          </InfoHint>
        </div>
        <Button variant="accent" size="md" onClick={abrirModal}><Icon name="plus" size={14} /> {tk.newKey}</Button>
      </div>

      {novaChave && (
        <Card>
          <div className="apikeys-nova" role="alert">
            <p className="apikeys-nova-titulo">{tk.createdTitle}</p>
            <code className="apikeys-nova-valor">{novaChave.apiKey}</code>
            <div className="apikeys-nova-acoes">
              <Button size="sm" variant="primary" onClick={copiar}>
                {copiado ? tk.copied : tk.copy}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setNovaChave(null)}>{tk.close}</Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        {lista.isLoading && <p className="apikeys-empty">{tk.loading}</p>}
        {lista.error && <p className="apikeys-empty">{tk.loadError}</p>}
        {!lista.isLoading && !lista.error && chaves.length === 0 && (
          <p className="apikeys-empty">{tk.empty}</p>
        )}
        {chaves.length > 0 && (
          <div className="apikeys-list">
            {chaves.map((k) => (
              <div key={k.id} className="apikeys-row">
                <span className="apikeys-prefix">{k.mascara}</span>
                <span className="apikeys-imob">{nomeImob(k.imobiliariaId)}</span>
                <span className="apikeys-scopes">{k.escopos.join(' · ') || '—'}</span>
                <span className="apikeys-meta">
                  {fmt(tk.metaCreatedExpires, {
                    criada: new Date(k.criadoEm).toLocaleDateString('pt-BR'),
                    expira: new Date(k.expiraEm).toLocaleDateString('pt-BR'),
                  })}
                </span>
                <span>
                  {k.revogado ? <Badge tone="gray">{tk.statusRevoked}</Badge>
                    : k.expirada ? <Badge tone="red">{tk.statusExpired}</Badge>
                    : <Badge tone="ink">{tk.statusActive}</Badge>}
                </span>
                <span>
                  {!k.revogado && (
                    <Button size="sm" variant="secondary" disabled={revogar.isPending}
                      onClick={() => revogarChave(k.id)}>
                      {tk.revoke}
                    </Button>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Dialog
        isOpen={modalAberto}
        onClose={() => setModalAberto(false)}
        title={tk.dialogTitle}
        actions={
          <>
            <Button variant="secondary" size="md" onClick={() => setModalAberto(false)}>{t.common.cancel}</Button>
            <Button variant="primary" size="md" onClick={gerar} disabled={criar.isPending}>
              {criar.isPending ? tk.generating : tk.generate}
            </Button>
          </>
        }
      >
        <div className="apikeys-form">
          <label className="apikeys-field">
            <span>{tk.agencyLabel}</span>
            <select
              className="form-select"
              aria-label={tk.agencyLabel}
              value={imobiliariaId}
              onChange={(e) => setImobiliariaId(e.target.value)}
            >
              <option value="">{tk.agencyPlaceholder}</option>
              {imobiliarias.map((i) => (
                <option key={i.id} value={i.id}>{i.nomeFantasia || i.razaoSocial}</option>
              ))}
            </select>
          </label>
          <Input
            label={tk.expiresLabel}
            aria-label={tk.expiresAria}
            type="date"
            value={expiraEm}
            onChange={(e) => setExpiraEm(e.target.value)}
          />
          <fieldset className="apikeys-escopos">
            <legend>{tk.scopesLegend}</legend>
            {ESCOPOS.map((e) => (
              <label key={e} className="apikeys-escopo">
                <input type="checkbox" checked={escopos.includes(e)} onChange={() => toggleEscopo(e)} />
                <span>{e}</span>
              </label>
            ))}
          </fieldset>
        </div>
      </Dialog>
    </div>
  );
};
