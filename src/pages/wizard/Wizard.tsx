import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { BackButton } from '../../components/shared/BackButton';
import { FieldHint } from '../../components/shared/FieldHint';
import { Card } from '../../components/shared/DataDisplay';
import { Input } from '../../components/shared/Input';
import { Icon } from '../../components/shared/Icon';
import {
  useImoveis,
  useIntervenientePapeis,
  useCreateSolicitacao,
  usePrecoPreview,
  isSemVistoriador,
} from '../../api/solicitacoes';
import { useImobiliarias } from '../../api/admin';
import { useServicos, type ServicoView } from '../../api/servicos';
import { useImobiliariaContrato } from '../../api/contratos';
import { useCriarCobranca, parsePaymentMeta } from '../../api/pagamento';
import { useCidades } from '../../api/imoveis';
import { newIdempotencyKey } from '../../utils/idempotency';
import {
  saveSolicitacaoDraft,
  loadSolicitacaoDraft,
  clearSolicitacaoDraft,
  SOLICITACAO_DRAFT_KEY,
  type SolicitacaoDraft,
} from '../../utils/solicitacaoDraft';
import { isCpf, isEmail, isNomeCompleto, isPhoneBr, normalizeCpf, normalizeEmail, normalizePhone } from '../../utils/pessoaDocumento';
import { maskCpf, maskPhone } from '../../utils/masks';
import { useTranslation, fmt } from '../../i18n';
import './Wizard.css';

const STEP_META = [
  { id: 0, key: 'imovel', number: '01' },
  { id: 1, key: 'servico', number: '02' },
  { id: 2, key: 'intervenientes', number: '03' },
  { id: 3, key: 'vistoriador', number: '04' },
  { id: 4, key: 'confirmacao', number: '05' },
] as const;

type Pessoa = { papelSlug: string; nome: string; cpf: string; email: string; telefone: string; acompanhante: boolean };
const pessoaVazia = (papelSlug: string): Pessoa =>
  ({ papelSlug, nome: '', cpf: '', email: '', telefone: '', acompanhante: false });
const pessoaValida = (p: Pessoa) =>
  p.papelSlug.trim() !== '' && isNomeCompleto(p.nome) && isCpf(p.cpf) && isEmail(p.email) &&
  (p.telefone.trim() === '' || isPhoneBr(p.telefone));

const money = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Imobiliária persistida no rascunho (campo extra, fora do tipo base). */
const readDraftImobiliariaId = (): string | null => {
  try {
    const raw = localStorage.getItem(SOLICITACAO_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { imobiliariaId?: string | null };
    return parsed?.imobiliariaId ?? null;
  } catch {
    return null;
  }
};

/** Linha de preço de um Serviço: calcula via preview (imobiliária + aluguel/mobiliado da solicitação). */
const PrecoLinha: React.FC<{
  nome: string;
  previewParams: Parameters<typeof usePrecoPreview>[0];
  onValor: (v: number | null) => void;
}> = ({ nome, previewParams, onValor }) => {
  const preview = usePrecoPreview(previewParams);
  const { t } = useTranslation();

  useEffect(() => {
    onValor(preview.data?.valor ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preview.data?.valor]);

  let texto: string;
  if (preview.isLoading) texto = t.wizard.priceCalculating;
  else if (preview.isError) texto = t.wizard.priceNoContract;
  else texto = money(preview.data?.valor);

  return (
    <div className="aside-item">
      <span className="aside-item-label">{nome.toUpperCase()}</span>
      <span className="aside-item-value">{texto}</span>
    </div>
  );
};

export const Wizard: React.FC = () => {
  const { wizardStep, setWizardStep, setToast, role, auth } = useAppStore();
  const { t } = useTranslation();
  const tw = t.wizard;
  const STEPS = STEP_META.map((s) => ({ ...s, label: tw.steps[s.key] }));
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Staff (admin/suporte) escolhe a imobiliária; imob_gerencia/imob_operacao usam a própria.
  const isStaff = role === 'admin';
  const [imobiliariaSel, setImobiliariaSel] = useState<string | null>(null);
  const imobiliariaId = isStaff
    ? imobiliariaSel
    : auth.imobiliariaId ?? auth.imobiliariaIds?.[0] ?? null;

  const [imovelId, setImovelId] = useState<string | null>(null);
  const [imovelSearch, setImovelSearch] = useState('');

  const [servicoId, setServicoId] = useState<string | null>(null);
  const [tipoIds, setTipoIds] = useState<string[]>([]);
  const [dataDesejada, setDataDesejada] = useState('');
  const [localChaves, setLocalChaves] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [valorAluguel, setValorAluguel] = useState('');
  const [mobiliado, setMobiliado] = useState(false);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [valorPorTipo, setValorPorTipo] = useState<Record<string, number | null>>({});

  const [semVistoriador, setSemVistoriador] = useState<string[] | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const papeisQuery = useIntervenientePapeis();
  const cidadesQuery = useCidades();
  const servicosQuery = useServicos();
  const imobiliariasQuery = useImobiliarias({ size: 100 }, { enabled: isStaff });
  const createSolicitacao = useCreateSolicitacao();
  const criarCobranca = useCriarCobranca();

  const papeis = papeisQuery.data ?? [];
  const cidades = cidadesQuery.data ?? [];
  const todosServicos = (servicosQuery.data ?? []).filter((s) => s.ativo);
  const imobiliarias = imobiliariasQuery.data?.content ?? [];

  const imoveisQuery = useImoveis({
    imobiliariaId: imobiliariaId ?? undefined,
    enabled: role !== 'vistoriador' && imobiliariaId !== null,
  });
  const imoveis = imoveisQuery.data?.content ?? [];
  const imovelSelecionado = imoveis.find((i) => i.id === imovelId) ?? null;

  const contratoQuery = useImobiliariaContrato(imobiliariaId);
  const contratoPercentual = contratoQuery.data?.modo === 'percentual';

  const servicosDisponiveis: ServicoView[] = useMemo(() => {
    const grupos = contratoQuery.data?.grupos;
    if (!grupos || contratoQuery.isError) return todosServicos;
    const ids = new Set(grupos.map((g) => g.servicoId));
    return todosServicos.filter((s) => ids.has(s.id));
  }, [todosServicos, contratoQuery.data, contratoQuery.isError]);

  const cidadeNome = useMemo(() => {
    const m = new Map(cidades.map((c) => [c.id, `${c.nome}/${c.uf}`]));
    return (id: string) => m.get(id) ?? '—';
  }, [cidades]);

  const imoveisFiltrados = useMemo(() => {
    const q = imovelSearch.trim().toLowerCase();
    return imoveis.filter((i) => {
      if (!q) return true;
      return (
        i.endereco.toLowerCase().includes(q) ||
        String(i.id).includes(q) ||
        cidadeNome(i.cidadeId).toLowerCase().includes(q)
      );
    });
  }, [imoveis, imovelSearch, cidadeNome]);

  const servicoSelecionado = servicosDisponiveis.find((s) => s.id === servicoId) ?? null;
  const tiposDoServico = servicoSelecionado?.tipos ?? [];
  const tiposSelecionados = tiposDoServico.filter((tp) => tipoIds.includes(tp.id));

  const imobiliariaNome = useMemo(() => {
    const im = imobiliarias.find((i) => i.id === imobiliariaId);
    if (im) return im.nomeFantasia || im.razaoSocial;
    return imobiliariaId ? fmt(tw.agencyFallback, { id: imobiliariaId }) : '—';
  }, [imobiliarias, imobiliariaId, tw.agencyFallback]);

  const valorAluguelNum = valorAluguel.trim() !== '' ? Number(valorAluguel) : null;

  // Reidratação (rascunho / imóvel recém-criado) dispara setImobiliariaSel/setServicoId,
  // o que faria os efeitos de baixo zerarem imovelId/tipoIds logo em seguida.
  const skipImovelResetRef = useRef(false);
  const skipTiposResetRef = useRef(false);

  useEffect(() => {
    if (skipTiposResetRef.current) { skipTiposResetRef.current = false; return; }
    setTipoIds([]);
  }, [servicoId]);
  useEffect(() => {
    if (skipImovelResetRef.current) { skipImovelResetRef.current = false; return; }
    setImovelId(null);
  }, [imobiliariaId]);

  // Prefill de aluguel/mobiliado a partir do imóvel — só quando o imóvel de fato tem
  // valor (raro: PropertyWizard grava `valorAluguel: null` hoje). Fonte de verdade da
  // precificação é o que o usuário digita aqui, não o imóvel.
  useEffect(() => {
    if (imovelSelecionado && imovelSelecionado.valorAluguel != null) {
      setValorAluguel(String(imovelSelecionado.valorAluguel));
      setMobiliado(!!imovelSelecionado.mobiliado);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imovelId]);

  // Ao montar: reidrata o rascunho salvo antes de sair para cadastrar um imóvel e,
  // se voltou com `?createdImovelId=<id>`, seleciona esse imóvel (refetch da lista).
  useEffect(() => {
    const draft = loadSolicitacaoDraft();
    const draftImob = readDraftImobiliariaId();
    const urlImob = searchParams.get('imob');
    if (draft) {
      if (draftImob || urlImob) skipImovelResetRef.current = true;
      if (draft.servicoId) skipTiposResetRef.current = true;
      if (isStaff) setImobiliariaSel(urlImob ?? draftImob);
      setImovelSearch(draft.imovelSearch);
      setServicoId(draft.servicoId);
      setTipoIds(draft.tipoIds);
      setDataDesejada(draft.dataDesejada);
      setLocalChaves(draft.localChaves);
      setUrgente(draft.urgente);
      setPessoas(draft.pessoas);
      setWizardStep(draft.wizardStep);
      setImovelId(draft.imovelId);
    } else if (isStaff && urlImob) {
      setImobiliariaSel(urlImob);
    }

    const createdImovelId = searchParams.get('createdImovelId');
    if (createdImovelId) {
      void imoveisQuery.refetch().finally(() => {
        setImovelId(createdImovelId);
        setWizardStep(1);
      });
      setSearchParams({}, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pré-preenche uma pessoa quando os papéis carregam e a lista está vazia.
  useEffect(() => {
    if (pessoas.length === 0 && papeis.length > 0) {
      setPessoas([pessoaVazia(papeis[0].slug)]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papeis.length]);

  const intervenientesValidos = pessoas.length >= 1 && pessoas.every(pessoaValida);

  const stepValido = (step: number): boolean => {
    if (step === 0) return imobiliariaId !== null && imovelId !== null;
    if (step === 1) {
      if (servicoId === null || tipoIds.length === 0 || dataDesejada.trim() === '') return false;
      if (contratoPercentual && !(valorAluguelNum != null && valorAluguelNum > 0)) return false;
      return true;
    }
    if (step === 2) return intervenientesValidos;
    if (step === 3) return semVistoriador === null || semVistoriador.length === 0;
    return true;
  };

  const podeEnviar = stepValido(0) && stepValido(1) && stepValido(2);

  const toggleTipo = (id: string) =>
    setTipoIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const setPessoa = (i: number, patch: Partial<Pessoa>) =>
    setPessoas((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const addPessoa = () => setPessoas((ps) => [...ps, pessoaVazia(papeis[0]?.slug ?? '')]);
  const removePessoa = (i: number) => setPessoas((ps) => ps.filter((_, idx) => idx !== i));

  const handleNext = () => {
    if (!stepValido(wizardStep)) {
      setToast(tw.toastFillRequired);
      setTimeout(() => setToast(null), 3000);
      return;
    }
    if (wizardStep < STEPS.length - 1) setWizardStep(wizardStep + 1);
  };
  const handlePrevious = () => { if (wizardStep > 0) setWizardStep(wizardStep - 1); };

  const resetar = () => {
    if (isStaff) setImobiliariaSel(null);
    setImovelId(null);
    setImovelSearch('');
    setServicoId(null);
    setTipoIds([]);
    setDataDesejada('');
    setLocalChaves('');
    setUrgente(false);
    setValorAluguel('');
    setMobiliado(false);
    setPessoas([]);
    setSemVistoriador(null);
    setWizardStep(0);
    setIdempotencyKey(newIdempotencyKey());
    clearSolicitacaoDraft();
  };

  /**
   * Atalho da etapa 1: salva o rascunho e vai para a tela de criar imóvel, com a
   * imobiliária do contexto já trancada. Para staff, o retorno carrega `?imob=` para
   * reconstruir a seleção.
   */
  const irCadastrarImovel = () => {
    const draft = {
      clienteId: null,
      imovelId,
      imovelSearch,
      servicoId,
      tipoIds,
      dataDesejada,
      localChaves,
      urgente,
      pessoas,
      wizardStep,
      imobiliariaId,
    };
    saveSolicitacaoDraft(draft as SolicitacaoDraft);
    const imobiliariaParam = imobiliariaId ? `imobiliariaId=${encodeURIComponent(imobiliariaId)}&` : '';
    const returnTo =
      isStaff && imobiliariaId
        ? `/requests/new?imob=${encodeURIComponent(imobiliariaId)}`
        : '/requests/new';
    navigate(`/properties/new?${imobiliariaParam}returnTo=${encodeURIComponent(returnTo)}`);
  };

  const handleSubmit = async () => {
    if (!podeEnviar) {
      setToast(tw.toastFillAll);
      setTimeout(() => setToast(null), 4000);
      return;
    }

    const dataIso = dataDesejada ? new Date(dataDesejada).toISOString() : null;
    const body = {
      imovelId: imovelId!,
      urgente,
      chavesRetirada: localChaves.trim() || null,
      origem: 'painel' as const,
      valorAluguel: valorAluguelNum,
      mobiliado,
      servicos: tipoIds.map((tipoServicoId) => ({ tipoServicoId, dataDesejada: dataIso })),
      intervenientes: pessoas.map((p) => ({
        papelSlug: p.papelSlug,
        nome: p.nome.trim(),
        cpf: normalizeCpf(p.cpf),
        email: normalizeEmail(p.email),
        telefone: p.telefone.trim() ? normalizePhone(p.telefone) : null,
        acompanhante: p.acompanhante,
      })),
      idempotencyKey,
    };

    try {
      const criada = await createSolicitacao.mutateAsync(body);

      // Caminho reservado (código morto): solicitação SEM imobiliária ainda usa o
      // checkout individual. Inalcançável hoje — a etapa 1 exige uma imobiliária.
      if (!imobiliariaId) {
        const payment = criada?.payment ?? parsePaymentMeta(criada?.raw as never);
        const irParaPagamento = (id: string) => {
          setToast(tw.toastCreatedPay);
          setTimeout(() => setToast(null), 6000);
          resetar();
          navigate(`/solicitacoes/${id}/pagar`);
        };
        if (payment.checkoutUrl && criada?.id) return irParaPagamento(criada.id);
        try {
          const cob = criada?.id ? await criarCobranca.mutateAsync(criada.id) : null;
          if (cob?.checkoutUrl && criada?.id) return irParaPagamento(criada.id);
          setToast(tw.toastCreatedEmail);
        } catch (err) {
          if (isSemVistoriador(err)) {
            setSemVistoriador(err.body.servicos ?? []);
            setWizardStep(3);
            setToast(tw.toastNoInspector);
            setTimeout(() => setToast(null), 6000);
            return;
          }
          setToast(tw.toastCreatedNoCharge);
        }
        setTimeout(() => setToast(null), 6000);
        resetar();
        navigate('/requests');
        return;
      }

      // Fluxo B2B: pós-pago. Sem checkout, sem 409 SEM_VISTORIADOR — a atribuição
      // acontece automaticamente na criação e o valor entra no extrato da imobiliária.
      setToast(tw.toastCreated);
      setTimeout(() => setToast(null), 6000);
      resetar();
      navigate('/requests');
    } catch (err) {
      const msg = err instanceof Error ? err.message : tw.createError;
      setToast(
        msg.includes('Contrato') || msg.includes('CONTRATO') ? tw.noActiveContract : msg,
      );
      setTimeout(() => setToast(null), 6000);
    }
  };

  const previewBase = imovelSelecionado && imobiliariaId
    ? {
        imobiliariaId,
        metragem: imovelSelecionado.metragem,
        mobiliado,
        valorAluguel: valorAluguelNum ?? undefined,
      }
    : null;

  const valorTotal = tipoIds.reduce((acc, id) => acc + (valorPorTipo[id] ?? 0), 0);
  const custoTexto = (tp: { id: string }) => {
    const v = valorPorTipo[tp.id];
    return v === undefined ? tw.priceCalculating : money(v);
  };

  const getStepContent = () => {
    switch (wizardStep) {
      case 0:
        return (
          <div className="wizard-step-content">
            <div className="wizard-step-title">
              <h3 className="type-h3">{tw.step0Title}</h3>
              <FieldHint>{tw.step0Desc}</FieldHint>
            </div>

            {isStaff && (
              <div className="wizard-field">
                <label className="form-label" htmlFor="wiz-imobiliaria">{tw.agencyLabel}</label>
                <select
                  id="wiz-imobiliaria"
                  className="form-select"
                  value={imobiliariaSel ?? ''}
                  onChange={(e) => setImobiliariaSel(e.target.value ? e.target.value : null)}
                >
                  <option value="">{tw.selectAgency}</option>
                  {imobiliarias.map((im) => (
                    <option key={im.id} value={im.id}>{im.nomeFantasia || im.razaoSocial}</option>
                  ))}
                </select>
              </div>
            )}

            {imobiliariaId != null && (
              <>
                <div className="wizard-search-row">
                  <Input
                    placeholder={tw.propertySearch}
                    value={imovelSearch}
                    onChange={(e) => setImovelSearch(e.target.value)}
                  />
                  <Button variant="secondary" size="md" onClick={irCadastrarImovel}>
                    {tw.registerNewProperty}
                  </Button>
                </div>

                {imoveisQuery.isLoading && <div className="wizard-empty"><p>{tw.loadingProperties}</p></div>}
                {imoveisQuery.error && <div className="wizard-empty"><p>{tw.loadPropertiesError}</p></div>}

                {!imoveisQuery.isLoading && !imoveisQuery.error && (
                  <div className="wizard-properties">
                    {imoveisFiltrados.map((imovel) => (
                      <button
                        type="button"
                        key={imovel.id}
                        className={`property-card ${imovelId === imovel.id ? 'property-card--selected' : ''}`}
                        aria-pressed={imovelId === imovel.id}
                        onClick={() => setImovelId(imovel.id)}
                      >
                        <span className="property-card-check" aria-hidden="true">
                          <Icon name="check" size={12} />
                        </span>
                        <span className="property-address">{imovel.endereco}</span>
                        <span className="property-meta">
                          <span>{cidadeNome(imovel.cidadeId)}</span>
                          <span>·</span>
                          <span>{imovel.metragem} m²</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {!imoveisQuery.isLoading && !imoveisQuery.error && imoveisFiltrados.length === 0 && (
                  <div className="wizard-empty"><p>{tw.noPropertyFound}</p></div>
                )}
              </>
            )}
          </div>
        );

      case 1:
        return (
          <div className="wizard-step-content">
            <div className="wizard-step-title">
              <h3 className="type-h3">{tw.step1Title}</h3>
              <FieldHint>{tw.step1Desc}</FieldHint>
            </div>

            <div className="wizard-field">
              <label className="form-label" htmlFor="wiz-servico">{tw.serviceLabel}</label>
              <select
                id="wiz-servico"
                className="form-select"
                value={servicoId ?? ''}
                onChange={(e) => setServicoId(e.target.value ? e.target.value : null)}
              >
                <option value="">{t.common.selectPlaceholder}</option>
                {servicosDisponiveis.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
              </select>
              {servicosDisponiveis.length === 0 && (
                <p className="wizard-step-description">{tw.noServiceInContract}</p>
              )}
            </div>

            {servicoSelecionado && (
              <div className="wizard-field">
                <span className="wizard-eyebrow">{tw.serviceTypes}</span>
                <div className="wizard-pills">
                  {tiposDoServico.map((tp) => (
                    <button
                      type="button"
                      key={tp.id}
                      className={`wizard-pill ${tipoIds.includes(tp.id) ? 'wizard-pill--on' : ''}`}
                      aria-pressed={tipoIds.includes(tp.id)}
                      onClick={() => toggleTipo(tp.id)}
                    >
                      {tp.nome}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="wizard-form-grid">
              <Input
                label={tw.dateLabel}
                type="datetime-local"
                value={dataDesejada}
                onChange={(e) => setDataDesejada(e.target.value)}
              />
              <Input
                label={tw.keysLabel}
                placeholder={tw.keysPlaceholder}
                value={localChaves}
                onChange={(e) => setLocalChaves(e.target.value)}
              />
              <Input
                label={contratoPercentual ? tw.rentValueLabelRequired : tw.rentValueLabel}
                type="number"
                min="0"
                inputMode="decimal"
                placeholder={tw.rentValuePlaceholder}
                value={valorAluguel}
                aria-invalid={contratoPercentual && valorAluguel.trim() !== '' && !(valorAluguelNum != null && valorAluguelNum > 0)}
                onChange={(e) => setValorAluguel(e.target.value)}
              />
            </div>

            <div className="wizard-options">
              <button
                type="button"
                className={`wizard-pill ${mobiliado ? 'wizard-pill--on' : ''}`}
                aria-pressed={mobiliado}
                onClick={() => setMobiliado((v) => !v)}
              >
                {tw.furnishedLabel}
              </button>
              <button
                type="button"
                className={`wizard-pill ${urgente ? 'wizard-pill--on' : ''}`}
                aria-pressed={urgente}
                onClick={() => setUrgente((v) => !v)}
              >
                {tw.markUrgent}
              </button>
            </div>
            {contratoPercentual && (
              <p className="wizard-step-description">{tw.rentValueHint}</p>
            )}
          </div>
        );

      case 2:
        return (
          <div className="wizard-step-content">
            <div className="wizard-step-title">
              <h3 className="type-h3">{tw.step2Title}</h3>
              <FieldHint>{tw.step2Desc}</FieldHint>
            </div>

            <div className="wizard-int-list">
              {pessoas.map((p, i) => (
                <div key={i} className="wizard-int-card">
                  <div className="wizard-form-grid">
                    <div className="form-group">
                      <label className="form-label" htmlFor={`int-papel-${i}`}>{tw.roleLabel}</label>
                      <select
                        id={`int-papel-${i}`}
                        className="form-select"
                        value={p.papelSlug}
                        onChange={(e) => setPessoa(i, { papelSlug: e.target.value })}
                      >
                        {papeis.map((pp) => <option key={pp.slug} value={pp.slug}>{pp.nome}</option>)}
                      </select>
                    </div>
                    <Input
                      label={tw.fullNameLabel}
                      value={p.nome}
                      aria-invalid={p.nome.trim() !== '' && !isNomeCompleto(p.nome)}
                      onChange={(e) => setPessoa(i, { nome: e.target.value })}
                    />
                    <Input
                      label={tw.cpfLabel}
                      value={p.cpf}
                      inputMode="numeric"
                      aria-invalid={p.cpf.trim() !== '' && !isCpf(p.cpf)}
                      onChange={(e) => setPessoa(i, { cpf: maskCpf(e.target.value) })}
                    />
                    <Input
                      label={tw.emailLabel}
                      value={p.email}
                      aria-invalid={p.email.trim() !== '' && !isEmail(p.email)}
                      onChange={(e) => setPessoa(i, { email: e.target.value })}
                    />
                    <Input
                      label={tw.phoneLabel}
                      value={p.telefone}
                      inputMode="numeric"
                      placeholder={tw.phonePlaceholder}
                      aria-invalid={p.telefone.trim() !== '' && !isPhoneBr(p.telefone)}
                      onChange={(e) => setPessoa(i, { telefone: maskPhone(e.target.value) })}
                    />
                  </div>
                  <label className="wizard-int-acompanha">
                    <input
                      type="checkbox"
                      checked={p.acompanhante}
                      onChange={(e) => setPessoa(i, { acompanhante: e.target.checked })}
                    />
                    <span>{tw.acompanhaLabel}</span>
                  </label>
                  {pessoas.length > 1 && (
                    <button type="button" className="wizard-int-remove" onClick={() => removePessoa(i)}>
                      {t.common.remove}
                    </button>
                  )}
                </div>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={addPessoa}>{tw.addPerson}</Button>
          </div>
        );

      case 3:
        return (
          <div className="wizard-step-content">
            <div className="wizard-step-title">
              <h3 className="type-h3">{tw.step3Title}</h3>
              <FieldHint>
                {tw.step3DescPrefix}<strong>{tw.step3DescBold}</strong>{tw.step3DescSuffix}
              </FieldHint>
            </div>
            {semVistoriador && semVistoriador.length > 0 && (
              <div className="wizard-prereq" role="status">
                <p className="wizard-prereq-title">{tw.noInspectorTitle}</p>
                <p className="wizard-prereq-text">
                  {fmt(tw.noInspectorText, { n: semVistoriador.length })}
                </p>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="wizard-step-content">
            <div className="wizard-step-title">
              <h3 className="type-h3">{tw.step4Title}</h3>
              <FieldHint>{tw.step4Desc}</FieldHint>
            </div>
            <div className="wizard-summary">
              <span className="wizard-eyebrow">{tw.asideSummary}</span>
              <div className="summary-row"><span className="summary-label">{tw.sumAgency}</span>
                <span className="summary-value">{imobiliariaNome}</span></div>
              <div className="summary-row"><span className="summary-label">{tw.sumProperty}</span>
                <span className="summary-value">{imovelSelecionado ? fmt(tw.propertySummary, { id: imovelSelecionado.id, endereco: imovelSelecionado.endereco }) : '—'}</span></div>
              <div className="summary-row"><span className="summary-label">{tw.sumService}</span>
                <span className="summary-value">{servicoSelecionado?.nome ?? '—'}</span></div>
              <div className="summary-row"><span className="summary-label">{tw.sumTypes}</span>
                <span className="summary-value">{tiposSelecionados.map((tp) => tp.nome).join(', ') || '—'}</span></div>
              <div className="summary-row"><span className="summary-label">{tw.sumDate}</span>
                <span className="summary-value">{dataDesejada ? new Date(dataDesejada).toLocaleString('pt-BR') : '—'}</span></div>
              <div className="summary-row"><span className="summary-label">{tw.sumRent}</span>
                <span className="summary-value">{money(valorAluguelNum)}{mobiliado ? ` · ${tw.furnishedLabel}` : ''}</span></div>
              <div className="summary-row"><span className="summary-label">{tw.sumInterveners}</span>
                <span className="summary-value">{pessoas.map((p) => p.nome.trim()).filter(Boolean).join(', ') || '—'}</span></div>
              <div className="summary-row"><span className="summary-label">{tw.sumInspector}</span>
                <span className="summary-value">{tw.sumInspectorValue}</span></div>

              <span className="wizard-eyebrow summary-section-title">{tw.costEstimate}</span>
              {tiposSelecionados.map((tp) => (
                <div className="summary-row" key={tp.id}>
                  <span className="summary-label">{tp.nome.toUpperCase()}</span>
                  <span className="summary-value">{custoTexto(tp)}</span>
                </div>
              ))}
              <div className="summary-row summary-row--total">
                <span className="summary-label">{tw.total}</span>
                <span className="summary-value">{valorTotal > 0 ? money(valorTotal) : '—'}</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="wizard-container">
      <BackButton corner />
      <div className="wizard-steps">
        {STEPS.map((step) => (
          <div
            key={step.id}
            className={`step-indicator ${
              step.id === wizardStep ? 'step-indicator--current'
                : step.id < wizardStep ? 'step-indicator--done' : 'step-indicator--future'
            }`}
            onClick={() => { if (step.id < wizardStep) setWizardStep(step.id); }}
          >
            <div className="step-number">{step.number}</div>
            <div className="step-label">{step.label}</div>
          </div>
        ))}
      </div>

      <div className="wizard-main">
        <div className="wizard-content">
          <Card>{getStepContent()}</Card>
        </div>
      </div>

      {/* Instâncias de PrecoLinha sempre montadas (a partir de tipos selecionados) para
          `valorPorTipo` estar pronto na Confirmação, sem esperar carregamento. */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true">
        {tiposSelecionados.map((tp) => (
          <PrecoLinha
            key={tp.id}
            nome={tp.nome}
            previewParams={previewBase ? { ...previewBase, tipoServicoId: tp.id } : null}
            onValor={(v) => setValorPorTipo((p) => (p[tp.id] === v ? p : { ...p, [tp.id]: v }))}
          />
        ))}
      </div>

      <div className="wizard-footer">
        <Button variant="ghost" size="md" disabled={wizardStep === 0} onClick={handlePrevious}>{t.common.back}</Button>
        {wizardStep < STEPS.length - 1 ? (
          <Button variant="primary" size="md" onClick={handleNext} disabled={!stepValido(wizardStep)}>{t.common.next}</Button>
        ) : (
          <Button
            variant="accent"
            size="md"
            className="wizard-cta"
            onClick={handleSubmit}
            disabled={createSolicitacao.isPending || !podeEnviar}
          >
            {createSolicitacao.isPending ? tw.submitting : tw.submit}
          </Button>
        )}
      </div>
    </div>
  );
};
