import React, { useMemo, useState } from 'react';
import { Dialog } from '../../components/shared/DataDisplay';
import { Button } from '../../components/shared/Button';
import { useSendTemplate, type EmailTemplate } from '../../api/templates';
import { useTranslation, fmt } from '../../i18n';
import './Templates.css';

/** Extrai a lista de erros de validação de uma mensagem "… — err1; err2" (ver client.parseErrorMessage). */
export const errosDaMensagem = (msg: string): string[] => {
  const lista = msg.split(' — ')[1];
  return lista ? lista.split('; ') : [];
};

/**
 * Prévia isolada de um documento HTML digitado no editor. `sandbox=""` (sem allow-scripts)
 * neutraliza qualquer <script> — o conteúdo é confiável (ADMIN/SUPORTE), mas a prévia não
 * precisa executá-lo. Variáveis de template ({{...}} no e-mail, ${...} no PDF) aparecem
 * como texto porque a substituição só acontece no envio/geração.
 */
export const PreviaDocumento: React.FC<{ srcDoc: string; title: string }> = ({ srcDoc, title }) => (
  <iframe className="templates-previa" title={title} sandbox="" srcDoc={srcDoc || '<!doctype html>'} />
);

/** Separa a caixa de texto em endereços por vírgula, ponto-e-vírgula, espaço ou quebra de linha. */
const parseEmails = (texto: string): string[] =>
  Array.from(
    new Set(
      texto
        .split(/[\s,;]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean),
    ),
  );

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const EnviarDialog: React.FC<{ template: EmailTemplate; onClose: () => void; toast: (m: string) => void }> = ({
  template,
  onClose,
  toast,
}) => {
  const { t } = useTranslation();
  const ts = t.templates.send;
  const enviar = useSendTemplate();
  const [texto, setTexto] = useState('');

  const { validos, invalidos } = useMemo(() => {
    const todos = parseEmails(texto);
    return {
      validos: todos.filter((e) => EMAIL_RE.test(e)),
      invalidos: todos.filter((e) => !EMAIL_RE.test(e)),
    };
  }, [texto]);

  const confirmar = async () => {
    if (validos.length === 0) {
      toast(ts.atLeastOne);
      return;
    }
    try {
      const r = await enviar.mutateAsync({ uuid: template.uuid, emails: validos });
      toast(fmt(ts.queued, { nome: template.nome, n: r.enfileirados }));
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : ts.queueError);
    }
  };

  return (
    <Dialog
      isOpen
      onClose={onClose}
      title={fmt(ts.dialogTitle, { nome: template.nome })}
      actions={
        <>
          <Button variant="secondary" size="md" type="button" onClick={onClose}>{t.common.cancel}</Button>
          <Button
            variant="accent"
            size="md"
            type="button"
            disabled={enviar.isPending || validos.length === 0}
            onClick={confirmar}
          >
            {enviar.isPending ? ts.sending : validos.length ? fmt(ts.sendN, { n: validos.length }) : ts.send}
          </Button>
        </>
      }
    >
      <div className="templates-envio">
        <label className="templates-label" htmlFor="tpl-envio-emails">
          {ts.toLabel}
        </label>
        <textarea
          id="tpl-envio-emails"
          className="templates-textarea"
          rows={6}
          placeholder={ts.placeholder}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoFocus
        />
        <div className="templates-envio-resumo">
          <span>{fmt(ts.validCount, { n: validos.length })}</span>
          {invalidos.length > 0 && (
            <span className="templates-envio-invalidos">
              {fmt(ts.ignored, { lista: invalidos.join(', ') })}
            </span>
          )}
        </div>
      </div>
    </Dialog>
  );
};

export const CHAVES_PDF = ['laudo'];

/** Junta html + css num só documento — CSS num bloco <style> no topo. */
export const combinarFonte = (html: string, css: string | null | undefined): string =>
  css && css.trim() ? `<style>\n${css.trim()}\n</style>\n${html}` : html;

export const listaHref = (canal: 'email' | 'pdf') =>
  canal === 'pdf' ? '/settings/templates?aba=pdf' : '/settings/templates';
