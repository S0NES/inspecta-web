import React, { useEffect, useState } from 'react';
import { Tabs } from '../../components/shared/DataDisplay';
import { Input } from '../../components/shared/Input';
import { InfoHint } from '../../components/shared/InfoHint';
import { FilterPopover } from '../../components/shared/FilterPopover';
import { FieldHint } from '../../components/shared/FieldHint';
import { useTranslation, fmt } from '../../i18n';
import { useIntegracoesConfig } from '../../api/integracoes';
import { PAYMENT_PROVIDERS, SIGNATURE_PROVIDERS, PLENO_STATUS_OPTIONS } from './registry';
import { PlenoTab } from './tabs/PlenoTab';
import { PaymentTab } from './tabs/PaymentTab';
import { SignatureTab } from './tabs/SignatureTab';
import './Integracoes.css';

type TabId = 'pleno' | 'payment' | 'signature';

const FALLBACK = { payment: 'mock', signature: 'mock', pleno: 'mock' };

/**
 * Painel de integrações: mostra sucesso / pendência / erro de cada sistema (Pleno, pagamento,
 * assinatura) para debug. O provedor ativo de pagamento e de assinatura vem do backend
 * (`GET /v1/integracoes/config`); cada aba genérica (`<PaymentTab>` / `<SignatureTab>`) faz o
 * inspecta-messenger por nome para o componente concreto. Só o Pleno tem aba dedicada.
 */
export const Integracoes: React.FC = () => {
  const { t } = useTranslation();
  const tp = t.integracoes;

  const cfgQuery = useIntegracoesConfig();
  const cfg = cfgQuery.data ?? FALLBACK;

  const [tab, setTab] = useState<TabId>('pleno');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setQ(searchInput), 350);
    return () => clearTimeout(id);
  }, [searchInput]);

  // Cada integração tem vocabulário de status próprio — zera os filtros ao trocar de aba.
  useEffect(() => {
    setStatus('');
    setSearchInput('');
    setQ('');
  }, [tab]);

  const paymentProvider = PAYMENT_PROVIDERS[cfg.payment];
  const signatureProvider = SIGNATURE_PROVIDERS[cfg.signature];

  // Só entram as abas de provedor efetivamente configurado — provedor "mock"/desconhecido
  // não aparece.
  const tabs = [
    { id: 'pleno' as const, label: tp.tabs.pleno },
    ...(paymentProvider ? [{ id: 'payment' as const, label: paymentProvider.label }] : []),
    ...(signatureProvider ? [{ id: 'signature' as const, label: signatureProvider.label }] : []),
  ];
  const activeTab: TabId = tabs.some((x) => x.id === tab) ? tab : 'pleno';

  // Provedores que o backend não resolveu (mock/desconhecido) — sem aba, listados no aviso.
  const provedoresFaltando = [
    !signatureProvider ? tp.providerKinds.signature : null,
    !paymentProvider ? tp.providerKinds.payment : null,
  ].filter((x): x is string => x !== null);

  const statusOptions =
    activeTab === 'pleno'
      ? PLENO_STATUS_OPTIONS
      : activeTab === 'payment'
        ? (paymentProvider?.statusOptions ?? [])
        : (signatureProvider?.statusOptions ?? []);

  const activeCount = (q ? 1 : 0) + (status ? 1 : 0);
  const limpar = () => {
    setStatus('');
    setSearchInput('');
    setQ('');
  };

  return (
    <div className="intg-container">
      <div className="intg-header">
        <div className="intg-title">
          <InfoHint title={tp.pageTitle}>
            <p>{tp.hintP1}</p>
          </InfoHint>
          {provedoresFaltando.length > 0 && (
            <FieldHint tone="error" label={tp.configErrorLabel}>
              {fmt(tp.configError, { lista: provedoresFaltando.join(', ') })}
            </FieldHint>
          )}
        </div>

        <FilterPopover activeCount={activeCount} onClear={limpar}>
          <div className="filter-group">
            <span className="filter-group-label">{tp.searchLabel}</span>
            <Input
              type="search"
              placeholder={tp.searchPlaceholder}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          {statusOptions.length > 0 && (
            <div className="filter-group">
              <span className="filter-group-label">{tp.filterStatus}</span>
              <div className="filter-group-chips">
                {statusOptions.map((f) => (
                  <button
                    key={f.value || 'todos'}
                    type="button"
                    className={`filter-chip ${status === f.value ? 'filter-chip--active' : ''}`}
                    onClick={() => setStatus(f.value)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </FilterPopover>
      </div>

      <Tabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={(id) => setTab(id as TabId)}
      />

      {activeTab === 'pleno' && <PlenoTab status={status} q={q} />}
      {activeTab === 'payment' && paymentProvider && (
        <PaymentTab name={cfg.payment} status={status} q={q} />
      )}
      {activeTab === 'signature' && signatureProvider && (
        <SignatureTab name={cfg.signature} status={status} q={q} />
      )}
    </div>
  );
};
