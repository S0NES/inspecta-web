import React, { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Card, Badge } from '../../components/shared/DataDisplay';
import { InfoHint } from '../../components/shared/InfoHint';
import { Icon } from '../../components/shared/Icon';
import { useContestacoes, useResolverContestacao, type ContestacaoStatus } from '../../api/contestacoes';
import { useTranslation, fmt } from '../../i18n';
import '../../components/shared/FormElements.css';
import './Audit.css';

const STATUS_TONE: Record<ContestacaoStatus, 'ink' | 'gray' | 'red'> = {
  aberta: 'red',
  aceita: 'ink',
  rejeitada: 'gray',
};

const formatarData = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');

export const Audit: React.FC = () => {
  const { auth, setToast } = useAppStore();
  const { t } = useTranslation();
  const ta = t.audit;
  const STATUS_LABEL = ta.statusLabels as Record<ContestacaoStatus, string>;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resolucaoDrafts, setResolucaoDrafts] = useState<Record<string, string>>({});

  const { data, isLoading, error } = useContestacoes();
  const resolverMutation = useResolverContestacao();

  const contestacoes = data?.content ?? [];
  const podeResolver = auth.perfil === 'admin' || auth.perfil === 'suporte';

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleResolver = async (id: string, aceitar: boolean) => {
    const resolucao = (resolucaoDrafts[id] ?? '').trim();
    if (!resolucao) {
      setToast(ta.describeResolution);
      return;
    }
    try {
      await resolverMutation.mutateAsync({ id, aceitar, resolucao });
      setToast(aceitar ? ta.accepted : ta.rejected);
    } catch (err) {
      const message = err instanceof Error ? err.message : ta.resolveError;
      setToast(fmt(ta.errorPrefix, { message }));
    }
  };

  return (
    <div className="audit-container">
      {/* Header */}
      <div className="audit-header">
        <div>
          <InfoHint title={ta.hintTitle}>
            <p>{ta.hintBody}</p>
          </InfoHint>
        </div>
      </div>

      {isLoading && (
        <div style={{ padding: '16px', marginBottom: '16px', backgroundColor: 'var(--mv-subtle)', borderRadius: 'var(--border-radius-md)' }}>
          <p style={{ color: 'var(--mv-fg3)', margin: 0 }}>{ta.loading}</p>
        </div>
      )}
      {error && (
        <div style={{ padding: '16px', marginBottom: '16px', backgroundColor: 'var(--mv-subtle)', borderRadius: 'var(--border-radius-md)' }}>
          <p style={{ color: 'var(--mv-fg3)', margin: 0 }}>{ta.loadError}</p>
        </div>
      )}
      {!isLoading && !error && contestacoes.length === 0 && (
        <div style={{ padding: '16px', marginBottom: '16px', backgroundColor: 'var(--mv-subtle)', borderRadius: 'var(--border-radius-md)' }}>
          <p style={{ color: 'var(--mv-fg3)', margin: 0 }}>{ta.empty}</p>
        </div>
      )}

      {contestacoes.length > 0 && (
        <div className="audit-section">
          <Card>
            <div className="audit-table">
              <div className="audit-header-row">
                <div className="audit-col-1">{ta.colLaudo}</div>
                <div className="audit-col-2">{ta.colAuthor}</div>
                <div className="audit-col-3">{ta.colOpenedAt}</div>
                <div className="audit-col-4">{ta.colStatus}</div>
              </div>
              {contestacoes.map((c) => (
                <div key={c.id}>
                  <div className="audit-row" onClick={() => toggleExpand(c.id)}>
                    <div className="audit-col-1">
                      <div className="audit-title">{fmt(ta.laudoLabel, { id: c.laudoId })}</div>
                      <div className="audit-subtitle-row">{fmt(ta.contestacaoLabel, { id: c.id })}</div>
                    </div>
                    <div className="audit-col-2">
                      <p className="audit-text">{c.autorId ? fmt(ta.userLabel, { id: c.autorId }) : '—'}</p>
                    </div>
                    <div className="audit-col-3">
                      <p className="audit-text">{formatarData(c.criadoEm)}</p>
                    </div>
                    <div className="audit-col-4">
                      <div className="audit-status">
                        <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                        <span className="audit-chevron"><Icon name={expandedId === c.id ? 'chevron-up' : 'chevron-down'} size={14} /></span>
                      </div>
                    </div>
                  </div>

                  {expandedId === c.id && (
                    <div className="audit-details">
                      <div className="audit-details-content">
                        <h3 className="type-h3">{ta.contestacaoTextTitle}</h3>
                        <p className="audit-text">{c.texto}</p>

                        {c.resolucao && (
                          <div className="audit-adjustments">
                            <div className="audit-adjustment-box">
                              <p className="audit-adjustment-label">{ta.resolutionLabel}</p>
                              <p className="audit-adjustment-text">{c.resolucao}</p>
                            </div>
                          </div>
                        )}

                        {c.status === 'aberta' && podeResolver && (
                          <div className="audit-actions">
                            <textarea
                              className="form-input"
                              placeholder={ta.resolutionPlaceholder}
                              value={resolucaoDrafts[c.id] ?? ''}
                              onChange={(e) =>
                                setResolucaoDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                              }
                              rows={2}
                              style={{ width: '100%', marginBottom: 'var(--space-12)' }}
                            />
                            <div style={{ display: 'flex', gap: 'var(--space-10)' }}>
                              <Button
                                variant="primary"
                                size="sm"
                                disabled={resolverMutation.isPending}
                                onClick={() => handleResolver(c.id, true)}
                              >
                                {ta.accept}
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={resolverMutation.isPending}
                                onClick={() => handleResolver(c.id, false)}
                              >
                                {ta.reject}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};
