import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Card, Badge } from '../../components/shared/DataDisplay';
import { useUpload } from '../../hooks/useUpload';
import { useSolicitacoes } from '../../api/solicitacoes';
import { useArquivosPorDono } from '../../api/uploads';
import { SolicitacaoAdminPanel } from '../../components/shared/SolicitacaoAdminPanel';
import { PagarCta } from '../../components/shared/PagarCta';
import { Icon } from '../../components/shared/Icon';
import { useTranslation, fmt } from '../../i18n';
import './Detail.css';

/**
 * Ambientes fotografados por vistoria — taxonomia fixa da UI, não dado de negócio.
 * O backend (Arquivo) não marca a qual ambiente uma foto pertence, então essa checklist
 * organiza o fluxo de upload mas não é a fonte de verdade sobre quantas fotos existem —
 * isso vem de `useArquivosPorDono` (real, persistido).
 */
const AMBIENTE_IDS = [
  'sala',
  'cozinha',
  'quarto1',
  'quarto2',
  'banheiro',
  'areaServico',
  'varanda',
  'fachada',
] as const;

interface UploadState {
  isPending: boolean;
  error?: string;
}

export const Detail: React.FC = () => {
  const { inspectionPhotos, addInspectionPhoto, setToast, role } = useAppStore();
  const { t } = useTranslation();
  const tdet = t.detail;
  const ambientes = AMBIENTE_IDS.map((id) => ({ id, label: tdet.environments[id] }));
  const navigate = useNavigate();
  const { id } = useParams();
  const upload = useUpload();
  const queryClient = useQueryClient();
  const [uploadingAmbientes, setUploadingAmbientes] = useState<Record<string, UploadState>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const solicitacaoId = id ?? undefined;

  // GET /v1/solicitacoes já resolve endereço/tipo/vistoriador/data/hora/status/valor
  // (mesmo read model de Requests.tsx e Inspections.tsx) — sem inventar cliente/nome,
  // que o backend não expõe em nenhum endpoint hoje.
  const { data: solicitacoesPage, isLoading: isLoadingSolicitacao } = useSolicitacoes({ size: 100 });
  const inspection = useMemo(
    () => solicitacoesPage?.content.find((s) => s.solicitacaoId === solicitacaoId),
    [solicitacoesPage, solicitacaoId]
  );

  // Fotos já persistidas para esta solicitação — fonte real de "quantas fotos existem".
  const { data: arquivos } = useArquivosPorDono('solicitacao', solicitacaoId);
  const fotosPersistidas = arquivos ?? [];

  const timeline = useMemo(() => {
    const eventos: Array<{ time: string; event: string; type: 'start' | 'photo' }> = fotosPersistidas
      .slice()
      .sort((a, b) => new Date(a.criadoEm).getTime() - new Date(b.criadoEm).getTime())
      .map((a) => ({
        time: new Date(a.criadoEm).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        event: tdet.photoAdded,
        type: 'photo' as const,
      }));
    if (inspection) {
      eventos.unshift({
        time: inspection.hora,
        event: fmt(tdet.scheduledFor, { data: inspection.data }),
        type: 'start' as const,
      });
    }
    return eventos;
  }, [fotosPersistidas, inspection, tdet]);

  if (!solicitacaoId) {
    return (
      <div className="detail-container">
        <div className="detail-empty">
          <p>{tdet.notFound}</p>
          <Button variant="primary" onClick={() => navigate('/requests')}>
            {tdet.backToInspections}
          </Button>
        </div>
      </div>
    );
  }

  if (isLoadingSolicitacao) {
    return (
      <div className="detail-container">
        <div className="detail-empty">
          <p>{tdet.loading}</p>
        </div>
      </div>
    );
  }

  if (!inspection) {
    return (
      <div className="detail-container">
        <div className="detail-empty">
          <p>{tdet.notFound}</p>
          <Button variant="primary" onClick={() => navigate('/requests')}>
            {tdet.backToInspections}
          </Button>
        </div>
      </div>
    );
  }

  // Ambientes com foto marcada nesta sessão — auxílio de organização do upload, não é
  // dado persistido por ambiente (o backend não distingue a qual ambiente uma foto pertence).
  const ambientesComFotos = ambientes.filter((ambiente) => {
    const key = `${inspection.id}-${ambiente.id}`;
    return inspectionPhotos[key] && inspectionPhotos[key].length > 0;
  });

  const todoComplete = ambientesComFotos.length === ambientes.length;

  const handleUploadFile = async (file: File, ambienteId: string, retryCount = 0): Promise<boolean> => {
    const MAX_RETRIES = 2;
    const ambiente = ambientes.find((a) => a.id === ambienteId);

    try {
      setUploadingAmbientes((prev) => ({
        ...prev,
        [ambienteId]: { isPending: true },
      }));

      const result = await upload.mutateAsync({
        file,
        ownerType: 'solicitacao',
        ownerId: solicitacaoId,
      });

      const photoUrl = `foto-${result.arquivoId}`;
      addInspectionPhoto(inspection.id, ambienteId, photoUrl);
      queryClient.invalidateQueries({ queryKey: ['uploads', 'solicitacao', solicitacaoId] });

      setUploadingAmbientes((prev) => ({
        ...prev,
        [ambienteId]: { isPending: false },
      }));

      setToast(fmt(tdet.photoAddedToast, { ambiente: ambiente?.label ?? '' }));
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : tdet.unknownError;

      if (retryCount < MAX_RETRIES) {
        setUploadingAmbientes((prev) => ({
          ...prev,
          [ambienteId]: { isPending: false, error: fmt(tdet.retryHint, { msg: errorMsg }) },
        }));
        return false;
      } else {
        setUploadingAmbientes((prev) => ({
          ...prev,
          [ambienteId]: { isPending: false, error: fmt(tdet.sendError, { msg: errorMsg }) },
        }));
        setToast(fmt(tdet.photoUploadError, { ambiente: ambiente?.label ?? '' }));
        console.error('Upload error:', err);
        return false;
      }
    }
  };

  const handlePhotoUpload = (ambienteId: string) => {
    if (fileInputRefs.current[ambienteId]) {
      fileInputRefs.current[ambienteId]?.click();
    }
  };

  const handleFileSelected = async (ambienteId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    await handleUploadFile(file, ambienteId);
  };

  const handleConcluirVistoria = () => {
    setToast(tdet.inspectionDone);
    setTimeout(() => {
      navigate('/requests');
    }, 1500);
  };

  return (
    <div className="detail-container">
      {/* Header */}
      <div className="detail-header">
        <div>
          <h1 className="type-h1-page">{inspection.id}</h1>
          <p className="detail-subtitle">{inspection.endereco}</p>
        </div>
        <div className="detail-header-actions" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PagarCta
            solicitacaoId={solicitacaoId}
            checkoutUrl={inspection.checkoutUrl}
            paymentStatus={inspection.paymentStatus}
            size="md"
          />
          <Button variant="ghost" size="md" onClick={() => navigate('/requests')}>
            {t.common.back}
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="detail-info-grid">
        <Card>
          <div className="info-item">
            <span className="info-label">{tdet.infoType}</span>
            <span className="info-value">{inspection.tipo}</span>
          </div>
        </Card>
        <Card>
          <div className="info-item">
            <span className="info-label">{tdet.infoInspector}</span>
            <span className="info-value">{inspection.vistoriador}</span>
          </div>
        </Card>
        <Card>
          <div className="info-item">
            <span className="info-label">{tdet.infoScheduledDate}</span>
            <span className="info-value">{inspection.data} · {inspection.hora}</span>
          </div>
        </Card>
      </div>

      {role === 'admin' && (
        <SolicitacaoAdminPanel
          solicitacaoId={solicitacaoId}
          onToast={(m) => { setToast(m); setTimeout(() => setToast(null), 3000); }}
        />
      )}

      {/* Progress section */}
      <div className="detail-progress">
        <div className="progress-info">
          <h2 className="type-h3">{tdet.photosSectionTitle}</h2>
          <p className="progress-text">
            {fmt(fotosPersistidas.length === 1 ? tdet.progressTextOne : tdet.progressTextMany, {
              done: ambientesComFotos.length,
              total: ambientes.length,
              saved: fotosPersistidas.length,
            })}
          </p>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${(ambientesComFotos.length / ambientes.length) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Photo grid by environment */}
      <div className="detail-ambientes">
        {ambientes.map((ambiente) => {
          const key = `${inspection.id}-${ambiente.id}`;
          const fotos = inspectionPhotos[key] || [];
          const temFoto = fotos.length > 0;

          return (
            <Card key={ambiente.id} className="ambiente-card">
              <div className="ambiente-header">
                <div className="ambiente-title">
                  <h3 className="type-h3">{ambiente.label}</h3>
                  {temFoto && (
                    <Badge tone="ink">
                      {fotos.length === 1 ? tdet.photoCountOne : fmt(tdet.photoCountMany, { n: fotos.length })}
                    </Badge>
                  )}
                </div>
                {!temFoto && (
                  <Badge tone="red">{tdet.noPhoto}</Badge>
                )}
              </div>

              {temFoto && (
                <div className="photos-grid">
                  {fotos.map((_, idx) => (
                    <div key={idx} className="photo-item">
                      <div className="photo-placeholder">
                        <span className="photo-icon">▣</span>
                        <span className="photo-number">{idx + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={(el) => {
                  if (el) fileInputRefs.current[ambiente.id] = el;
                }}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(e) => handleFileSelected(ambiente.id, e)}
              />

              <div className="ambiente-actions">
                {uploadingAmbientes[ambiente.id]?.error && (
                  <p className="upload-error">{uploadingAmbientes[ambiente.id].error}</p>
                )}
                <button
                  className="upload-btn"
                  onClick={() => handlePhotoUpload(ambiente.id)}
                  disabled={uploadingAmbientes[ambiente.id]?.isPending}
                >
                  {uploadingAmbientes[ambiente.id]?.isPending ? tdet.sending : <><Icon name="plus" size={14} /> {tdet.addPhoto}</>}
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Timeline section */}
      <div className="detail-timeline">
        <h2 className="type-h3">{tdet.timelineTitle}</h2>
        <Card>
          <div className="timeline-list">
            {timeline.length === 0 && <p className="progress-text">{tdet.noEvents}</p>}
            {timeline.map((item, idx) => (
              <div key={idx} className="timeline-item">
                <div className="timeline-dot"></div>
                <div className="timeline-content">
                  <p className="timeline-time">{item.time}</p>
                  <p className="timeline-event">{item.event}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Action footer */}
      <div className="detail-footer">
        <div className="footer-content">
          <div className="completion-status">
            {todoComplete ? (
              <div className="status-complete">
                <span className="status-icon"><Icon name="check" size={16} /></span>
                <p>{tdet.allDocumented}</p>
              </div>
            ) : (
              <div className="status-incomplete">
                <span className="status-icon"><Icon name="circle" size={16} /></span>
                <p>
                  {ambientes.length - ambientesComFotos.length === 1
                    ? tdet.remainingOne
                    : fmt(tdet.remainingMany, { n: ambientes.length - ambientesComFotos.length })}
                </p>
              </div>
            )}
          </div>
          <Button
            variant="primary"
            size="md"
            disabled={!todoComplete}
            onClick={handleConcluirVistoria}
          >
            {tdet.finishInspection}
          </Button>
        </div>
      </div>
    </div>
  );
};
