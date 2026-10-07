import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../components/shared/DataDisplay';
import { Input } from '../../components/shared/Input';
import { Button } from '../../components/shared/Button';
import { InfoHint } from '../../components/shared/InfoHint';
import { FieldHint } from '../../components/shared/FieldHint';
import { BackButton } from '../../components/shared/BackButton';
import { Icon, isIconName } from '../../components/shared/Icon';
import { useAppStore } from '../../store/useAppStore';
import {
  useCreateClienteB2c,
  usePatchClienteB2c,
  useClienteB2c,
} from '../../api/clientesB2c';
import { useCidades } from '../../api/imoveis';
import { useB2cServicos } from '../../api/b2cServicos';
import { ApiError } from '../../api/client';
import {
  isCpf,
  isEmail,
  isPhoneBr,
  isNomeCompleto,
  normalizeCpf,
  normalizeEmail,
  normalizePhone,
} from '../../utils/pessoaDocumento';
import { maskCpf, maskPhone } from '../../utils/masks';
import { useTranslation } from '../../i18n';
import '../propertyWizard/PropertyWizard.css';
// `.inspector-card` / `.wizard-inspectors` (seleção múltipla de serviços) — CSS já existe
// e não tem uso atual em Wizard.tsx; reaproveitado aqui em vez de duplicar a regra.
import '../wizard/Wizard.css';

interface ClienteFormData {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  cidadeId: string;
  clientServices: string[];
}

const emptyFormData = (): ClienteFormData => ({
  nome: '',
  email: '',
  cpf: '',
  telefone: '',
  cidadeId: '',
  clientServices: [],
});

const STEP_DADOS = 0;
const STEP_SERVICO = 1;
const STEP_CONFIRMACAO = 2;

const sameServices = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);

export const ClienteWizard: React.FC = () => {
  const { setToast, clienteWizardStep: step, setClienteWizardStep: setStep } = useAppStore();
  const { t } = useTranslation();
  const tc = t.clienteWizard;
  const STEPS = [
    { id: STEP_DADOS, label: tc.steps.data },
    { id: STEP_SERVICO, label: tc.steps.service },
    { id: STEP_CONFIRMACAO, label: tc.steps.confirmation },
  ];
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const clienteId = routeId ?? null;
  const isEditing = clienteId != null;

  const createMutation = useCreateClienteB2c();
  const updateMutation = usePatchClienteB2c();
  const [formData, setFormData] = useState<ClienteFormData>(emptyFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const clienteQuery = useClienteB2c(clienteId);
  const [hidratado, setHidratado] = useState(false);

  const { data: cidades = [], isLoading: isLoadingCidades } = useCidades();
  const cidadeSelecionada = cidades.find((c) => c.id === formData.cidadeId);
  const { data: b2cServicos = [] } = useB2cServicos();

  // Zera o passo do wizard ao montar; ao desmontar, deixa limpo para a próxima abertura.
  useEffect(() => {
    setStep(0);
    return () => setStep(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // GET do cliente falhou (id inexistente / sem acesso): volta para a lista.
  useEffect(() => {
    if (isEditing && clienteQuery.isError) {
      setToast(tc.notFound);
      setTimeout(() => setToast(null), 4000);
      navigate('/clientes');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, clienteQuery.isError]);

  // Snapshot dos valores pré-preenchidos — o PATCH final manda só o que mudou.
  const snapshotRef = useRef<ClienteFormData | null>(null);

  useEffect(() => {
    if (!isEditing || hidratado || !clienteQuery.data) return;
    const cliente = clienteQuery.data;
    const next: ClienteFormData = {
      nome: cliente.nome ?? '',
      email: cliente.email ?? '',
      cpf: cliente.cpf ?? '',
      telefone: cliente.telefone ?? '',
      cidadeId: cliente.cidadeId ?? '',
      clientServices: cliente.clientServices ?? [],
    };
    setFormData(next);
    snapshotRef.current = next;
    setHidratado(true);
  }, [isEditing, hidratado, clienteQuery.data]);

  const MASKS: Record<string, (v: string) => string> = {
    cpf: maskCpf,
    telefone: maskPhone,
  };
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const masked = MASKS[name] ? MASKS[name](value) : value;
    setFormData((prev) => ({ ...prev, [name]: masked }));
    if (name === 'email') setEmailError(null);
  };

  const toggleService = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      clientServices: prev.clientServices.includes(id)
        ? prev.clientServices.filter((s) => s !== id)
        : [...prev.clientServices, id],
    }));
  };

  const nomeInvalido = formData.nome.trim() !== '' && !isNomeCompleto(formData.nome);
  const emailInvalido = formData.email.trim() !== '' && !isEmail(formData.email);
  const cpfInvalido = formData.cpf.trim() !== '' && !isCpf(formData.cpf);
  const telefoneInvalido = formData.telefone.trim() !== '' && !isPhoneBr(formData.telefone);

  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  /** Valida o passo; devolve true se pode avançar/enviar (senão dispara o toast). */
  const validarPasso = (s: number): boolean => {
    if (s === STEP_DADOS) {
      if (!formData.nome.trim() || !formData.cidadeId) {
        setToast(tc.fillRequired);
        return false;
      }
      if (!isNomeCompleto(formData.nome)) {
        setToast(tc.nameInvalid);
        return false;
      }
      if (telefoneInvalido) {
        setToast(t.validation.phoneInvalid);
        return false;
      }
      if (!isEditing) {
        if (!formData.email.trim() || !formData.cpf.trim()) {
          setToast(tc.fillRequired);
          return false;
        }
        if (!isEmail(formData.email)) {
          setToast(t.validation.emailInvalid);
          return false;
        }
        if (!isCpf(formData.cpf)) {
          setToast(t.validation.cpfInvalid);
          return false;
        }
      }
      return true;
    }
    if (s === STEP_SERVICO) {
      if (formData.clientServices.length === 0) {
        setToast(tc.serviceRequired);
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
    if (!validarPasso(STEP_DADOS) || !validarPasso(STEP_SERVICO)) return;

    if (isEditing) {
      setIsSubmitting(true);
      try {
        const inicial = snapshotRef.current;
        const patch: Record<string, unknown> = {};
        if (!inicial || formData.nome !== inicial.nome) patch.nome = formData.nome.trim();
        if (!inicial || formData.telefone !== inicial.telefone) {
          patch.telefone = normalizePhone(formData.telefone);
        }
        if (!inicial || formData.cidadeId !== inicial.cidadeId) patch.cidadeId = formData.cidadeId;
        if (!inicial || !sameServices(formData.clientServices, inicial.clientServices)) {
          patch.clientServices = formData.clientServices;
        }

        if (Object.keys(patch).length > 0) {
          await updateMutation.mutateAsync({ id: clienteId!, ...patch });
        }

        setToast(tc.updated);
        setTimeout(() => setToast(null), 4200);
        setStep(0);
        navigate('/clientes');
      } catch (error: any) {
        setToast(error?.message || tc.updateError);
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        nome: formData.nome.trim(),
        email: normalizeEmail(formData.email),
        cpf: normalizeCpf(formData.cpf),
        telefone: normalizePhone(formData.telefone),
        cidadeId: formData.cidadeId,
        clientServices: formData.clientServices,
      });

      setToast(tc.created);
      setFormData(emptyFormData());
      setStep(0);
      setTimeout(() => setToast(null), 4200);
      navigate('/clientes');
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setEmailError(tc.emailDuplicate);
        setStep(STEP_DADOS);
      } else {
        setToast((error as Error)?.message || tc.createError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isEditing && !hidratado && clienteQuery.isLoading) {
    return (
      <div className="property-wizard-layout agency-wizard-layout">
        <div className="property-wizard-container">
          <BackButton corner />
          <InfoHint title={tc.editTitle}>
            <p>{tc.editHintFull}</p>
          </InfoHint>
          <Card className="wizard-card">
            <p className="wizard-description">{tc.loading}</p>
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

  const cidadeFormatada = cidadeSelecionada ? `${cidadeSelecionada.nome}/${cidadeSelecionada.uf}` : '';
  const servicosFormatados = b2cServicos
    .filter((s) => formData.clientServices.includes(s.id))
    .map((s) => s.nome)
    .join(', ');

  return (
    <div className="property-wizard-layout agency-wizard-layout">
      <div className="property-wizard-container">
        <BackButton />
        <InfoHint title={isEditing ? tc.editTitle : tc.createTitle}>
          <p>{isEditing ? tc.editHint : tc.createHint}</p>
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
                <h2 className="type-h3">{tc.step0Title}</h2>
                <FieldHint>{tc.step0Desc}</FieldHint>
              </div>

              <div className="form-section">
                <div className="pw-full">
                  <Input
                    label={tc.nameLabel}
                    name="nome"
                    placeholder={tc.namePlaceholder}
                    value={formData.nome}
                    onChange={handleInputChange}
                    aria-invalid={nomeInvalido || undefined}
                    required
                  />
                  {nomeInvalido && <p className="pw-field-error" role="alert">{tc.nameInvalid}</p>}
                </div>

                <div className="pw-full form-group">
                  <div className="pw-label-row">
                    <label htmlFor="cliente-email" className="form-label">{tc.emailLabel}</label>
                    {isEditing && <FieldHint>{tc.emailImmutable}</FieldHint>}
                  </div>
                  <input
                    id="cliente-email"
                    className={`form-input${emailInvalido || emailError ? ' form-input--error' : ''}`}
                    name="email"
                    type="email"
                    placeholder={tc.emailPlaceholder}
                    value={formData.email}
                    onChange={handleInputChange}
                    required={!isEditing}
                    disabled={isEditing}
                    aria-invalid={(emailInvalido || !!emailError) || undefined}
                  />
                  {emailInvalido && <p className="pw-field-error" role="alert">{t.validation.emailInvalid}</p>}
                  {emailError && <p className="pw-field-error" role="alert">{emailError}</p>}
                </div>

                <div className="form-group">
                  <div className="pw-label-row">
                    <label htmlFor="cliente-cpf" className="form-label">{tc.cpfLabel}</label>
                    {isEditing && <FieldHint>{tc.cpfImmutable}</FieldHint>}
                  </div>
                  <input
                    id="cliente-cpf"
                    className={`form-input${cpfInvalido ? ' form-input--error' : ''}`}
                    name="cpf"
                    inputMode="numeric"
                    placeholder={tc.cpfPlaceholder}
                    value={formData.cpf}
                    onChange={handleInputChange}
                    required={!isEditing}
                    disabled={isEditing}
                    aria-invalid={cpfInvalido || undefined}
                    maxLength={14}
                  />
                  {cpfInvalido && <p className="pw-field-error" role="alert">{t.validation.cpfInvalid}</p>}
                </div>

                <Input
                  label={tc.phoneLabel}
                  name="telefone"
                  inputMode="numeric"
                  placeholder={tc.phonePlaceholder}
                  value={formData.telefone}
                  maxLength={16}
                  aria-invalid={telefoneInvalido || undefined}
                  onChange={handleInputChange}
                />
                {telefoneInvalido && <p className="pw-field-error" role="alert">{t.validation.phoneInvalid}</p>}

                <div className="pw-full form-group">
                  <label htmlFor="cliente-cidade" className="form-label">{tc.cityLabel}</label>
                  <select
                    id="cliente-cidade"
                    className="form-select"
                    value={formData.cidadeId}
                    onChange={(e) => setFormData((prev) => ({ ...prev, cidadeId: e.target.value }))}
                  >
                    <option value="">{isLoadingCidades ? t.common.loading : t.common.select}</option>
                    {cidades.map((c) => (
                      <option key={c.id} value={c.id}>{c.nome}/{c.uf}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {step === STEP_SERVICO && (
            <div className="pw-step-content">
              <div className="pw-step-title">
                <h2 className="type-h3">{tc.step1Title}</h2>
                <FieldHint>{tc.step1Desc}</FieldHint>
              </div>

              <div className="wizard-inspectors" role="group" aria-label={tc.step1Desc}>
                {b2cServicos.map((svc) => {
                  const selected = formData.clientServices.includes(svc.id);
                  return (
                    <div
                      key={svc.id}
                      className={`inspector-card${selected ? ' inspector-card--selected' : ''}`}
                      role="checkbox"
                      aria-checked={selected}
                      tabIndex={0}
                      onClick={() => toggleService(svc.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleService(svc.id);
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
            </div>
          )}

          {step === STEP_CONFIRMACAO && (
            <div className="pw-step-content">
              <div className="pw-step-title">
                <h2 className="type-h3">{tc.step2Title}</h2>
                <FieldHint>{isEditing ? tc.step2DescEdit : tc.step2DescCreate}</FieldHint>
              </div>

              <div className="pw-summary">
                {linha(tc.sumName, formData.nome)}
                {linha(tc.sumEmail, formData.email)}
                {linha(tc.sumCpf, formData.cpf)}
                {linha(tc.sumPhone, formData.telefone)}
                {linha(tc.sumCity, cidadeFormatada || tc.notSelected)}
                {linha(tc.sumServices, servicosFormatados || tc.noServiceSelected)}
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
                  ? (isEditing ? tc.saving : tc.creating)
                  : (isEditing ? tc.saveChanges : tc.createClient))
              : t.common.next}
          </Button>
        </div>
      </div>
    </div>
  );
};
