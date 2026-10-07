import React from 'react';
import { Card } from '../../components/shared/DataDisplay';
import { InfoHint } from '../../components/shared/InfoHint';
import { useAppStore } from '../../store/useAppStore';
import {
  useEmailTemplates,
  useTemplateUtilidades,
  useSetTemplateUtilidade,
} from '../../api/templates';
import { useTranslation, fmt } from '../../i18n';
import '../templates/Templates.css';

/**
 * Vínculo de cada e-mail automático (reset de senha, convite…) ao template que
 * ele usa. Separada de Templates — aqui só se escolhe qual template atende cada
 * utilidade; o texto em si é editado em Templates.
 */
export const Utilidades: React.FC = () => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tu = t.utilidades;
  const isAdmin = useAppStore((s) => s.auth.perfil === 'admin');
  const lista = useEmailTemplates();
  const utilidades = useTemplateUtilidades();
  const setUtilidade = useSetTemplateUtilidade();

  const toast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="templates-container">
      <div className="templates-header">
        <InfoHint title={t.nav.config.utilities}>
          <p>{tu.hintP1}</p>
          <p>
            {tu.hintP2Prefix}<strong>{tu.hintP2Bold}</strong>{tu.hintP2Suffix}
            {!isAdmin && tu.adminOnly}
          </p>
        </InfoHint>
      </div>

      <Card className="templates-utilidades">
        {utilidades.isLoading && <p className="templates-vazio">{tu.loading}</p>}
        {utilidades.isError && (
          <p className="templates-vazio">{tu.loadError}</p>
        )}
        <ul className="templates-util-list">
          {(utilidades.data ?? []).map((u) => {
            const naLista = (lista.data ?? []).some((tpl) => tpl.uuid === u.templateId);
            return (
              <li key={u.utilidade} className="templates-util-row">
                <div className="templates-util-info">
                  <span className="templates-util-nome">{u.rotulo}</span>
                  <span className="templates-util-vars">
                    {u.variaveis.map((v) => `{{${v}}}`).join('  ')}
                  </span>
                </div>
                <select
                  className="form-select templates-util-select"
                  aria-label={fmt(tu.templateOf, { rotulo: u.rotulo })}
                  value={u.templateId}
                  disabled={!isAdmin || setUtilidade.isPending}
                  onChange={async (e) => {
                    try {
                      await setUtilidade.mutateAsync({
                        utilidade: u.utilidade,
                        templateId: e.target.value,
                      });
                      toast(fmt(tu.updated, { rotulo: u.rotulo }));
                    } catch (err) {
                      toast(err instanceof Error ? err.message : tu.updateError);
                    }
                  }}
                >
                  {!naLista && <option value={u.templateId}>{u.templateNome}</option>}
                  {(lista.data ?? []).map((tpl) => (
                    <option key={tpl.uuid} value={tpl.uuid}>{tpl.nome}</option>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
};
