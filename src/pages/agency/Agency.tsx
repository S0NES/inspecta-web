import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../components/shared/DataDisplay';
import { Input } from '../../components/shared/Input';
import { Button } from '../../components/shared/Button';
import { InfoHint } from '../../components/shared/InfoHint';
import { FieldHint } from '../../components/shared/FieldHint';
import { BackButton } from '../../components/shared/BackButton';
import { useAppStore } from '../../store/useAppStore';
import { useCreateImobiliaria, useImobiliaria, useUpdateImobiliaria } from '../../api/admin';
import {
  useCidades,
  useEnderecoPorCep,
} from '../../api/imoveis';
import {
  usePutContrato,
  usePutContratoGrupos,
  usePutContratoFaixas,
} from '../../api/contratos';
import { BiletagemSection, type BiletagemDraft } from '../../components/shared/ImobiliariaEditForm';
import { PlenoCadastroExterno } from '../../components/shared/PlenoCadastroExterno';
import { newIdempotencyKey } from '../../utils/idempotency';
import { matchCidadePorCep } from '../../utils/text';
import { isCnpj, isEmail, isPhoneBr, normalizeCnpj, normalizeEmail, normalizePhone } from '../../utils/pessoaDocumento';
import { maskCnpj, maskPhone } from '../../utils/masks';
import { useTranslation, fmt } from '../../i18n';
import '../propertyWizard/PropertyWizard.css';

interface AgencyFormData {
  razaoSocial: string;
  cnpj: string;
  // Endereço — mesma convenção e mesma UX de CEP do PropertyWizard.
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  cidadeId: string;
  // Contato / financeiro:
  pix: string;
  emailFinanceiro: string;
  telefone: string;
}

const emptyFormData = (): AgencyFormData => ({
  razaoSocial: '',
  cnpj: '',
  cep: '',
  endereco: '',
  numero: '',
  complemento: '',
  cidadeId: '',
  pix: '',
  emailFinanceiro: '',
  telefone: '',
});

// Passos do wizard.
const STEP_DADOS = 0;
const STEP_ENDERECO = 1;
const STEP_FINANCEIRO = 2;
const STEP_BILETAGEM = 3;
const STEP_CONFIRMACAO = 4;

export const Agency: React.FC = () => {
  const { setToast, realEstateWizardStep: step, setRealEstateWizardStep: setStep } = useAppStore();
  const { t } = useTranslation();
  const ta = t.agency;
  const STEPS = [
    { id: STEP_DADOS, label: ta.steps.data },
    { id: STEP_ENDERECO, label: ta.steps.address },
    { id: STEP_FINANCEIRO, label: ta.steps.financial },
    { id: STEP_BILETAGEM, label: ta.steps.biletagem },
    { id: STEP_CONFIRMACAO, label: ta.steps.confirmation },
  ];
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const agencyId = routeId ?? null;
  const isEditing = agencyId != null;
  const createMutation = useCreateImobiliaria();
  const updateMutation = useUpdateImobiliaria();
  const putContrato = usePutContrato();
  const putGrupos = usePutContratoGrupos();
  const putFaixas = usePutContratoFaixas();
  const [formData, setFormData] = useState<AgencyFormData>(emptyFormData);
  const [plenoExterno, setPlenoExterno] = useState(false);
  const [plenoIdExterno, setPlenoIdExterno] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [biletagemDraft, setBiletagemDraft] = useState<BiletagemDraft>({
    modo: 'faixa',
    percentualMinimo: null,
    grupos: [],
    faixas: [],
  });
  const [biletagemPronta, setBiletagemPronta] = useState(!isEditing);

  const imobiliariaQuery = useImobiliaria(agencyId);
  const [hidratado, setHidratado] = useState(false);

  // Cidades cadastradas — mesma fonte de verdade do cadastro de imóvel.
  const { data: cidades = [], isLoading: isLoadingCidades } = useCidades();
  const cidadeSelecionada = cidades.find((c) => c.id === formData.cidadeId);

  // Zera o passo do wizard ao montar; ao desmontar, deixa limpo para a próxima abertura.
  useEffect(() => {
    setStep(0);
    return () => setStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GET da imobiliária falhou (id inexistente / sem acesso): volta para a lista.
  useEffect(() => {
    if (isEditing && imobiliariaQuery.isError) {
      setToast(ta.notFound);
      setTimeout(() => setToast(null), 4000);
      navigate('/agencies');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, imobiliariaQuery.isError]);

  // Snapshot dos valores pré-preenchidos — o PATCH final manda só o que mudou
  // (mesma cautela que o antigo ImobiliariaEditForm.salvar já tinha).
  const snapshotRef = useRef<AgencyFormData | null>(null);
  // Último CEP (8 dígitos) já aplicado pelo autofill — evita reaplicar em cada render.
  const cepAutofilledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isEditing || hidratado || !imobiliariaQuery.data) return;
    const imob = imobiliariaQuery.data;
    const next: AgencyFormData = {
      razaoSocial: imob.razaoSocial ?? '',
      cnpj: imob.cnpj ?? '',
      cep: imob.cep ?? '',
      endereco: imob.endereco ?? '',
      numero: imob.numero ?? '',
      complemento: imob.complemento ?? '',
      cidadeId: imob.cidadeId ?? '',
      pix: imob.pix ?? '',
      emailFinanceiro: imob.emailFinanceiro ?? '',
      telefone: imob.telefone ?? '',
    };
    setFormData(next);
    snapshotRef.current = next;
    cepAutofilledRef.current = (next.cep || '').replace(/\D/g, '');
    setHidratado(true);
  }, [isEditing, hidratado, imobiliariaQuery.data]);

  const MASKS: Record<string, (v: string) => string> = {
    cnpj: maskCnpj,
    telefone: maskPhone,
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const masked = MASKS[name] ? MASKS[name](value) : value;
    setFormData((prev) => ({ ...prev, [name]: masked }));
  };

  const cnpjInvalido = formData.cnpj.trim() !== '' && !isCnpj(formData.cnpj);
  const emailFinInvalido = formData.emailFinanceiro.trim() !== '' && !isEmail(formData.emailFinanceiro);
  const telefoneInvalido = formData.telefone.trim() !== '' && !isPhoneBr(formData.telefone);

  // ── CEP-first: consulta direta de CEP (debounce ~500ms) que preenche cidade/rua/complemento.
  const cepDigitos = formData.cep.replace(/\D/g, '');
  const [cepTermo, setCepTermo] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setCepTermo(cepDigitos), 500);
    return () => clearTimeout(id);
  }, [cepDigitos]);

  const enderecoCep = useEnderecoPorCep(cepTermo);
  const [cidadeDoCepNaoCadastrada, setCidadeDoCepNaoCadastrada] = useState<string | null>(null);

  useEffect(() => {
    const found = enderecoCep.data;
    if (!found || cepTermo.length !== 8) return;

    const match = matchCidadePorCep(cidades, found.localidade, found.uf);
    setCidadeDoCepNaoCadastrada(
      !match && found.localidade ? `${found.localidade}/${found.uf}` : null,
    );

    if (cepAutofilledRef.current !== cepTermo) {
      cepAutofilledRef.current = cepTermo;
      setFormData((prev) => ({
        ...prev,
        endereco: found.logradouro || prev.endereco,
        complemento: found.complemento || prev.complemento,
        cidadeId: match ? match.id : prev.cidadeId,
      }));
    } else if (match) {
      setFormData((prev) => (prev.cidadeId ? prev : { ...prev, cidadeId: match.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enderecoCep.data, cepTermo, cidades]);

  // CEP resolveu uma cidade fora da lista cadastrada e nenhuma foi escolhida ainda.
  const cepCidadeErro = !!cidadeDoCepNaoCadastrada && !formData.cidadeId;

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  /** Valida o passo; devolve true se pode avançar/enviar (senão dispara o toast). */
  const validarPasso = (s: number): boolean => {
    if (s === STEP_DADOS) {
      if (isEditing) {
        if (!formData.razaoSocial.trim()) {
          setToast(ta.razaoSocialRequired);
          return false;
        }
        return true;
      }
      if (!formData.razaoSocial || !formData.cnpj) {
        setToast(ta.fillRequired);
        return false;
      }
      if (!isEditing && !isCnpj(formData.cnpj)) {
        setToast(ta.cnpjInvalid);
        return false;
      }
      if (telefoneInvalido || emailFinInvalido) {
        setToast(t.validation.fixFields);
        return false;
      }
      return true;
    }
    if (s === STEP_ENDERECO) {
      if (!formData.endereco.trim() || !formData.cidadeId) {
        setToast(ta.addressRequired);
        return false;
      }
      return true;
    }
    if (s === STEP_FINANCEIRO) {
      if (!isEditing && plenoExterno && !plenoIdExterno) {
        setToast(ta.plenoCodeRequired);
        return false;
      }
      return true;
    }
    return true;
  };

  const handleNext = () => {
    if (!validarPasso(step)) return;
    if (step < STEP_CONFIRMACAO) {
      setStep(step + 1);
      return;
    }
    void submeter();
  };

  const submeter = async () => {
    // Revalida os passos anteriores antes do envio final.
    if (!validarPasso(STEP_DADOS) || !validarPasso(STEP_ENDERECO) || !validarPasso(STEP_FINANCEIRO)) return;

    if (isEditing) {
      setIsSubmitting(true);
      try {
        const inicial = snapshotRef.current;
        const patch: Record<string, unknown> = {};
        if (!inicial || formData.razaoSocial !== inicial.razaoSocial) patch.razaoSocial = formData.razaoSocial;
        if (!inicial || formData.cep !== inicial.cep) patch.cep = formData.cep.trim() || null;
        if (!inicial || formData.endereco !== inicial.endereco) patch.endereco = formData.endereco.trim() || null;
        if (!inicial || formData.numero !== inicial.numero) patch.numero = formData.numero.trim() || null;
        if (!inicial || formData.complemento !== inicial.complemento) patch.complemento = formData.complemento.trim() || null;
        if (!inicial || formData.cidadeId !== inicial.cidadeId) patch.cidadeId = formData.cidadeId || null;
        if (!inicial || formData.pix !== inicial.pix) patch.pix = formData.pix;
        if (!inicial || formData.emailFinanceiro !== inicial.emailFinanceiro) patch.emailFinanceiro = formData.emailFinanceiro;
        if (!inicial || formData.telefone !== inicial.telefone) patch.telefone = formData.telefone;

        if (Object.keys(patch).length > 0) {
          await updateMutation.mutateAsync({ id: agencyId!, ...patch });
        }
        if (biletagemPronta) {
          await putContrato.mutateAsync({
            imobiliariaId: agencyId!,
            modo: biletagemDraft.modo,
            percentualMinimo: biletagemDraft.percentualMinimo,
          });
          await putGrupos.mutateAsync({ imobiliariaId: agencyId!, grupos: biletagemDraft.grupos });
          if (biletagemDraft.modo === 'faixa') {
            await putFaixas.mutateAsync({ imobiliariaId: agencyId!, faixas: biletagemDraft.faixas });
          }
        }

        setToast(ta.updated);
        setTimeout(() => setToast(null), 4200);
        setStep(0);
        navigate('/agencies');
      } catch (error: any) {
        setToast(error.message || ta.updateError);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        razaoSocial: formData.razaoSocial,
        cnpj: normalizeCnpj(formData.cnpj),
        cep: formData.cep.trim() || undefined,
        endereco: formData.endereco.trim() || undefined,
        numero: formData.numero.trim() || undefined,
        complemento: formData.complemento.trim() || undefined,
        cidadeId: formData.cidadeId || undefined,
        pix: formData.pix || undefined,
        emailFinanceiro: formData.emailFinanceiro.trim() ? normalizeEmail(formData.emailFinanceiro) : undefined,
        telefone: formData.telefone.trim() ? normalizePhone(formData.telefone) : undefined,
        plenoIdExterno: plenoExterno ? plenoIdExterno : undefined,
        contrato: {
          modo: biletagemDraft.modo,
          percentualMinimo: biletagemDraft.percentualMinimo,
          grupos: biletagemDraft.grupos,
          faixas: biletagemDraft.modo === 'faixa' ? biletagemDraft.faixas : [],
        },
        idempotencyKey,
      });

      setIdempotencyKey(newIdempotencyKey());
      setToast(ta.created);
      setFormData(emptyFormData());
      setPlenoExterno(false);
      setPlenoIdExterno('');
      setStep(0);

      setTimeout(() => setToast(null), 4200);
      navigate('/agencies');
    } catch (error: any) {
      setToast(error.message || ta.createError);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing && !hidratado && imobiliariaQuery.isLoading) {
    return (
      <div className="property-wizard-layout agency-wizard-layout">
        <div className="property-wizard-container">
          <BackButton corner />
          <InfoHint title={ta.editTitle}>
            <p>{ta.editHintFull}</p>
          </InfoHint>
          <Card className="wizard-card">
            <p className="wizard-description">{ta.loading}</p>
          </Card>
        </div>
      </div>
    );
  }

  const linha = (label: string, value: string) => (
    <div className="pw-summary-section">
      <p className="pw-summary-label">{label}</p>
      <p className="pw-summary-value">{value || '—'}</p>
    </div>
  );

  const enderecoFormatado = [formData.endereco, formData.numero].filter(Boolean).join(', ');
  const cidadeFormatada = cidadeSelecionada
    ? `${cidadeSelecionada.nome}/${cidadeSelecionada.uf}`
    : '';

  return (
    <div className="property-wizard-layout agency-wizard-layout">
      <div className="property-wizard-container">
        <BackButton />
        <InfoHint title={isEditing ? ta.editTitle : ta.createTitle}>
          <p>{isEditing ? ta.editHint : ta.createHint}</p>
        </InfoHint>

        {/* Steps */}
        <div className="pw-steps">
          {STEPS.map((s, idx) => (
            <div
              key={s.id}
              className={`pw-step ${idx < step ? 'pw-step--done' : ''} ${idx === step ? 'pw-step--active' : ''}`}
            >
              <div className="pw-step-line"></div>
              <div className="pw-step-number">{String(s.id + 1).padStart(2, '0')}</div>
              <div className="pw-step-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Content */}
        <Card className="wizard-card">
          {step === STEP_DADOS && (
            <div className="pw-step-content">
              <div className="pw-step-title">
                <h2 className="type-h3">{ta.step0Title}</h2>
                <FieldHint>{ta.step0Desc}</FieldHint>
              </div>

              <div className="form-section">
                <div className="pw-full">
                  <Input
                    label={ta.companyNameLabel}
                    name="razaoSocial"
                    placeholder={ta.companyNamePlaceholder}
                    value={formData.razaoSocial}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="pw-full form-group">
                  <div className="pw-label-row">
                    <label htmlFor="agency-cnpj" className="form-label">{ta.cnpjLabel}</label>
                    {isEditing && <FieldHint>{ta.cnpjImmutable}</FieldHint>}
                  </div>
                  <input
                    id="agency-cnpj"
                    className={`form-input${cnpjInvalido ? ' form-input--error' : ''}`}
                    name="cnpj"
                    inputMode="numeric"
                    placeholder={ta.cnpjPlaceholder}
                    value={formData.cnpj}
                    onChange={handleInputChange}
                    required={!isEditing}
                    disabled={isEditing}
                    aria-invalid={cnpjInvalido || undefined}
                    maxLength={18}
                  />
                  {cnpjInvalido && <p className="pw-field-error" role="alert">{t.validation.cnpjInvalid}</p>}
                </div>
              </div>
            </div>
          )}

          {step === STEP_ENDERECO && (
            <div className="pw-step-content">
              <div className="pw-step-title">
                <h2 className="type-h3">{ta.stepAddressTitle}</h2>
                <FieldHint>{ta.stepAddressDesc}</FieldHint>
              </div>

              <div className="form-section">
                <div className="form-group">
                  <div className="pw-label-row">
                    <label htmlFor="cep" className="form-label">{ta.cepLabel}</label>
                    <FieldHint>
                      {enderecoCep.isFetching ? ta.cepSearching : ta.cepHint}
                    </FieldHint>
                  </div>
                  <input
                    id="cep"
                    name="cep"
                    className={`form-input${cepCidadeErro ? ' form-input--error' : ''}`}
                    placeholder={ta.cepPlaceholder}
                    value={formData.cep}
                    autoComplete="off"
                    aria-invalid={cepCidadeErro || undefined}
                    maxLength={9}
                    onChange={handleInputChange}
                  />
                  {cepCidadeErro && (
                    <p className="pw-field-error">
                      {fmt(ta.cepCityNotRegistered, { cidade: cidadeDoCepNaoCadastrada })}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="cidadeId" className="form-label">{ta.cityLabel}</label>
                  <input
                    id="cidadeId"
                    className="form-input"
                    value={cidadeSelecionada ? `${cidadeSelecionada.nome}/${cidadeSelecionada.uf}` : ''}
                    placeholder={isLoadingCidades ? t.common.loading : ta.cityFromCep}
                    readOnly
                    aria-readonly="true"
                  />
                </div>

                <div className="pw-full">
                  <Input
                    label={ta.streetLabel}
                    name="endereco"
                    placeholder={ta.streetPlaceholder}
                    value={formData.endereco}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <Input
                  label={ta.numberLabel}
                  name="numero"
                  placeholder={ta.numberPlaceholder}
                  value={formData.numero}
                  onChange={handleInputChange}
                />
                <Input
                  label={ta.addrComplementLabel}
                  name="complemento"
                  placeholder={ta.addrComplementPlaceholder}
                  value={formData.complemento}
                  onChange={handleInputChange}
                />
              </div>
            </div>
          )}

          {/* Financeiro — só visível no passo, mas fica montado p/ preservar valores. */}
          <div
            className="pw-step-content"
            hidden={step !== STEP_FINANCEIRO}
            aria-hidden={step !== STEP_FINANCEIRO}
            style={step !== STEP_FINANCEIRO ? { display: 'none' } : undefined}
          >
            <div className="pw-step-title">
              <h2 className="type-h3">{ta.step1Title}</h2>
              <FieldHint>{ta.step1Desc}</FieldHint>
            </div>

            <div className="form-section">
              <Input
                label={ta.phoneLabel}
                name="telefone"
                inputMode="numeric"
                placeholder={ta.phonePlaceholder}
                value={formData.telefone}
                maxLength={16}
                aria-invalid={telefoneInvalido || undefined}
                onChange={handleInputChange}
              />
              {telefoneInvalido && <p className="pw-field-error" role="alert">{t.validation.phoneInvalid}</p>}
              <Input
                label={ta.invoiceEmailLabel}
                name="emailFinanceiro"
                type="email"
                placeholder={ta.invoiceEmailPlaceholder}
                value={formData.emailFinanceiro}
                aria-invalid={emailFinInvalido || undefined}
                onChange={handleInputChange}
              />
              {emailFinInvalido && <p className="pw-field-error" role="alert">{t.validation.emailInvalid}</p>}
              <Input
                label={ta.pixLabel}
                name="pix"
                placeholder={ta.pixPlaceholder}
                value={formData.pix}
                onChange={handleInputChange}
              />
            </div>

            {/* Pleno — vínculo de cadastro externo, só faz sentido na criação (o PATCH
                de edição não aceita plenoIdExterno). */}
            {!isEditing && (
              <PlenoCadastroExterno
                ativo={plenoExterno}
                onAtivoChange={setPlenoExterno}
                idExterno={plenoIdExterno}
                onIdExternoChange={setPlenoIdExterno}
                campoLabel={ta.plenoFieldLabel}
              />
            )}
          </div>

          {/* Biletagem — passo próprio; a seção hidrata do contrato e reporta o draft,
              por isso fica sempre montada. */}
          <div
            className="pw-step-content"
            hidden={step !== STEP_BILETAGEM}
            aria-hidden={step !== STEP_BILETAGEM}
            style={step !== STEP_BILETAGEM ? { display: 'none' } : undefined}
          >
            <div className="pw-step-title">
              <h2 className="type-h3">{ta.stepBiletagemTitle}</h2>
              <FieldHint>{ta.stepBiletagemDesc}</FieldHint>
            </div>

            <BiletagemSection
              imobiliariaId={isEditing ? agencyId : null}
              showSaveButton={false}
              onDraftChange={(d) => {
                setBiletagemDraft(d);
                setBiletagemPronta(true);
              }}
              onToast={(m) => { setToast(m); setTimeout(() => setToast(null), 3500); }}
            />
          </div>

          {step === STEP_CONFIRMACAO && (
            <div className="pw-step-content">
              <div className="pw-step-title">
                <h2 className="type-h3">{ta.step2Title}</h2>
                <FieldHint>{isEditing ? ta.step2DescEdit : ta.step2DescCreate}</FieldHint>
              </div>

              <div className="pw-summary">
                {linha(ta.sumCompanyName, formData.razaoSocial)}
                {linha(ta.sumCnpj, formData.cnpj)}
                {linha(ta.sumAddress, [enderecoFormatado, formData.complemento].filter(Boolean).join(' — '))}
                {linha(ta.sumCity, cidadeFormatada)}
                {linha(ta.sumCep, formData.cep)}
                {linha(ta.sumPhone, formData.telefone)}
                {linha(ta.sumFinanceEmail, formData.emailFinanceiro)}
                {linha(ta.sumPix, formData.pix)}
                {!isEditing && plenoExterno && linha(ta.sumPlenoCode, plenoIdExterno)}
                {linha(ta.sumBiletagem, biletagemDraft.modo === 'percentual' ? ta.sumBiletagemPercent : ta.sumBiletagemFaixa)}
              </div>
            </div>
          )}
        </Card>

        {/* Footer Navigation */}
        <div className="pw-footer">
          <div className="pw-footer-left">
            <Button variant="ghost" size="md" disabled={step === 0} onClick={handlePrev}>
              {t.common.back}
            </Button>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleNext}
            disabled={step === STEP_CONFIRMACAO && isSubmitting}
          >
            {step === STEP_CONFIRMACAO
              ? (isSubmitting
                  ? (isEditing ? ta.saving : ta.creating)
                  : (isEditing ? ta.saveChanges : ta.createAgency))
              : t.common.next}
          </Button>
        </div>
      </div>
    </div>
  );
};
