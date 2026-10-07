/**
 * Rascunho do wizard de "Nova solicitação", persistido em localStorage.
 *
 * Serve só para sobreviver a uma saída deliberada do fluxo — cadastrar um imóvel
 * novo numa tela à parte (`/properties/new` / screen `propertyWizard`) e voltar.
 * Guarda apenas estado de UI do formulário; nunca token de acesso nem senha.
 * TTL curto para não reabrir um rascunho velho de outra sessão.
 */

export const SOLICITACAO_DRAFT_KEY = 'mv-solicitacao-draft';

/** 2 horas — um rascunho mais velho que isso é descartado ao ler. */
const DRAFT_TTL_MS = 2 * 60 * 60 * 1000;

export interface SolicitacaoDraftPessoa {
  papelSlug: string;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  acompanhante: boolean;
}

export interface SolicitacaoDraft {
  clienteId: string | null;
  imovelId: string | null;
  imovelSearch: string;
  servicoId: string | null;
  tipoIds: string[];
  dataDesejada: string;
  localChaves: string;
  urgente: boolean;
  pessoas: SolicitacaoDraftPessoa[];
  wizardStep: number;
}

interface StoredDraft extends SolicitacaoDraft {
  savedAt: number;
}

export const saveSolicitacaoDraft = (draft: SolicitacaoDraft): void => {
  try {
    const payload: StoredDraft = { ...draft, savedAt: Date.now() };
    localStorage.setItem(SOLICITACAO_DRAFT_KEY, JSON.stringify(payload));
  } catch {
    // localStorage indisponível (modo privado, quota) — o rascunho só não persiste.
  }
};

export const loadSolicitacaoDraft = (): SolicitacaoDraft | null => {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SOLICITACAO_DRAFT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > DRAFT_TTL_MS) {
      clearSolicitacaoDraft();
      return null;
    }
    const { savedAt: _savedAt, ...draft } = parsed;
    return {
      clienteId: draft.clienteId ?? null,
      imovelId: draft.imovelId ?? null,
      imovelSearch: draft.imovelSearch ?? '',
      servicoId: draft.servicoId ?? null,
      tipoIds: Array.isArray(draft.tipoIds) ? draft.tipoIds : [],
      dataDesejada: draft.dataDesejada ?? '',
      localChaves: draft.localChaves ?? '',
      urgente: !!draft.urgente,
      pessoas: Array.isArray(draft.pessoas)
        ? draft.pessoas.map((p) => ({
            papelSlug: p.papelSlug ?? '',
            nome: p.nome ?? '',
            cpf: p.cpf ?? '',
            email: p.email ?? '',
            telefone: p.telefone ?? '',
            acompanhante: !!p.acompanhante,
          }))
        : [],
      wizardStep: typeof draft.wizardStep === 'number' ? draft.wizardStep : 0,
    };
  } catch {
    return null;
  }
};

export const clearSolicitacaoDraft = (): void => {
  try {
    localStorage.removeItem(SOLICITACAO_DRAFT_KEY);
  } catch {
    // nada a fazer
  }
};
