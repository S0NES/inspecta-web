import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../components/shared/DataDisplay';
import { Button } from '../../components/shared/Button';
import { Input } from '../../components/shared/Input';
import { BackButton } from '../../components/shared/BackButton';
import { InfoHint } from '../../components/shared/InfoHint';
import { useAppStore } from '../../store/useAppStore';
import {
  useEmailTemplates,
  usePdfTemplates,
  useSaveEmailTemplate,
  useSavePdfTemplate,
  useTemplateUtilidades,
  type EmailTemplate,
  type PdfTemplate,
} from '../../api/templates';
import { copyText } from '../../utils/clipboard';
import { useTranslation } from '../../i18n';
import {
  CHAVES_PDF,
  EnviarDialog,
  PreviaDocumento,
  combinarFonte,
  errosDaMensagem,
  listaHref,
} from './templatesShared';
import './Templates.css';

type Canal = 'email' | 'pdf';

const isCanal = (v: string | undefined): v is Canal => v === 'email' || v === 'pdf';

const useDebounced = (value: string, ms: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return debounced;
};

export const TemplateEditor: React.FC = () => {
  const { canal, id } = useParams();
  const { t } = useTranslation();
  if (!isCanal(canal)) return <Navigate to="/settings/templates" replace />;
  const voltarPara = listaHref(canal);

  return (
    <div className="templates-container templates-container--editor">
      <div className="templates-editor-view">
        <BackButton to={voltarPara} label={t.templates.back} />
        {canal === 'email'
          ? <EditorEmail uuid={id} voltarPara={voltarPara} />
          : <EditorPdf id={id} voltarPara={voltarPara} />}
      </div>
    </div>
  );
};

const SplitCodigoPrevia: React.FC<{
  label: React.ReactNode;
  htmlFor: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  previewTitle: string;
}> = ({ label, htmlFor, value, onChange, placeholder, disabled, previewTitle }) => {
  const { t } = useTranslation();
  const srcDoc = useDebounced(value, 120);
  return (
    <div className="templates-split">
      <div className="templates-split-code">
        <label className="templates-label" htmlFor={htmlFor}>{label}</label>
        <textarea
          id={htmlFor}
          className="templates-textarea templates-textarea--code templates-textarea--tall"
          rows={22}
          spellCheck={false}
          wrap="off"
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      <div className="templates-split-previa">
        <span className="templates-split-caption">{t.templates.preview}</span>
        <PreviaDocumento srcDoc={srcDoc} title={previewTitle} />
      </div>
    </div>
  );
};

const EditorEmail: React.FC<{ uuid?: string; voltarPara: string }> = ({ uuid, voltarPara }) => {
  const { t } = useTranslation();
  const te = t.templates.email;
  const lista = useEmailTemplates();
  const novo = !uuid;

  if (novo) return <FormEmail key="novo" inicial={null} voltarPara={voltarPara} />;
  if (lista.isLoading) return <p className="templates-vazio">{te.loading}</p>;
  if (lista.isError) return <p className="templates-vazio">{te.loadError}</p>;

  const existente = (lista.data ?? []).find((tpl) => tpl.uuid === uuid);
  if (!existente) return <p className="templates-vazio">{te.notFound}</p>;

  return <FormEmail key={existente.uuid} inicial={existente} voltarPara={voltarPara} />;
};

const FormEmail: React.FC<{ inicial: EmailTemplate | null; voltarPara: string }> = ({ inicial, voltarPara }) => {
  const { setToast } = useAppStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tt = t.templates;
  const te = tt.email;
  const salvar = useSaveEmailTemplate();
  const utilidades = useTemplateUtilidades();
  const novo = !inicial;

  const [form, setForm] = useState({
    nome: inicial?.nome ?? '',
    assunto: inicial?.assunto ?? '',
    corpo: inicial?.corpo ?? '',
  });
  const [erros, setErros] = useState<string[]>([]);
  const [enviarPara, setEnviarPara] = useState<EmailTemplate | null>(null);

  const usos = inicial
    ? (utilidades.data ?? []).filter((u) => u.templateId === inicial.uuid).map((u) => u.rotulo)
    : [];
  const bloqueado = usos.length > 0;

  const toast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  };

  const gravar = async () => {
    setErros([]);
    if (!form.nome.trim() || !form.corpo.trim()) {
      toast(te.nameBodyRequired);
      return;
    }
    try {
      await salvar.mutateAsync({
        uuid: inicial?.uuid,
        canal: 'email',
        nome: form.nome.trim(),
        assunto: form.assunto,
        corpo: form.corpo,
      });
      toast(novo ? te.created : te.newVersionPublished);
      navigate(voltarPara);
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt.genericSaveError;
      setErros(errosDaMensagem(msg));
      toast(msg);
    }
  };

  return (
    <>
      <InfoHint title={inicial ? inicial.nome : te.newTitle}>
        <p>{tt.hintP1}</p>
        <p>
          {tt.hintP2Prefix}<strong>{tt.hintP2Bold}</strong>{tt.hintP2Suffix}
        </p>
      </InfoHint>
      <Card className="templates-editor">
        {!novo && inicial && (
          <button
            type="button"
            className="templates-uuid"
            title={tt.copyUuidTitle}
            onClick={async () => {
              toast((await copyText(inicial.uuid)) ? tt.uuidCopied : tt.copyFailed);
            }}
          >
            {inicial.uuid}
          </button>
        )}
        {bloqueado && (
          <p className="templates-bloqueado">
            {te.lockedPrefix}<strong>{usos.join(', ')}</strong>{te.lockedSuffix}<em>{te.lockedEm}</em>{te.lockedDot}
          </p>
        )}

        <div className="templates-editor-meta">
          <Input
            label={te.nameLabel}
            value={form.nome}
            disabled={bloqueado}
            onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
          />
          <Input
            label={te.subjectLabel}
            value={form.assunto}
            disabled={bloqueado}
            onChange={(e) => setForm((f) => ({ ...f, assunto: e.target.value }))}
          />
        </div>

        <SplitCodigoPrevia
          htmlFor="tpl-email-corpo"
          value={form.corpo}
          onChange={(corpo) => setForm((f) => ({ ...f, corpo }))}
          placeholder={te.bodyPlaceholder}
          disabled={bloqueado}
          previewTitle={te.previewTitle}
          label={
            <>
              {te.bodyLabelPrefix}<code>{'{{codigo}}'}</code>, <code>{'{{nome}}'}</code>{te.bodyLabelSuffix}
            </>
          }
        />

        {erros.length > 0 && (
          <ul className="templates-erros" aria-label={tt.validationErrorsAria}>
            {erros.map((er) => (
              <li key={er}>{er}</li>
            ))}
          </ul>
        )}
      </Card>

      <div className="templates-editor-footer">
        <div className="templates-editor-footer-left">
          {!novo && inicial && (
            <Button variant="ghost" size="md" onClick={() => setEnviarPara(inicial)}>
              {te.sendTemplate}
            </Button>
          )}
        </div>
        {!bloqueado && (
          <Button size="md" variant="primary" disabled={salvar.isPending} onClick={gravar}>
            {salvar.isPending ? tt.saving : novo ? tt.createTemplate : tt.publishNewVersion}
          </Button>
        )}
      </div>

      {enviarPara && (
        <EnviarDialog template={enviarPara} onClose={() => setEnviarPara(null)} toast={toast} />
      )}
    </>
  );
};

const EditorPdf: React.FC<{ id?: string; voltarPara: string }> = ({ id, voltarPara }) => {
  const { t } = useTranslation();
  const tpdf = t.templates.pdf;
  const lista = usePdfTemplates();
  const novo = !id;

  if (novo) return <FormPdf key="novo" inicial={null} voltarPara={voltarPara} />;
  if (lista.isLoading) return <p className="templates-vazio">{tpdf.loading}</p>;
  if (lista.isError) return <p className="templates-vazio">{tpdf.loadError}</p>;

  const existente = (lista.data ?? []).find((tpl) => tpl.id === id);
  if (!existente) return <p className="templates-vazio">{tpdf.notFound}</p>;

  return <FormPdf key={existente.id} inicial={existente} voltarPara={voltarPara} />;
};

const FormPdf: React.FC<{ inicial: PdfTemplate | null; voltarPara: string }> = ({ inicial, voltarPara }) => {
  const { setToast } = useAppStore();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const tt = t.templates;
  const tpdf = tt.pdf;
  const salvar = useSavePdfTemplate();
  const novo = !inicial;

  const [form, setForm] = useState({
    chave: inicial?.chave ?? 'laudo',
    nome: inicial?.nome ?? '',
    fonte: inicial ? combinarFonte(inicial.html, inicial.css) : '',
  });
  const [erros, setErros] = useState<string[]>([]);

  const toast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  };

  const gravar = async () => {
    setErros([]);
    if (!form.nome.trim() || !form.fonte.trim()) {
      toast(tpdf.nameContentRequired);
      return;
    }
    try {
      await salvar.mutateAsync({ chave: form.chave, nome: form.nome.trim(), html: form.fonte, css: undefined });
      toast(novo ? tpdf.created : tpdf.newVersionPublished);
      navigate(voltarPara);
    } catch (e) {
      const msg = e instanceof Error ? e.message : tt.genericSaveError;
      setErros(errosDaMensagem(msg));
      toast(msg);
    }
  };

  return (
    <>
      <InfoHint title={inicial ? inicial.nome : tpdf.newTitle}>
        <p>{tt.hintP1}</p>
        <p>
          {tt.hintP2Prefix}<strong>{tt.hintP2Bold}</strong>{tt.hintP2Suffix}
        </p>
      </InfoHint>
      <Card className="templates-editor">
        <div className="templates-editor-meta">
          <div className="form-group">
            <label className="templates-label" htmlFor="tpl-pdf-chave">{tpdf.keyLabel}</label>
            <select
              id="tpl-pdf-chave"
              className="form-select"
              value={form.chave}
              onChange={(e) => setForm((f) => ({ ...f, chave: e.target.value }))}
            >
              {CHAVES_PDF.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <Input label={tpdf.nameLabel} value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} />
        </div>

        <SplitCodigoPrevia
          htmlFor="tpl-pdf-fonte"
          value={form.fonte}
          onChange={(fonte) => setForm((f) => ({ ...f, fonte }))}
          placeholder={tpdf.placeholder}
          previewTitle={tpdf.previewTitle}
          label={
            <>
              {tpdf.codeLabelPrefix}<code>{'${campo}'}</code>{tpdf.codeLabelSuffix}
            </>
          }
        />

        {erros.length > 0 && (
          <ul className="templates-erros" aria-label={tt.validationErrorsAria}>
            {erros.map((er) => (
              <li key={er}>{er}</li>
            ))}
          </ul>
        )}
      </Card>
      <div className="templates-editor-footer">
        <div className="templates-editor-footer-left" />
        <Button size="md" variant="primary" disabled={salvar.isPending} onClick={gravar}>
          {salvar.isPending ? tt.saving : novo ? tt.createTemplate : tt.publishNewVersion}
        </Button>
      </div>
    </>
  );
};
