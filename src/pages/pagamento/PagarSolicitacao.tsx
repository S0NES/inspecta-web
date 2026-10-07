import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Card } from '../../components/shared/DataDisplay';
import { CheckoutHospedado } from '../../components/shared/CheckoutHospedado';
import { useCobranca, useCriarCobranca, useCriarPix } from '../../api/pagamento';
import { useTranslation, fmt } from '../../i18n';
import './Pagamento.css';

/**
 * Tela de pagamento (`/solicitacoes/:id/pagar`), logo após o wizard B2C.
 *
 * Fluxo principal: PIX transparente — a própria Inspecta exibe o QR Code e o copia-e-cola, acompanha
 * a confirmação por polling e avisa quando cair o pagamento. O PIX é pedido automaticamente ao abrir
 * a tela (uma vez); expirado, o cliente gera outro.
 *
 * Alternativa: cartão pelo checkout hospedado do provedor (CheckoutHospedado). O AbacatePay não expõe
 * cartão transparente nem embed, então ele abre em nova janela e esta tela confirma por polling.
 *
 * Os dados vêm de `GET /v1/solicitacoes/{id}/pagamento` (useCobranca). A solicitação alvo vem da
 * rota (`useParams`).
 */
/** mm:ss restante até `expiraEm`; 0 quando já passou. */
const restanteMs = (expiraEm: string | null | undefined, agora: number): number =>
  expiraEm ? Math.max(0, new Date(expiraEm).getTime() - agora) : 0;

const formatarRestante = (ms: number): string => {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const PagarSolicitacao: React.FC = () => {
  const { setToast, role } = useAppStore();
  const { t } = useTranslation();
  const tp = t.payment.pagar;
  const navigate = useNavigate();
  const { id } = useParams();
  const cobrancaAlvoId = id ?? null;
  const cobranca = useCobranca(cobrancaAlvoId ?? undefined);
  const criarCobranca = useCriarCobranca();
  const criarPix = useCriarPix();
  const [agora, setAgora] = useState(() => Date.now());
  const pixAutoPedido = useRef(false);

  const checkoutUrl = cobranca.data?.checkoutUrl ?? null;
  const pago = cobranca.data?.status === 'pago' || cobranca.data?.paymentStatus === 'pago';
  const pixBrCode = cobranca.data?.pixBrCode ?? null;
  const pixQr = cobranca.data?.pixQrCodeBase64 ?? null;
  const pixExpiraEm = cobranca.data?.pixExpiraEm ?? null;
  const pixRestante = restanteMs(pixExpiraEm, agora);
  const pixExpirado = !!pixBrCode && pixRestante <= 0;
  const pixAtivo = !!pixBrCode && !pixExpirado;

  // Relógio do contador do PIX (só enquanto há PIX vigente).
  useEffect(() => {
    if (!pixAtivo || pago) return;
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pixAtivo, pago]);

  // O PIX é gerado de forma assíncrona (202). Até o QR chegar, `useCobranca` pode devolver um estado sem
  // status (cobrança ainda não gravada) e parar de reconsultar — então a tela mesma insiste a cada 3 s.
  const aguardandoPix = criarPix.isSuccess && !pixAtivo && !pago;
  const refetchCobranca = cobranca.refetch;
  useEffect(() => {
    if (!aguardandoPix) return;
    const timer = setInterval(() => { void refetchCobranca?.(); }, 3000);
    return () => clearInterval(timer);
  }, [aguardandoPix, refetchCobranca]);

  const pedirPix = async () => {
    if (!cobrancaAlvoId) return;
    try {
      await criarPix.mutateAsync(cobrancaAlvoId);
    } catch (e) {
      setToast(e instanceof Error ? e.message : tp.pixError);
      setTimeout(() => setToast(null), 4000);
    }
  };

  // Pede o PIX uma única vez ao abrir a tela (sem PIX vigente e ainda não pago).
  useEffect(() => {
    if (!cobrancaAlvoId || cobranca.isLoading || pago || pixAutoPedido.current) return;
    if (pixAtivo) return;
    pixAutoPedido.current = true;
    void pedirPix();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cobrancaAlvoId, cobranca.isLoading, pago, pixAtivo]);

  // `/requests` e `/inspections/:id` são rotas B2B — um perfil `cliente` (Página 4 do
  // wizard B2C, `/solicitar` → aqui) não tem acesso e cairia em 404/blocked. Para esse
  // perfil, os três destinos "voltar para a lista"/"ver solicitação" caem no Painel, o
  // único destino que o bucket `cliente` sempre enxerga (ver `navigation.ts`).
  const isCliente = role === 'cliente';
  const destinoLista = isCliente ? '/dashboard' : '/requests';
  const voltar = () => navigate(cobrancaAlvoId ? destinoLista : '/dashboard');
  const verSolicitacao = () => {
    if (!cobrancaAlvoId) return;
    navigate(isCliente ? '/dashboard' : `/inspections/${cobrancaAlvoId}`);
  };

  const copiarCodigo = async () => {
    if (!pixBrCode) return;
    try {
      await navigator.clipboard.writeText(pixBrCode);
      setToast(tp.pixCopied);
    } catch {
      setToast(tp.pixCopyError);
    }
    setTimeout(() => setToast(null), 3000);
  };

  const gerarCobranca = async () => {
    if (!cobrancaAlvoId) return;
    try {
      await criarCobranca.mutateAsync(cobrancaAlvoId);
      setToast(tp.genToast);
      setTimeout(() => setToast(null), 4000);
    } catch (e) {
      setToast(e instanceof Error ? e.message : tp.genError);
      setTimeout(() => setToast(null), 4000);
    }
  };

  if (!cobrancaAlvoId) {
    return (
      <div className="pagamento-page">
        <Card className="pagamento-card">
          <h1 className="type-h1-page">{t.payment.title}</h1>
          <p className="pagamento-subtitle">{tp.noRequestSelected}</p>
          <div className="pagamento-actions">
            <Button variant="primary" onClick={() => navigate(destinoLista)}>
              {t.payment.viewRequests}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="pagamento-page">
      <div className="pagamento-header">
        <div>
          <h1 className="type-h1-page">{t.payment.title}</h1>
          <p className="pagamento-subtitle">{fmt(t.payment.requestSolLabel, { id: cobrancaAlvoId })}</p>
        </div>
        <Button variant="ghost" size="md" onClick={voltar}>
          {t.common.back}
        </Button>
      </div>

      <Card className="pagamento-card">
        {cobranca.isLoading && <p className="pagamento-spinner">{tp.loadingCheckout}</p>}

        {!cobranca.isLoading && pago && (
          <>
            <p className="pagamento-subtitle">{tp.alreadyPaid}</p>
            <div className="pagamento-actions">
              <Button variant="primary" onClick={verSolicitacao}>{t.payment.viewRequest}</Button>
            </div>
          </>
        )}

        {!cobranca.isLoading && !pago && (
          <section className="pagamento-pix" aria-labelledby="pagamento-pix-titulo">
            <h2 id="pagamento-pix-titulo" className="pagamento-section-title">{tp.pixTitle}</h2>

            {pixAtivo && (
              <>
                <p className="pagamento-subtitle">{tp.pixInstructions}</p>
                <div className="pagamento-pix-body">
                  {pixQr && (
                    <img className="pagamento-pix-qr" src={pixQr} alt={tp.pixQrAlt} width={220} height={220} />
                  )}
                  <div className="pagamento-pix-code">
                    <label className="pagamento-pix-code-label" htmlFor="pix-copia-cola">{tp.pixCode}</label>
                    <textarea
                      id="pix-copia-cola"
                      className="pagamento-pix-code-text"
                      readOnly
                      rows={4}
                      value={pixBrCode ?? ''}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <div className="pagamento-actions">
                      <Button variant="primary" onClick={copiarCodigo}>{tp.pixCopy}</Button>
                    </div>
                    <p className="pagamento-pix-meta" role="timer" aria-live="off">
                      {fmt(tp.pixExpiresIn, { tempo: formatarRestante(pixRestante) })}
                    </p>
                    <p className="pagamento-pix-meta" role="status">{tp.pixWaiting}</p>
                  </div>
                </div>
              </>
            )}

            {pixExpirado && (
              <>
                <p className="pagamento-warn" role="status">{tp.pixExpired}</p>
                <div className="pagamento-actions">
                  <Button variant="primary" onClick={pedirPix} disabled={criarPix.isPending}>
                    {criarPix.isPending ? tp.pixGenerating : tp.pixRegenerate}
                  </Button>
                </div>
              </>
            )}

            {!pixBrCode && !criarPix.isError && (
              <p className="pagamento-spinner" role="status">{tp.pixGenerating}</p>
            )}

            {!pixBrCode && criarPix.isError && (
              <>
                <p className="pagamento-warn" role="alert">{tp.pixError}</p>
                <div className="pagamento-actions">
                  <Button variant="primary" onClick={pedirPix} disabled={criarPix.isPending}>
                    {tp.pixRegenerate}
                  </Button>
                </div>
              </>
            )}
          </section>
        )}

        {!cobranca.isLoading && !pago && (
          <section className="pagamento-cartao" aria-labelledby="pagamento-cartao-titulo">
            <h2 id="pagamento-cartao-titulo" className="pagamento-section-title pagamento-section-title--sm">{tp.cardTitle}</h2>

            {!checkoutUrl && (
              <div className="pagamento-actions">
                <Button variant="secondary" onClick={gerarCobranca} disabled={criarCobranca.isPending}>
                  {criarCobranca.isPending ? tp.generating : tp.payWithCard}
                </Button>
              </div>
            )}

            {checkoutUrl && <CheckoutHospedado url={checkoutUrl} />}
          </section>
        )}
      </Card>
    </div>
  );
};
