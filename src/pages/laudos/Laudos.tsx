import React from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Card, Badge, Tabs, Dialog } from '../../components/shared/DataDisplay';
import { InfoHint } from '../../components/shared/InfoHint';
import { Icon } from '../../components/shared/Icon';
import { ListTableFooter } from '../../components/shared/ListTableFooter';
import {
  useLaudos,
  useRequestSignature,
  useLaudoAssinantes,
  type LaudoResumo,
  type LaudoOrigem,
} from '../../api/laudos';
import { useCriarContestacao } from '../../api/contestacoes';
import { useTranslation, fmt } from '../../i18n';
import '../../components/shared/FormElements.css';
import '../../components/shared/ListTable.css';
import './Laudos.css';

const PAGE_SIZE = 20;

const STATUS_TONE: Record<LaudoResumo['status'], 'ink' | 'gray' | 'red'> = {
  RASCUNHO: 'gray',
  FINALIZADO: 'red',
  ASSINADO: 'ink',
};

const formatarData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');

const formatarTamanho = (bytes: number | null) => {
  if (!bytes) return null;
  const mb = bytes / (1024 * 1024);
  return `${mb.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;
};

/** Bloco "Solicitar assinatura" — mostra as pessoas já gravadas na solicitação. */
const AssinaturaBloco: React.FC<{ laudoId: string }> = ({ laudoId }) => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tl = t.laudos;
  const { data: assinantes = [], isLoading } = useLaudoAssinantes(laudoId);
  const requestSignature = useRequestSignature();

  const solicitar = async () => {
    try {
      await requestSignature.mutateAsync({ tipo: 'laudo', id: laudoId });
      setToast(fmt(tl.signatureSent, { id: laudoId }));
    } catch (error) {
      const message = error instanceof Error ? error.message : tl.signatureError;
      setToast(fmt(tl.errorPrefix, { message }));
    }
  };

  return (
    <>
      {assinantes.length > 0 ? (
        <p className="laudo-details">
          {fmt(tl.signersPrefix, {
            lista: assinantes.map((a) => fmt(tl.signerFormat, { nome: a.nome, papel: a.papel })).join(', '),
          })}
        </p>
      ) : (
        <p className="laudo-details">
          {isLoading ? tl.loadingSigners : tl.noInterveners}
        </p>
      )}
      <Button
        variant="primary"
        size="sm"
        onClick={solicitar}
        disabled={requestSignature.isPending || assinantes.length === 0}
      >
        {requestSignature.isPending ? tl.sending : tl.requestSignature}
      </Button>
    </>
  );
};

type OrigemFiltro = '' | LaudoOrigem;

export const Laudos: React.FC = () => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tl = t.laudos;
  const STATUS_LABEL = tl.statusLabels as Record<LaudoResumo['status'], string>;
  const [origemFiltro, setOrigemFiltro] = React.useState<OrigemFiltro>('');
  const [contestando, setContestando] = React.useState<LaudoResumo | null>(null);
  const [contestacaoTexto, setContestacaoTexto] = React.useState('');
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(0);

  React.useEffect(() => { setPage(0); }, [origemFiltro]);

  const { data, isLoading, error, isFetching } = useLaudos({
    origem: origemFiltro || undefined,
    page,
    size: PAGE_SIZE,
  });
  const criarContestacao = useCriarContestacao();

  const ORIGEM_TABS = [
    { id: '', label: tl.originFilterAll },
    { id: 'gerado_internamente', label: tl.originFilterInternal },
    { id: 'importado_pleno', label: tl.originFilterPleno },
  ];

  const laudos = data?.content ?? [];
  const totalPages = data?.totalPages ?? 0;
  const totalElements = data?.totalElements ?? laudos.length;

  React.useEffect(() => {
    if (page > 0 && totalPages > 0 && page >= totalPages) setPage(0);
  }, [page, totalPages]);

  const handleDownloadPDF = (laudo: LaudoResumo) => {
    if (!laudo.arquivoTamanho) {
      setToast(tl.pdfNotGenerated);
      return;
    }
    setToast(fmt(tl.pdfDownloaded, { id: laudo.id }));
  };

  const handleDownloadZIP = (laudoId: string) => {
    setToast(fmt(tl.zipDownloaded, { id: laudoId }));
  };

  const handleViewSignatures = (laudoId: string) => {
    setToast(fmt(tl.signaturesLoaded, { id: laudoId }));
  };

  const abrirContestacao = (laudo: LaudoResumo) => {
    setContestando(laudo);
    setContestacaoTexto('');
  };

  const fecharContestacao = () => {
    setContestando(null);
    setContestacaoTexto('');
  };

  const enviarContestacao = async () => {
    if (!contestando) return;
    const texto = contestacaoTexto.trim();
    if (!texto) {
      setToast(tl.contestFillText);
      return;
    }
    try {
      await criarContestacao.mutateAsync({ laudoId: contestando.id, texto });
      fecharContestacao();
      setToast(fmt(tl.contestSent, { id: contestando.id }));
    } catch (e) {
      const message = e instanceof Error ? e.message : tl.contestError;
      setToast(fmt(tl.errorPrefix, { message }));
    }
  };

  const handleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const metaLinha = (laudo: LaudoResumo) => {
    const tamanho = formatarTamanho(laudo.arquivoTamanho);
    const fotos = laudo.fotosCount === 1 ? tl.photoCountOne : fmt(tl.photoCountMany, { n: laudo.fotosCount });
    return [tamanho, fotos].filter(Boolean).join(' · ');
  };

  return (
    <div className="laudos-container">
      <div className="laudos-header">
        <div>
          <InfoHint title={tl.hintTitle}>
            <p>{tl.hintBody}</p>
          </InfoHint>
        </div>
      </div>

      <Tabs
        tabs={ORIGEM_TABS}
        activeTab={origemFiltro}
        onTabChange={(id) => setOrigemFiltro(id as OrigemFiltro)}
        className="laudos-origem-tabs"
      />

      <Card>
        <div className="list-table" style={{ ['--list-table-cols' as string]: 'minmax(0, 2fr) 1.2fr 1fr' }}>
          <div className="list-table-header">
            <div>{tl.colLaudo}</div>
            <div>{tl.colDate}</div>
            <div>{tl.colStatus}</div>
          </div>

          {isLoading && (
            <div className="list-table-empty">
              <p>{tl.loading}</p>
            </div>
          )}
          {error && (
            <div className="list-table-empty list-table-empty--erro">
              <p>{tl.loadError}</p>
            </div>
          )}
          {!isLoading && !error && laudos.length === 0 && (
            <div className="list-table-empty">
              <p>{tl.empty}</p>
            </div>
          )}

          {!isLoading && !error && laudos.map((laudo) => {
            const entrega = formatarData(laudo.assinadoEm ?? laudo.criadoEm);
            const aberto = expandedId === laudo.id;
            return (
              <React.Fragment key={laudo.id}>
                <div
                  className="list-table-row list-table-row--clickable laudo-row laudo-card"
                  onClick={() => handleExpand(laudo.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleExpand(laudo.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-expanded={aberto}
                >
                  <div className="list-table-title">
                    <div className="list-table-name">{fmt(tl.laudoTitle, { id: laudo.id, versao: laudo.versao })}</div>
                    <div className="list-table-sub">{metaLinha(laudo)}</div>
                  </div>
                  <div className="list-table-col list-table-text" data-label={tl.colDate}>{entrega}</div>
                  <div className="list-table-end list-table-col" data-label={tl.colStatus}>
                    {laudo.origem === 'importado_pleno' && (
                      <Badge tone="outline">{tl.originBadgeLabel}</Badge>
                    )}
                    <Badge tone={STATUS_TONE[laudo.status]}>{STATUS_LABEL[laudo.status]}</Badge>
                    <span
                      className={`laudo-chevron${aberto ? ' laudo-chevron--open' : ''}`}
                      aria-hidden="true"
                    >
                      <Icon name={aberto ? 'chevron-up' : 'chevron-down'} size={14} />
                    </span>
                  </div>
                </div>

                {aberto && (
                  <div className="list-table-detail laudo-detail" onClick={(e) => e.stopPropagation()}>
                    {laudo.status === 'FINALIZADO' && (
                      <>
                        <AssinaturaBloco laudoId={laudo.id} />
                        <div className="laudo-action-group">
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadPDF(laudo)}>
                            {tl.openPdf}
                          </Button>
                          <span className="laudo-separator">·</span>
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadPDF(laudo)}>
                            {tl.downloadPdf}
                          </Button>
                          <span className="laudo-separator">·</span>
                          <Button variant="ghost" size="sm" onClick={() => abrirContestacao(laudo)}>
                            {tl.contest}
                          </Button>
                        </div>
                        <div className="laudo-warning">{tl.unsignedWarning}</div>
                      </>
                    )}

                    {laudo.status === 'ASSINADO' && (
                      <div className="laudo-action-group">
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadPDF(laudo)}>
                          {tl.openPdf}
                        </Button>
                        <span className="laudo-separator">·</span>
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadPDF(laudo)}>
                          {tl.downloadPdf}
                        </Button>
                        <span className="laudo-separator">·</span>
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadZIP(laudo.id)}>
                          {tl.downloadZip}
                        </Button>
                        <span className="laudo-separator">·</span>
                        <Button variant="ghost" size="sm" onClick={() => handleViewSignatures(laudo.id)}>
                          {tl.viewSignatures}
                        </Button>
                        <span className="laudo-separator">·</span>
                        <Button variant="ghost" size="sm" onClick={() => abrirContestacao(laudo)}>
                          {tl.contest}
                        </Button>
                      </div>
                    )}

                    {laudo.status === 'RASCUNHO' && (
                      <p className="laudo-details">{tl.draftHint}</p>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </Card>

      {!isLoading && !error && (
        <ListTableFooter
          shown={laudos.length}
          total={totalElements}
          page={page}
          totalPages={totalPages}
          countLabel={fmt(tl.footerCount, { shown: laudos.length, total: totalElements })}
          isFetching={isFetching}
          onPage={setPage}
        />
      )}

      <Dialog
        isOpen={contestando !== null}
        onClose={fecharContestacao}
        title={contestando ? fmt(tl.contestTitle, { id: contestando.id }) : tl.contest}
        actions={
          <>
            <Button variant="ghost" size="md" onClick={fecharContestacao}>
              {t.common.cancel}
            </Button>
            <Button
              variant="accent"
              size="md"
              onClick={enviarContestacao}
              disabled={criarContestacao.isPending}
            >
              {criarContestacao.isPending ? tl.contestSending : tl.contestSubmit}
            </Button>
          </>
        }
      >
        <p className="laudo-contest-hint">{tl.contestHint}</p>
        <div className="form-group">
          <label className="form-label" htmlFor="laudo-contest-texto">{tl.contestTextLabel}</label>
          <textarea
            id="laudo-contest-texto"
            className="form-input laudo-contest-texto"
            rows={5}
            placeholder={tl.contestPlaceholder}
            value={contestacaoTexto}
            onChange={(e) => setContestacaoTexto(e.target.value)}
          />
        </div>
      </Dialog>
    </div>
  );
};
