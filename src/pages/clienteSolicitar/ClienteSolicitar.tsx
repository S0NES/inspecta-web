import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Card, Badge } from '../../components/shared/DataDisplay';
import { InfoHint } from '../../components/shared/InfoHint';
import { FieldHint } from '../../components/shared/FieldHint';
import { BackButton } from '../../components/shared/BackButton';
import { Input, Select } from '../../components/shared/Input';
import { Icon, isIconName } from '../../components/shared/Icon';
import { useMeuClienteB2c } from '../../api/clientesB2c';
import { useCidades, useEnderecoPorCep } from '../../api/imoveis';
import { useIntervenientePapeis, isSemVistoriador } from '../../api/solicitacoes';
import {
  useCreateRascunhoB2c,
  usePatchRascunhoB2c,
  usePatchIntervenientesB2c,
  useFinalizarSolicitacaoB2c,
  isAoMenosUmIntervenienteObrigatorio,
} from '../../api/solicitacaoB2c';
import { useB2cServicos } from '../../api/b2cServicos';
import { semAcento } from '../../utils/text';
import {
  isCpf, isEmail, isNomeCompleto, isPhoneBr,
  normalizeCpf, normalizeEmail, normalizePhone,
} from '../../utils/pessoaDocumento';
import { maskCpf, maskPhone } from '../../utils/masks';
import { useTranslation, fmt } from '../../i18n';
import '../propertyWizard/PropertyWizard.css';
import '../wizard/Wizard.css';
import './ClienteSolicitar.css';

const STEP_KEYS = ['imovel', 'caracteristicas', 'servico', 'intervenientes', 'confirmacao'] as const;

const STEP_IMOVEL = 0;
const STEP_CARACTERISTICAS = 1;
const STEP_SERVICO = 2;
const STEP_INTERVENIENTES = 3;
const STEP_CONFIRMACAO = 4;

/** Valores do `<select multiple>` de "Dados do imóvel" — cobertura só existe para apartamento. */
const DADO_COBERTURA = 'cobertura';
const DADO_MOBILIADO = 'mobiliado';
const DADO_TEM_QUARTO = 'temQuarto';
const TIPO_APARTAMENTO = 'Apartamento';

interface ImovelFormData {
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  tipo: string;
  metragem: string;
  temQuarto: boolean;
  quartos: string;
  cobertura: boolean;
  mobiliado: boolean;
  valorAluguel: string;
  data: string;
  hora: string;
}

const emptyImovel = (): ImovelFormData => ({
  cep: '', endereco: '', numero: '', complemento: '', tipo: '', metragem: '',
  temQuarto: false, quartos: '', cobertura: false, mobiliado: false, valorAluguel: '',
  data: '', hora: '',
});

type Pessoa = { papelSlug: string; nome: string; cpf: string; email: string; telefone: string };
const pessoaVazia = (papelSlug: string): Pessoa => ({ papelSlug, nome: '', cpf: '', email: '', telefone: '' });
const pessoaValida = (p: Pessoa) =>
  p.papelSlug.trim() !== '' && isNomeCompleto(p.nome) && isCpf(p.cpf) && isEmail(p.email) &&
  (p.telefone.trim() === '' || isPhoneBr(p.telefone));

const money = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * `America/Sao_Paulo` não observa horário de verão desde 2019 — offset fixo -03:00.
 * Construir o ISO com o offset explícito (em vez de `new Date(dataDesejada)`, que
 * usaria o fuso do dispositivo) evita horário errado se o cliente acessar de fora do BR.
 */
const dataHoraParaIso = (data: string, hora: string): string | null => {
  if (!data || !hora) return null;
  const d = new Date(`${data}T${hora}:00-03:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

const dataHoraFormatada = (data: string, hora: string): string => {
  const iso = dataHoraParaIso(data, hora);
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
};

/**
 * Página 4 do B2C — wizard de solicitação do próprio cliente (`role: 'cliente'`).
 * 4 passos visíveis (imóvel / serviço / intervenientes / confirmação); o "passo 5"
 * do spec é a navegação para `/solicitacoes/:id/pagar` (tela já existente) ao
 * finalizar — não é renderizado aqui.
 *
 * O rascunho nasce no fim do passo "Serviço" (POST rascunho-b2c na 1ª vez; PATCH
 * depois que já existe `solicitacaoId` — 409 anterior, ou voltou e mudou data/serviço).
 * `intervenientes` é sempre PATCH (substitui a lista, exceto o acompanhante do passo
 * anterior). `finalizar` só roda no clique de "Salvar" da Confirmação.
 */
export const ClienteSolicitar: React.FC = () => {
  const { setToast } = useAppStore();
  const { t } = useTranslation();
  const tcs = t.clienteSolicitar;
  const TIPOS = t.properties.types;
  const navigate = useNavigate();

  const meQuery = useMeuClienteB2c();
  const me = meQuery.data;
  const { data: cidades = [] } = useCidades();
  const papeisQuery = useIntervenientePapeis();
  const papeis = papeisQuery.data ?? [];

  const cidadeCliente = cidades.find((c) => c.id === me?.cidadeId);
  const cidadeClienteLabel = cidadeCliente ? `${cidadeCliente.nome}/${cidadeCliente.uf}` : '';

  const { data: todosServicos = [] } = useB2cServicos();
  const servicosDisponiveis = todosServicos.filter(
    (s) => !me || me.clientServices.includes(s.id),
  );

  const [step, setStep] = useState(0);
  const [imovel, setImovel] = useState<ImovelFormData>(emptyImovel);
  const [clientServiceSel, setClientServiceSel] = useState<string | null>(null);
  const [temAcompanhante, setTemAcompanhante] = useState<boolean | null>(null);
  const [acompanhante, setAcompanhante] = useState<Pessoa>(pessoaVazia('locatario'));
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);

  const [solicitacaoId, setSolicitacaoId] = useState<string | null>(null);
  const [vistoriadorNome, setVistoriadorNome] = useState<string | null>(null);
  const [precoSnapshot, setPrecoSnapshot] = useState<number | null>(null);

  const [semVistoriadorMsg, setSemVistoriadorMsg] = useState<string | null>(null);
  const [intervenienteMsg, setIntervenienteMsg] = useState<string | null>(null);

  const createRascunho = useCreateRascunhoB2c();
  const patchRascunho = usePatchRascunhoB2c();
  const patchIntervenientes = usePatchIntervenientesB2c();
  const finalizar = useFinalizarSolicitacaoB2c();

  const toast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  };

  // Pré-seleciona quando só há um serviço habilitado (ainda assim exibido como card único).
  useEffect(() => {
    if (clientServiceSel === null && servicosDisponiveis.length === 1) {
      setClientServiceSel(servicosDisponiveis[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicosDisponiveis.length]);

  const cepDigitos = imovel.cep.replace(/\D/g, '');
  const [cepTermo, setCepTermo] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setCepTermo(cepDigitos), 500);
    return () => clearTimeout(t);
  }, [cepDigitos]);

  const enderecoCep = useEnderecoPorCep(cepTermo);
  const cepAutofilledRef = useRef<string | null>(null);
  // CEP resolveu uma cidade diferente da cidade travada do cliente — erro de campo,
  // bloqueia "Próximo" sem nem tentar o POST/PATCH (o backend também rejeitaria com 400).
  const [cepOutraCidade, setCepOutraCidade] = useState<string | null>(null);

  useEffect(() => {
    const found = enderecoCep.data;
    if (!found || cepTermo.length !== 8) return;

    // Compara direto com a cidade do cliente (não com o catálogo geral de cidades) — assim
    // o bloqueio vale mesmo se a cidade que o ViaCEP devolveu não tiver linha na nossa base.
    const cidadeDivergente = !!cidadeCliente && (
      semAcento(found.localidade) !== semAcento(cidadeCliente.nome) ||
      found.uf.toLowerCase().trim() !== cidadeCliente.uf.toLowerCase().trim()
    );
    setCepOutraCidade(cidadeDivergente ? `${found.localidade}/${found.uf}` : null);

    // Só a rua é preenchida automaticamente — complemento fica sempre a critério do cliente.
    if (cepAutofilledRef.current !== cepTermo) {
      cepAutofilledRef.current = cepTermo;
      setImovel((prev) => ({ ...prev, endereco: found.logradouro || prev.endereco }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enderecoCep.data, cepTermo, cidadeCliente]);

  const setImovelField = <K extends keyof ImovelFormData>(field: K, value: ImovelFormData[K]) =>
    setImovel((prev) => ({ ...prev, [field]: value }));

  /** "Dados do imóvel" — select nativo com multiseleção; cobertura só é uma opção para apartamento. */
  const dadosImovelValues = [
    imovel.tipo === TIPO_APARTAMENTO && imovel.cobertura ? DADO_COBERTURA : null,
    imovel.mobiliado ? DADO_MOBILIADO : null,
    imovel.temQuarto ? DADO_TEM_QUARTO : null,
  ].filter((v): v is string => v !== null);

  const handleDadosImovelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions, (o) => o.value);
    setImovel((prev) => ({
      ...prev,
      cobertura: prev.tipo === TIPO_APARTAMENTO && values.includes(DADO_COBERTURA),
      mobiliado: values.includes(DADO_MOBILIADO),
      temQuarto: values.includes(DADO_TEM_QUARTO),
      quartos: values.includes(DADO_TEM_QUARTO) ? prev.quartos : '',
    }));
  };

  /** Trocar o tipo pra algo != apartamento derruba a cobertura (a opção nem aparece mais). */
  const handleTipoChange = (tipo: string) =>
    setImovel((prev) => ({ ...prev, tipo, cobertura: tipo === TIPO_APARTAMENTO && prev.cobertura }));

  const setPessoa = (i: number, patch: Partial<Pessoa>) =>
    setPessoas((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const addPessoa = () => setPessoas((ps) => [...ps, pessoaVazia(papeis[0]?.slug ?? 'locatario')]);
  const removePessoa = (i: number) => setPessoas((ps) => ps.filter((_, idx) => idx !== i));

  const enderecoValido = imovel.endereco.trim() !== '' && !cepOutraCidade;

  const caracteristicasValido =
    imovel.tipo.trim() !== '' &&
    imovel.metragem.trim() !== '' && Number(imovel.metragem) > 0 &&
    (!imovel.temQuarto || (imovel.quartos.trim() !== '' && Number(imovel.quartos) >= 1)) &&
    imovel.data !== '' && imovel.hora !== '';

  const acompanhanteValido = temAcompanhante === false || (temAcompanhante === true && pessoaValida(acompanhante));
  const servicoValido = clientServiceSel !== null && temAcompanhante !== null && acompanhanteValido;

  const intervenientesValidos = pessoas.every(pessoaValida);

  const vistoriadorBadge = solicitacaoId && (
    <Badge tone="outline" className="cs-badge-vistoriador">
      <Icon name="check" size={12} />
      {vistoriadorNome ? fmt(tcs.inspectorReservedWithName, { nome: vistoriadorNome }) : tcs.inspectorReserved}
    </Badge>
  );

  const handleBack = () => { if (step > 0) setStep(step - 1); };

  const handleNext = async () => {
    if (step === STEP_IMOVEL) {
      if (!enderecoValido) { toast(tcs.fillRequired); return; }
      setStep(STEP_CARACTERISTICAS);
      return;
    }

    if (step === STEP_CARACTERISTICAS) {
      if (!caracteristicasValido) { toast(tcs.fillRequired); return; }
      setStep(STEP_SERVICO);
      return;
    }

    if (step === STEP_SERVICO) {
      if (!servicoValido) { toast(tcs.fillAcompanhante); return; }
      const dataIso = dataHoraParaIso(imovel.data, imovel.hora);
      if (!dataIso || !me) { toast(tcs.fillRequired); setStep(STEP_CARACTERISTICAS); return; }

      setSemVistoriadorMsg(null);
      try {
        const resp = solicitacaoId
          ? await patchRascunho.mutateAsync({
              id: solicitacaoId,
              b2cServiceId: clientServiceSel!,
              dataDesejada: dataIso,
            })
          : await createRascunho.mutateAsync({
              imovel: {
                cidadeId: me.cidadeId,
                cep: imovel.cep.trim() || null,
                endereco: imovel.endereco.trim(),
                numero: imovel.numero.trim() || null,
                complemento: imovel.complemento.trim() || null,
                metragem: Number(imovel.metragem),
                tipo: imovel.tipo || undefined,
                quartos: imovel.temQuarto ? Number(imovel.quartos) : null,
                cobertura: imovel.cobertura,
                valorAluguel: imovel.valorAluguel.trim() !== '' ? Number(imovel.valorAluguel) : null,
                mobiliado: imovel.mobiliado,
              },
              b2cServiceId: clientServiceSel!,
              dataDesejada: dataIso,
              acompanhante: temAcompanhante
                ? {
                    papelSlug: acompanhante.papelSlug || 'locatario',
                    nome: acompanhante.nome.trim(),
                    cpf: normalizeCpf(acompanhante.cpf),
                    email: normalizeEmail(acompanhante.email),
                    telefone: acompanhante.telefone.trim() ? normalizePhone(acompanhante.telefone) : undefined,
                  }
                : undefined,
            });

        setSolicitacaoId(resp.solicitacaoId);
        setVistoriadorNome(resp.vistoriadorNome);
        setPrecoSnapshot(resp.precoSnapshot);
        setStep(STEP_INTERVENIENTES);
      } catch (err) {
        if (isSemVistoriador(err)) {
          setSemVistoriadorMsg(tcs.noInspectorAvailable);
          setStep(STEP_CARACTERISTICAS);
          return;
        }
        toast(err instanceof Error ? err.message : tcs.saveError);
      }
      return;
    }

    if (step === STEP_INTERVENIENTES) {
      if (!intervenientesValidos) { toast(tcs.fillIntervenientes); return; }
      if (!solicitacaoId) { toast(tcs.saveError); setStep(STEP_IMOVEL); return; }
      try {
        await patchIntervenientes.mutateAsync({
          id: solicitacaoId,
          intervenientes: pessoas.map((p) => ({
            papelSlug: p.papelSlug,
            nome: p.nome.trim(),
            cpf: normalizeCpf(p.cpf),
            email: normalizeEmail(p.email),
            telefone: p.telefone.trim() ? normalizePhone(p.telefone) : undefined,
          })),
        });
        setIntervenienteMsg(null);
        setStep(STEP_CONFIRMACAO);
      } catch (err) {
        toast(err instanceof Error ? err.message : tcs.intervenientesSaveError);
      }
      return;
    }
  };

  const handleSalvar = async () => {
    if (!solicitacaoId) return;
    try {
      const resp = await finalizar.mutateAsync(solicitacaoId);
      setPrecoSnapshot(resp.precoSnapshot);
      navigate(`/solicitacoes/${solicitacaoId}/pagar`);
    } catch (err) {
      if (isSemVistoriador(err)) {
        setSemVistoriadorMsg(tcs.noInspectorAvailable);
        setStep(STEP_CARACTERISTICAS);
        return;
      }
      if (isAoMenosUmIntervenienteObrigatorio(err)) {
        setIntervenienteMsg(tcs.needAtLeastOneInterveniente);
        setStep(STEP_INTERVENIENTES);
        return;
      }
      toast(err instanceof Error ? err.message : tcs.finalizeError);
    }
  };

  const busy =
    createRascunho.isPending || patchRascunho.isPending ||
    patchIntervenientes.isPending || finalizar.isPending;

  const servicoSelecionado = servicosDisponiveis.find((s) => s.id === clientServiceSel) ?? null;

  const intervenientesLabel = [
    temAcompanhante && acompanhante.nome.trim() ? acompanhante.nome.trim() : null,
    ...pessoas.map((p) => p.nome.trim()).filter(Boolean),
  ].filter(Boolean).join(', ');

  if (meQuery.isLoading) {
    return (
      <div className="property-wizard-layout">
        <div className="property-wizard-container">
          <BackButton to="/dashboard" corner />
          <Card className="wizard-card"><p className="wizard-description">{tcs.loadingMe}</p></Card>
        </div>
      </div>
    );
  }

  if (meQuery.isError || !me) {
    return (
      <div className="property-wizard-layout">
        <div className="property-wizard-container">
          <BackButton to="/dashboard" corner />
          <Card className="wizard-card"><p className="wizard-description">{tcs.meLoadError}</p></Card>
        </div>
      </div>
    );
  }

  if (servicosDisponiveis.length === 0) {
    return (
      <div className="property-wizard-layout">
        <div className="property-wizard-container">
          <BackButton to="/dashboard" corner />
          <Card className="wizard-card"><p className="wizard-description">{tcs.noServiceEnabled}</p></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="property-wizard-layout">
      <div className="property-wizard-container">
        <BackButton to="/dashboard" corner />
        <InfoHint title={tcs.pageTitle}>
          <p>{tcs.pageHint}</p>
        </InfoHint>

        <div className="pw-steps">
          {STEP_KEYS.map((key, idx) => (
            <div
              key={key}
              className={`pw-step ${idx < step ? 'pw-step--done' : ''} ${idx === step ? 'pw-step--active' : ''}`}
            >
              <div className="pw-step-line" />
              <div className="pw-step-number">{String(idx + 1).padStart(2, '0')}</div>
              <div className="pw-step-label">{tcs.steps[key]}</div>
            </div>
          ))}
        </div>

        <Card className="wizard-card">
          {step === STEP_IMOVEL && (
            <div className="pw-step-content">
              <div className="pw-step-title">
                <h2 className="type-h3">{tcs.step0Title}</h2>
                <FieldHint>{tcs.step0Desc}</FieldHint>
              </div>

              <div className="form-section">
                <div className="form-group">
                  <div className="pw-label-row">
                    <label htmlFor="cs-cep" className="form-label">{tcs.cepLabel}</label>
                    <FieldHint>{enderecoCep.isFetching ? tcs.cepSearching : tcs.cepHint}</FieldHint>
                  </div>
                  <input
                    id="cs-cep"
                    className={`form-input${cepOutraCidade ? ' form-input--error' : ''}`}
                    placeholder="00000-000"
                    value={imovel.cep}
                    autoComplete="off"
                    aria-invalid={!!cepOutraCidade}
                    maxLength={9}
                    onChange={(e) => setImovelField('cep', e.target.value)}
                  />
                  {cepOutraCidade && (
                    <p className="pw-field-error">{fmt(tcs.cepWrongCity, { cidade: cepOutraCidade })}</p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="cs-cidade" className="form-label">{tcs.cityLabel}</label>
                  <input
                    id="cs-cidade"
                    className="form-input"
                    value={cidadeClienteLabel}
                    readOnly
                    aria-readonly="true"
                  />
                </div>

                <div className="pw-full">
                  <Input
                    label={tcs.streetLabel}
                    placeholder={tcs.streetPlaceholder}
                    value={imovel.endereco}
                    onChange={(e) => setImovelField('endereco', e.target.value)}
                  />
                </div>
                <Input
                  label={tcs.numberLabel}
                  placeholder={tcs.numberPlaceholder}
                  value={imovel.numero}
                  onChange={(e) => setImovelField('numero', e.target.value)}
                />
                <Input
                  label={tcs.complementLabel}
                  placeholder={tcs.complementPlaceholder}
                  value={imovel.complemento}
                  onChange={(e) => setImovelField('complemento', e.target.value)}
                />
              </div>
            </div>
          )}

          {step === STEP_CARACTERISTICAS && (
            <div className="pw-step-content">
              <div className="pw-step-title">
                <h2 className="type-h3">{tcs.step1Title}</h2>
                <FieldHint>{tcs.step1Desc}</FieldHint>
              </div>

              {semVistoriadorMsg && (
                <p className="pw-field-error cs-alert" role="alert">{semVistoriadorMsg}</p>
              )}

              <div className="form-section">
                <Select
                  label={tcs.typeLabel}
                  options={TIPOS}
                  value={imovel.tipo}
                  onChange={(e) => handleTipoChange(e.target.value)}
                />
                <div className="form-group">
                  <label htmlFor="cs-dados-imovel" className="form-label">{tcs.dadosImovelLabel}</label>
                  <select
                    id="cs-dados-imovel"
                    className="form-select"
                    multiple
                    size={3}
                    value={dadosImovelValues}
                    onChange={handleDadosImovelChange}
                  >
                    {imovel.tipo === TIPO_APARTAMENTO && (
                      <option value={DADO_COBERTURA}>{tcs.coberturaChip}</option>
                    )}
                    <option value={DADO_MOBILIADO}>{tcs.mobiliadoChip}</option>
                    <option value={DADO_TEM_QUARTO}>{tcs.quartoChip}</option>
                  </select>
                </div>

                <Input
                  label={tcs.areaLabel}
                  type="number"
                  placeholder={tcs.areaPlaceholder}
                  value={imovel.metragem}
                  onChange={(e) => setImovelField('metragem', e.target.value)}
                />
                <Input
                  label={tcs.rentValueLabel}
                  type="number"
                  min="0"
                  inputMode="decimal"
                  placeholder={tcs.rentValuePlaceholder}
                  value={imovel.valorAluguel}
                  onChange={(e) => setImovelField('valorAluguel', e.target.value)}
                />

                <Input
                  label={tcs.dateLabel}
                  type="date"
                  value={imovel.data}
                  onChange={(e) => { setImovelField('data', e.target.value); setSemVistoriadorMsg(null); }}
                />
                <Input
                  label={tcs.hourLabel}
                  type="time"
                  value={imovel.hora}
                  onChange={(e) => { setImovelField('hora', e.target.value); setSemVistoriadorMsg(null); }}
                />

                {imovel.temQuarto && (
                  <div className="pw-full">
                    <Input
                      label={tcs.quartosLabel}
                      type="number"
                      min={1}
                      placeholder={tcs.quartosPlaceholder}
                      value={imovel.quartos}
                      onChange={(e) => setImovelField('quartos', e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {step === STEP_SERVICO && (
            <div className="pw-step-content">
              <div className="pw-step-title">
                <h2 className="type-h3">{tcs.step2Title}</h2>
                <FieldHint>{tcs.step2Desc}</FieldHint>
              </div>

              <div className="wizard-inspectors" role="radiogroup" aria-label={tcs.step2Title}>
                {servicosDisponiveis.map((svc) => {
                  const selected = clientServiceSel === svc.id;
                  return (
                    <div
                      key={svc.id}
                      className={`inspector-card${selected ? ' inspector-card--selected' : ''}`}
                      role="radio"
                      aria-checked={selected}
                      tabIndex={0}
                      onClick={() => setClientServiceSel(svc.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setClientServiceSel(svc.id);
                        }
                      }}
                    >
                      <span className="inspector-avatar" aria-hidden="true">
                        <Icon name={isIconName(svc.icone) ? svc.icone : 'key'} size={22} />
                      </span>
                      <span className="inspector-info">
                        <span className="inspector-name">{svc.nome}</span>
                        <span className="inspector-role">{svc.descricao}</span>
                      </span>
                      <span className={`inspector-check${selected ? ' inspector-check--active' : ''}`} aria-hidden="true">
                        <Icon name="circle-check" size={18} />
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="pw-full">
                <p className="pw-field-hint" id="cs-acomp-label">{tcs.acompanhaQuestion}</p>
                <div className="pw-chips" role="group" aria-labelledby="cs-acomp-label">
                  <button
                    type="button"
                    className={`pw-chip ${temAcompanhante === true ? 'pw-chip--on' : ''}`}
                    aria-pressed={temAcompanhante === true}
                    onClick={() => setTemAcompanhante(true)}
                  >
                    {tcs.yes}
                  </button>
                  <button
                    type="button"
                    className={`pw-chip ${temAcompanhante === false ? 'pw-chip--on' : ''}`}
                    aria-pressed={temAcompanhante === false}
                    onClick={() => setTemAcompanhante(false)}
                  >
                    {tcs.no}
                  </button>
                </div>
              </div>

              {temAcompanhante && (
                <div className="wizard-form-grid">
                  <div className="form-group">
                    <label className="form-label" htmlFor="cs-acomp-papel">{tcs.roleLabel}</label>
                    <select
                      id="cs-acomp-papel"
                      className="form-select"
                      value={acompanhante.papelSlug}
                      onChange={(e) => setAcompanhante((a) => ({ ...a, papelSlug: e.target.value }))}
                    >
                      {papeis.length === 0 && <option value="locatario">Locatário</option>}
                      {papeis.map((pp) => <option key={pp.slug} value={pp.slug}>{pp.nome}</option>)}
                    </select>
                  </div>
                  <Input
                    label={tcs.fullNameLabel}
                    value={acompanhante.nome}
                    aria-invalid={acompanhante.nome.trim() !== '' && !isNomeCompleto(acompanhante.nome)}
                    onChange={(e) => setAcompanhante((a) => ({ ...a, nome: e.target.value }))}
                  />
                  <Input
                    label={tcs.cpfLabel}
                    value={acompanhante.cpf}
                    inputMode="numeric"
                    aria-invalid={acompanhante.cpf.trim() !== '' && !isCpf(acompanhante.cpf)}
                    onChange={(e) => setAcompanhante((a) => ({ ...a, cpf: maskCpf(e.target.value) }))}
                  />
                  <Input
                    label={tcs.emailLabel}
                    value={acompanhante.email}
                    aria-invalid={acompanhante.email.trim() !== '' && !isEmail(acompanhante.email)}
                    onChange={(e) => setAcompanhante((a) => ({ ...a, email: e.target.value }))}
                  />
                  <Input
                    label={tcs.phoneLabel}
                    value={acompanhante.telefone}
                    inputMode="numeric"
                    placeholder={tcs.phonePlaceholder}
                    aria-invalid={acompanhante.telefone.trim() !== '' && !isPhoneBr(acompanhante.telefone)}
                    onChange={(e) => setAcompanhante((a) => ({ ...a, telefone: maskPhone(e.target.value) }))}
                  />
                </div>
              )}
            </div>
          )}

          {step === STEP_INTERVENIENTES && (
            <div className="pw-step-content">
              <div className="pw-step-title">
                <h2 className="type-h3">{tcs.step3Title}</h2>
                <FieldHint>{tcs.step3Desc}</FieldHint>
              </div>
              {vistoriadorBadge}
              {intervenienteMsg && (
                <p className="pw-field-error cs-alert" role="alert">{intervenienteMsg}</p>
              )}

              {temAcompanhante && acompanhante.nome.trim() && (
                <p className="pw-field-hint cs-acompanhante-note">
                  {fmt(tcs.acompanhanteNote, { nome: acompanhante.nome.trim() })}
                </p>
              )}

              <div className="wizard-int-list">
                {pessoas.map((p, i) => (
                  <div key={i} className="wizard-int-card">
                    <div className="wizard-form-grid">
                      <div className="form-group">
                        <label className="form-label" htmlFor={`cs-int-papel-${i}`}>{tcs.roleLabel}</label>
                        <select
                          id={`cs-int-papel-${i}`}
                          className="form-select"
                          value={p.papelSlug}
                          onChange={(e) => setPessoa(i, { papelSlug: e.target.value })}
                        >
                          {papeis.length === 0 && <option value="locatario">Locatário</option>}
                          {papeis.map((pp) => <option key={pp.slug} value={pp.slug}>{pp.nome}</option>)}
                        </select>
                      </div>
                      <Input
                        label={tcs.fullNameLabel}
                        value={p.nome}
                        aria-invalid={p.nome.trim() !== '' && !isNomeCompleto(p.nome)}
                        onChange={(e) => setPessoa(i, { nome: e.target.value })}
                      />
                      <Input
                        label={tcs.cpfLabel}
                        value={p.cpf}
                        inputMode="numeric"
                        aria-invalid={p.cpf.trim() !== '' && !isCpf(p.cpf)}
                        onChange={(e) => setPessoa(i, { cpf: maskCpf(e.target.value) })}
                      />
                      <Input
                        label={tcs.emailLabel}
                        value={p.email}
                        aria-invalid={p.email.trim() !== '' && !isEmail(p.email)}
                        onChange={(e) => setPessoa(i, { email: e.target.value })}
                      />
                      <Input
                        label={tcs.phoneLabel}
                        value={p.telefone}
                        inputMode="numeric"
                        placeholder={tcs.phonePlaceholder}
                        aria-invalid={p.telefone.trim() !== '' && !isPhoneBr(p.telefone)}
                        onChange={(e) => setPessoa(i, { telefone: maskPhone(e.target.value) })}
                      />
                    </div>
                    <button type="button" className="wizard-int-remove" onClick={() => removePessoa(i)}>
                      {t.common.remove}
                    </button>
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={addPessoa}>{tcs.addPerson}</Button>
            </div>
          )}

          {step === STEP_CONFIRMACAO && (
            <div className="pw-step-content">
              <div className="pw-step-title">
                <h2 className="type-h3">{tcs.step4Title}</h2>
                <FieldHint>{tcs.step4Desc}</FieldHint>
              </div>
              {vistoriadorBadge}

              <div className="pw-summary">
                <div className="pw-summary-section">
                  <p className="pw-summary-label">{tcs.sumAddress}</p>
                  <p className="pw-summary-value">
                    {[imovel.endereco, imovel.numero].filter(Boolean).join(', ') || tcs.notFilled}
                  </p>
                  <p className="pw-summary-value">{cidadeClienteLabel}</p>
                </div>
                <div className="pw-summary-section">
                  <p className="pw-summary-label">{tcs.sumService}</p>
                  <p className="pw-summary-value">{servicoSelecionado?.nome ?? tcs.notSelected}</p>
                </div>
                <div className="pw-summary-section">
                  <p className="pw-summary-label">{tcs.sumDateTime}</p>
                  <p className="pw-summary-value">
                    {dataHoraFormatada(imovel.data, imovel.hora) || tcs.notFilled}
                  </p>
                </div>
                <div className="pw-summary-section">
                  <p className="pw-summary-label">{tcs.sumInspector}</p>
                  <p className="pw-summary-value">{vistoriadorNome ?? tcs.toConfirm}</p>
                </div>
                <div className="pw-summary-section">
                  <p className="pw-summary-label">{tcs.sumInterveners}</p>
                  <p className="pw-summary-value">{intervenientesLabel || tcs.notFilled}</p>
                </div>
                <div className="pw-summary-section">
                  <p className="pw-summary-label">{tcs.sumValue}</p>
                  <p className="pw-summary-value">{money(precoSnapshot)}</p>
                </div>
              </div>
            </div>
          )}
        </Card>

        <div className="pw-footer">
          <div className="pw-footer-left">
            <Button variant="ghost" size="md" disabled={step === STEP_IMOVEL} onClick={handleBack}>
              {t.common.back}
            </Button>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={step === STEP_CONFIRMACAO ? () => void handleSalvar() : () => void handleNext()}
            disabled={busy}
          >
            {step === STEP_CONFIRMACAO ? (finalizar.isPending ? tcs.saving : tcs.save) : t.common.next}
          </Button>
        </div>
      </div>
    </div>
  );
};
