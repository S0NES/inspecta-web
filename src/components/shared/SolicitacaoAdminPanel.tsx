import React, { useState } from 'react';
import { Card, Badge } from './DataDisplay';
import { Button } from './Button';
import { Input } from './Input';
import { useCobranca, useCriarCobranca } from '../../api/pagamento';
import { PagarCta } from './PagarCta';
import { Icon } from './Icon';
import { useSolicitacaoServicos, useReatribuir } from '../../api/solicitacoes';
import { useTranslation, fmt } from '../../i18n';
import './SolicitacaoAdminPanel.css';

const cobrancaTone = (s: string | null): 'ink' | 'gray' | 'red' | 'outline' =>
  s === 'pago' ? 'ink' : s === 'falhou' ? 'red' : s === 'pendente' || s === 'criando' ? 'gray' : 'outline';

/**
 * Bloco de administração de uma solicitação (só admin/suporte): acompanhamento da
 * cobrança (pendencias.md § 1) e reatribuição de vistoriador por serviço
 * (pendencias.md § 5). Toda ação é assíncrona no backend.
 */
export const SolicitacaoAdminPanel: React.FC<{ solicitacaoId: string; onToast: (m: string) => void }> = ({
  solicitacaoId,
  onToast,
}) => {
  const { t } = useTranslation();
  const ta = t.components.solicitacaoAdminPanel;
  const COBRANCA_LABEL: Record<string, string> = ta.cobrancaLabels;
  const cobranca = useCobranca(solicitacaoId);
  const criarCobranca = useCriarCobranca();
  const servicos = useSolicitacaoServicos(solicitacaoId);
  const reatribuir = useReatribuir();

  const [motivoPor, setMotivoPor] = useState<Record<string, string>>({});

  const gerarCobranca = async () => {
    try {
      await criarCobranca.mutateAsync(solicitacaoId);
      onToast(cobranca.data?.checkoutUrl ? ta.linkResent : ta.chargeCreated);
    } catch (e: any) {
      onToast(e?.message || ta.chargeError);
    }
  };

  const fazerReatribuicao = async (servicoId: string, vistoriadorAtual: string | null) => {
    const motivo = (motivoPor[servicoId] ?? '').trim();
    if (!motivo) { onToast(ta.reasonRequired); return; }
    try {
      await reatribuir.mutateAsync({ servicoId, motivo, vistoriadorAtual });
      onToast(ta.reassignQueued);
      setMotivoPor((m) => ({ ...m, [servicoId]: '' }));
    } catch (e: any) {
      onToast(e?.message || ta.reassignError);
    }
  };

  const c = cobranca.data;

  return (
    <Card>
      <div className="sap-block">
        <h3 className="sap-title">{ta.chargeTitle}</h3>
        {cobranca.isLoading ? (
          <p className="sap-text">{t.common.loading}</p>
        ) : (
          <div className="sap-cobranca">
            <Badge tone={cobrancaTone(c?.status ?? null)}>
              {c?.status ? COBRANCA_LABEL[c.status] ?? c.status : ta.noCharge}
            </Badge>
            {c?.checkoutUrl && (
              <a className="sap-link" href={c.checkoutUrl} target="_blank" rel="noopener noreferrer">
                {ta.openCheckout} <Icon name="external-link" size={13} />
              </a>
            )}
            <PagarCta
              solicitacaoId={solicitacaoId}
              checkoutUrl={c?.checkoutUrl}
              paymentStatus={c?.paymentStatus ?? c?.status}
            />
            <Button size="sm" variant="secondary" disabled={criarCobranca.isPending} onClick={gerarCobranca}>
              {c?.checkoutUrl ? ta.resendLink : ta.generateCharge}
            </Button>
          </div>
        )}
      </div>

      <div className="sap-block">
        <h3 className="sap-title">{ta.reassignTitle}</h3>
        {servicos.isLoading && <p className="sap-text">{ta.loadingServices}</p>}
        {!servicos.isLoading && (servicos.data ?? []).length === 0 && (
          <p className="sap-text">{ta.noServices}</p>
        )}
        {(servicos.data ?? []).map((s) => (
          <div key={s.id} className="sap-servico">
            <div className="sap-servico-meta">
              <span className="sap-mono">{fmt(ta.serviceMono, { id: s.id })}</span>
              <Badge tone="outline">{s.status}</Badge>
              <span className="sap-mono">
                {s.vistoriadorId ? fmt(ta.inspectorMono, { id: s.vistoriadorId }) : ta.noInspector}
              </span>
            </div>
            <div className="sap-servico-acao">
              <Input
                aria-label={fmt(ta.reasonAria, { id: s.id })}
                placeholder={ta.reasonPlaceholder}
                value={motivoPor[s.id] ?? ''}
                onChange={(e) => setMotivoPor((m) => ({ ...m, [s.id]: e.target.value }))}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={reatribuir.isPending}
                onClick={() => fazerReatribuicao(s.id, s.vistoriadorId)}
              >
                {ta.reassign}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
