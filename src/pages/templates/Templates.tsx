import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Tabs } from '../../components/shared/DataDisplay';
import { Button } from '../../components/shared/Button';
import { InfoHint } from '../../components/shared/InfoHint';
import { ActionMenu } from '../../components/shared/ActionMenu';
import { Icon } from '../../components/shared/Icon';
import { useAppStore } from '../../store/useAppStore';
import {
  useEmailTemplates,
  usePdfTemplates,
  useDeactivateEmailTemplate,
  useDeactivatePdfTemplate,
  useTemplateUtilidades,
  type EmailTemplate,
} from '../../api/templates';
import { useTranslation, fmt } from '../../i18n';
import { EnviarDialog } from './templatesShared';
import './Templates.css';

type Aba = 'email' | 'pdf';

export const Templates: React.FC = () => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tt = t.templates;
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const aba: Aba = searchParams.get('aba') === 'pdf' ? 'pdf' : 'email';

  const toast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="templates-container">
      <div className="templates-header">
        <InfoHint title={t.nav.config.templates}>
          <p>{tt.hintP1}</p>
          <p>
            {tt.hintP2Prefix}<strong>{tt.hintP2Bold}</strong>{tt.hintP2Suffix}
          </p>
        </InfoHint>
        <Button
          size="md"
          variant="accent"
          onClick={() => navigate(`/settings/templates/${aba}/new`)}
        >
          {tt.createTemplate}
        </Button>
      </div>

      <Tabs
        tabs={[
          { id: 'email', label: tt.tabEmail },
          { id: 'pdf', label: tt.tabPdf },
        ]}
        activeTab={aba}
        onTabChange={(id) => {
          if (id === 'pdf') setSearchParams({ aba: 'pdf' });
          else setSearchParams({});
        }}
      />

      {aba === 'email' ? <AbaEmail toast={toast} /> : <AbaPdf toast={toast} />}
    </div>
  );
};

const AbaEmail: React.FC<{ toast: (m: string) => void }> = ({ toast }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const te = t.templates.email;
  const lista = useEmailTemplates();
  const desativar = useDeactivateEmailTemplate();
  const utilidades = useTemplateUtilidades();
  const [enviarPara, setEnviarPara] = useState<EmailTemplate | null>(null);

  const usosDe = (uuid: string) =>
    (utilidades.data ?? []).filter((u) => u.templateId === uuid).map((u) => u.rotulo);

  const remover = async (tpl: EmailTemplate) => {
    try {
      await desativar.mutateAsync(tpl.uuid);
      toast(te.deactivated);
    } catch (e) {
      toast(e instanceof Error ? e.message : te.deactivateError);
    }
  };

  return (
    <>
      <Card className="templates-lista">
        {lista.isLoading && <p className="templates-vazio">{te.loading}</p>}
        {lista.isError && <p className="templates-vazio">{te.loadError}</p>}
        {lista.data?.length === 0 && <p className="templates-vazio">{te.empty}</p>}
        <ul className="templates-items">
          {(lista.data ?? []).map((tpl) => {
            const usos = usosDe(tpl.uuid);
            return (
              <li key={tpl.uuid} className="templates-item">
                <button
                  type="button"
                  className="templates-item-nome"
                  onClick={() => navigate(`/settings/templates/email/${tpl.uuid}/edit`)}
                >
                  {tpl.nome} <span className="templates-versao">v{tpl.versao}</span>
                  {usos.length > 0 && <span className="templates-badge" title={te.inUseTitle}>{usos.join(' · ')}</span>}
                </button>
                <ActionMenu
                  size="sm"
                  trigger={<Icon name="ellipsis-vertical" />}
                  label={fmt(te.rowActions, { nome: tpl.nome })}
                  items={[
                    { key: 'enviar', label: te.sendMenu, onClick: () => setEnviarPara(tpl) },
                    ...(usos.length === 0
                      ? [{ key: 'desativar', label: te.deactivate, danger: true, onClick: () => remover(tpl) }]
                      : []),
                  ]}
                />
              </li>
            );
          })}
        </ul>
      </Card>

      {enviarPara && (
        <EnviarDialog template={enviarPara} onClose={() => setEnviarPara(null)} toast={toast} />
      )}
    </>
  );
};

const AbaPdf: React.FC<{ toast: (m: string) => void }> = ({ toast }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tpdf = t.templates.pdf;
  const lista = usePdfTemplates();
  const desativar = useDeactivatePdfTemplate();

  const remover = async (id: string) => {
    try {
      await desativar.mutateAsync(id);
      toast(tpdf.deactivated);
    } catch (e) {
      toast(e instanceof Error ? e.message : tpdf.deactivateError);
    }
  };

  return (
    <Card className="templates-lista">
      {lista.isLoading && <p className="templates-vazio">{tpdf.loading}</p>}
      {lista.isError && <p className="templates-vazio">{tpdf.loadError}</p>}
      {lista.data?.length === 0 && <p className="templates-vazio">{tpdf.empty}</p>}
      <ul className="templates-items">
        {(lista.data ?? []).map((tpl) => (
          <li key={tpl.id} className="templates-item">
            <button
              type="button"
              className="templates-item-nome"
              onClick={() => navigate(`/settings/templates/pdf/${tpl.id}/edit`)}
            >
              {tpl.nome} <span className="templates-versao">{fmt(tpdf.versionMeta, { chave: tpl.chave, versao: tpl.versao })}{tpl.imobiliariaId ? fmt(tpdf.scopeAgency, { id: tpl.imobiliariaId }) : tpdf.scopeGlobal}</span>
            </button>
            <ActionMenu
              size="sm"
              trigger={<Icon name="ellipsis-vertical" />}
              label={fmt(tpdf.rowActions, { nome: tpl.nome })}
              items={[
                { key: 'desativar', label: tpdf.deactivate, danger: true, onClick: () => { void remover(tpl.id); } },
              ]}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
};
