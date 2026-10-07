import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Badge, Card, Dialog } from '../../components/shared/DataDisplay';
import { CheckoutHospedado } from '../../components/shared/CheckoutHospedado';
import { Table, type TableColumn } from '../../components/shared/Table';
import {
  useExtratoItens,
  useFaturas,
  useGerarFaturaConsolidada,
  type FaturaConsolidada,
  type FaturaConsolidadaStatus,
} from '../../api/extrato';
import { ApiError } from '../../api/client';
import { useTranslation, fmt } from '../../i18n';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** `YYYY-MM-DD` puro (sem hora) — o backend trata período como data local. */
const fmtDataPura = (s: string) => {
  const [y, m, d] = s.split('-');
  return y && m && d ? `${d}/${m}/${y}` : s;
};

/** Primeiro e último dia do mês `YYYY-MM`. */
export const periodoDoMes = (mes: string): { inicio: string; fim: string } => {
  const [y, m] = mes.split('-').map(Number);
  const ultimo = new Date(y, m, 0).getDate();
  return { inicio: `${mes}-01`, fim: `${mes}-${String(ultimo).padStart(2, '0')}` };
};

const STATUS_TONE: Record<FaturaConsolidadaStatus, 'ink' | 'gray' | 'outline' | 'red'> = {
  pendente: 'gray',
  checkout_ready: 'outline',
  pago: 'ink',
  erro: 'red',
};

interface Props {
  imobiliariaId: string;
  /** Mês `YYYY-MM` selecionado no Extrato. */
  mes: string;
  /** "Hoje" — injetável nos testes. */
  hoje?: Date;
}

const isoLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Primeiro dia do mês seguinte a `fim` (`YYYY-MM-DD`), no formato dd/mm/aaaa. */
const diaDeLiberacao = (fim: string) => {
  const [y, m, d] = fim.split('-').map(Number);
  return fmtDataPura(isoLocal(new Date(y, m - 1, d + 1)));
};

/**
 * Fatura consolidada B2B (pós-paga). É o compilado MENSAL do extrato: cada serviço lançado é uma
 * linha e, encerrado o mês, as linhas viram uma única fatura (uma por imobiliária/mês), paga pelo
 * link do provedor. Enquanto o mês está aberto o painel só mostra o acumulado. O histórico mostra o estado de cada fatura (checkout em preparo → aguardando
 * pagamento → paga) e o link de pagamento quando pronto.
 */
export const FaturasPanel: React.FC<Props> = ({ imobiliariaId, mes, hoje = new Date() }) => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tf = t.extrato.faturas;

  const { inicio, fim } = useMemo(() => periodoDoMes(mes), [mes]);
  const itens = useExtratoItens(imobiliariaId, inicio, fim);
  const faturas = useFaturas(imobiliariaId);
  const gerar = useGerarFaturaConsolidada(imobiliariaId);

  const abertos = itens.data ?? [];
  const totalAberto = abertos.reduce((acc, i) => acc + (Number(i.valor) || 0), 0);
  const lista = faturas.data ?? [];

  // Mês encerrado = hoje já passou do último dia. Antes disso itens ainda podem chegar.
  const mesAberto = isoLocal(hoje) <= fim;
  const faturaDoMes = lista.find((f) => f.periodoInicio === inicio && f.periodoFim === fim);
  const podeGerar = !mesAberto && !faturaDoMes && abertos.length > 0 && !gerar.isPending;
  const dica = mesAberto
    ? fmt(tf.monthOpenHint, { mes: `${fmtDataPura(inicio)} – ${fmtDataPura(fim)}`, data: diaDeLiberacao(fim) })
    : faturaDoMes
      ? tf.monthHasInvoice
      : null;

  // Checkout é preparado de forma assíncrona (inspecta-worker): enquanto houver fatura "pendente", reconsulta.
  const [pagandoId, setPagandoId] = useState<string | null>(null);
  const pagando = lista.find((f) => f.id === pagandoId) ?? null;
  const temPendente = lista.some((f) => f.status === 'pendente') || pagando?.status === 'checkout_ready';
  const refetchFaturas = faturas.refetch;
  useEffect(() => {
    if (!temPendente) return;
    const timer = setInterval(() => { void refetchFaturas?.(); }, 3000);
    return () => clearInterval(timer);
  }, [temPendente, refetchFaturas]);

  const handleGerar = async () => {
    try {
      await gerar.mutateAsync({ inicio, fim, idempotencyKey: `fatura-${imobiliariaId}-${inicio}-${fim}` });
      setToast(tf.generated);
    } catch (e) {
      // 409 = já existe fatura para (imobiliária, período) — constraint única; explica em vez de repetir o texto técnico.
      if (e instanceof ApiError && e.status === 409) setToast(tf.alreadyExists);
      else setToast(e instanceof Error ? e.message : tf.generateError);
    }
  };

  const colunas: TableColumn<FaturaConsolidada>[] = [
    {
      key: 'periodo',
      label: tf.colPeriod,
      width: '1.4fr',
      render: (f) => `${fmtDataPura(f.periodoInicio)} – ${fmtDataPura(f.periodoFim)}`,
    },
    { key: 'valorTotal', label: tf.colTotal, width: '1fr', align: 'right', render: (f) => brl(Number(f.valorTotal) || 0) },
    {
      key: 'status',
      label: tf.colStatus,
      width: '1.2fr',
      render: (f) => <Badge tone={STATUS_TONE[f.status] ?? 'gray'}>{tf.statusLabels[f.status] ?? f.status}</Badge>,
    },
    {
      key: 'acao',
      label: tf.colAction,
      width: '1fr',
      align: 'right',
      render: (f) =>
        f.status === 'checkout_ready' && f.checkoutUrl ? (
          <Button variant="primary" size="sm" onClick={() => setPagandoId(f.id)}>
            {tf.pay}
          </Button>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <Card className="extrato-faturas">
      <div className="extrato-faturas-head">
        <h2 className="extrato-faturas-title">{tf.title}</h2>
        <p className="extrato-faturas-subtitle">{tf.subtitle}</p>
      </div>

      <div className="extrato-faturas-resumo">
        <div>
          <div className="extrato-kpi-label">{fmt(tf.openInMonth, { mes: `${fmtDataPura(inicio)} – ${fmtDataPura(fim)}` })}</div>
          <div className="extrato-kpi-value" data-testid="fatura-aberto">
            {itens.isLoading ? '…' : `${abertos.length} · ${brl(totalAberto)}`}
          </div>
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleGerar}
          disabled={!podeGerar}
        >
          {gerar.isPending ? tf.generating : tf.generate}
        </Button>
      </div>

      {dica && <p className="extrato-faturas-subtitle" role="note">{dica}</p>}

      {faturas.isLoading ? (
        <p className="extract-text">{t.extrato.loading}</p>
      ) : (
        <Table<FaturaConsolidada>
          columns={colunas}
          data={lista}
          rowKey={(f) => f.id}
          emptyMessage={tf.empty}
        />
      )}

      <Dialog
        isOpen={!!pagando}
        onClose={() => setPagandoId(null)}
        title={tf.payTitle}
        actions={<Button variant="ghost" onClick={() => setPagandoId(null)}>{tf.payClose}</Button>}
      >
        {pagando && (
          <>
            <p className="extract-text">{fmt(tf.payPeriod, { periodo: `${fmtDataPura(pagando.periodoInicio)} – ${fmtDataPura(pagando.periodoFim)}` })}</p>
            <p className="extract-text">{fmt(tf.payTotal, { valor: brl(Number(pagando.valorTotal) || 0) })}</p>
            {pagando.status === 'pago' ? (
              <p role="status">{tf.payDone}</p>
            ) : (
              pagando.checkoutUrl && <CheckoutHospedado url={pagando.checkoutUrl} />
            )}
          </>
        )}
      </Dialog>
    </Card>
  );
};
