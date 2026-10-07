import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../../components/shared/Button';
import { Card } from '../../components/shared/DataDisplay';
import { InfoHint } from '../../components/shared/InfoHint';
import { FieldHint } from '../../components/shared/FieldHint';
import { BackButton } from '../../components/shared/BackButton';
import { Input, Select } from '../../components/shared/Input';
import {
  useCreateImovel,
  usePatchImovel,
  useImovel,
  useCidades,
  useEnderecoPorCep,
} from '../../api/imoveis';
import { useImobiliarias } from '../../api/admin';
import { matchCidadePorCep } from '../../utils/text';
import { newIdempotencyKey } from '../../utils/idempotency';
import { useTranslation, fmt } from '../../i18n';
import './PropertyWizard.css';

interface PropertyFormData {
  address: string;
  numero: string;
  complemento: string;
  cep: string;
  cidadeId: string;
  imobiliariaId: string;
  type: string;
  metragem: string;
  cobertura: boolean;
  temQuarto: boolean;
  quartos: string;
}

const emptyFormData = (): PropertyFormData => ({
  address: '',
  numero: '',
  complemento: '',
  cep: '',
  cidadeId: '',
  imobiliariaId: '',
  type: '',
  metragem: '',
  cobertura: false,
  temQuarto: false,
  quartos: '',
});

export const PropertyWizard: React.FC = () => {
  const {
    propertyWizardStep, setPropertyWizardStep, setToast, role, auth,
  } = useAppStore();
  const { t } = useTranslation();
  const tpw = t.propertyWizard;
  const TIPOS = t.properties.types;
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState<PropertyFormData>(emptyFormData);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  // Modo edição: rota `/properties/:id/edit`.
  const propertyId = routeId ?? null;
  const isEditing = propertyId != null;

  // Atalho vindo do wizard de solicitação: `?imobiliariaId=<id>&returnTo=<rota>`.
  // Nunca no modo edição — `/properties/:id/edit` não carrega esses params.
  const lockedImobiliariaId = !isEditing ? searchParams.get('imobiliariaId') : null;
  const returnTo = !isEditing ? searchParams.get('returnTo') : null;

  useEffect(() => {
    if (lockedImobiliariaId) {
      setFormData((p) => ({ ...p, imobiliariaId: lockedImobiliariaId }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const imovelQuery = useImovel(propertyId);
  const [hidratado, setHidratado] = useState(false);

  // GET do imóvel falhou (id inexistente / sem acesso): volta para a lista.
  useEffect(() => {
    if (isEditing && imovelQuery.isError) {
      setToast(tpw.notFound);
      setTimeout(() => setToast(null), 4000);
      navigate('/properties');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, imovelQuery.isError]);
  // Snapshot dos valores pré-preenchidos — o PATCH final manda só o que mudou,
  // mesma cautela do ImobiliariaEditForm (não sobrescreve com valor obsoleto um
  // campo que outra pessoa alterou entre abrir e salvar).
  const snapshotRef = useRef<PropertyFormData | null>(null);
  // Último CEP (8 dígitos) já aplicado pelo autofill — evita reaplicar em cada render
  // e evita sobrescrever a edição hidratada.
  const cepAutofilledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isEditing || hidratado || !imovelQuery.data) return;
    const imovel = imovelQuery.data;
    const next: PropertyFormData = {
      address: imovel.endereco ?? '',
      numero: imovel.numero ?? '',
      complemento: imovel.complemento ?? '',
      cep: imovel.cep ?? '',
      cidadeId: imovel.cidadeId ?? '',
      imobiliariaId: imovel.imobiliariaId ?? '',
      type: imovel.tipo ?? '',
      metragem: imovel.metragem != null ? String(imovel.metragem) : '',
      cobertura: imovel.cobertura === true,
      temQuarto: imovel.quartos != null && imovel.quartos > 0,
      quartos: imovel.quartos != null && imovel.quartos > 0 ? String(imovel.quartos) : '',
    };
    setFormData(next);
    snapshotRef.current = next;
    // Não deixa o autofill de CEP re-sobrescrever o endereço já hidratado (só refaz
    // se o usuário alterar o CEP depois de abrir a edição).
    cepAutofilledRef.current = (next.cep || '').replace(/\D/g, '');
    setHidratado(true);
  }, [isEditing, hidratado, imovelQuery.data]);

  // B4: quem precisa escolher a imobiliária explicitamente (admin ou >1 vínculo).
  const vinculos = auth.imobiliariaIds ?? [];
  const precisaEscolherImobiliaria = role === 'admin' || vinculos.length > 1;
  const { data: imobiliariasPage } = useImobiliarias(undefined, { enabled: precisaEscolherImobiliaria });
  const imobiliariasDisponiveis = (imobiliariasPage?.content ?? []).filter(
    (im) => role === 'admin' || vinculos.includes(im.id),
  );

  // API hooks for creating/updating property and fetching cities
  const createImovelMutation = useCreateImovel();
  const patchImovelMutation = usePatchImovel();
  const { data: cidades = [], isLoading: isLoadingCidades } = useCidades();
  const cidadeSelecionada = cidades.find((c) => c.id === formData.cidadeId);

  // CEP-first: consulta direta de CEP (debounce ~500ms) que preenche cidade/rua/complemento.
  const cepDigitos = formData.cep.replace(/\D/g, '');
  const [cepTermo, setCepTermo] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setCepTermo(cepDigitos), 500);
    return () => clearTimeout(t);
  }, [cepDigitos]);

  const enderecoCep = useEnderecoPorCep(cepTermo);
  // CEP consultado que não bateu com nenhuma cidade cadastrada (mostra a dica dedicada).
  const [cidadeDoCepNaoCadastrada, setCidadeDoCepNaoCadastrada] = useState<string | null>(null);

  useEffect(() => {
    const found = enderecoCep.data;
    if (!found || cepTermo.length !== 8) return;

    const match = matchCidadePorCep(cidades, found.localidade, found.uf);
    // Nunca falha em silêncio: cidade do CEP fora da lista cadastrada -> dica dedicada.
    setCidadeDoCepNaoCadastrada(
      !match && found.localidade ? `${found.localidade}/${found.uf}` : null,
    );

    if (cepAutofilledRef.current !== cepTermo) {
      // Primeira vez que vemos este CEP: preenche rua/complemento (e cidade, se bateu).
      cepAutofilledRef.current = cepTermo;
      setFormData((prev) => ({
        ...prev,
        address: found.logradouro || prev.address,
        complemento: found.complemento || prev.complemento,
        cidadeId: match ? match.id : prev.cidadeId,
      }));
    } else if (match) {
      // A lista de cidades chegou depois da resposta do CEP — completa o match
      // sem mexer no que o usuário já ajustou.
      setFormData((prev) => (prev.cidadeId ? prev : { ...prev, cidadeId: match.id }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enderecoCep.data, cepTermo, cidades]);

  // CEP resolveu uma cidade que não está cadastrada e o usuário ainda não escolheu
  // uma manualmente — vira erro vermelho no campo de CEP.
  const cepCidadeErro = !!cidadeDoCepNaoCadastrada && !formData.cidadeId;

  const handleInputChange = (field: keyof PropertyFormData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePrevStep = () => {
    if (propertyWizardStep > 0) {
      setPropertyWizardStep(propertyWizardStep - 1);
    }
  };

  const handleNextStep = async () => {
    // Basic validation
    if (propertyWizardStep === 0) {
      if (!formData.address || !formData.cidadeId) {
        setToast(tpw.fillAddressCity);
        return;
      }
      if (precisaEscolherImobiliaria && !formData.imobiliariaId) {
        setToast(tpw.selectAgency);
        return;
      }
    } else if (propertyWizardStep === 1) {
      if (!formData.type || !formData.metragem) {
        setToast(tpw.fillAllFields);
        return;
      }
      if (formData.temQuarto) {
        const n = Number(formData.quartos);
        if (!formData.quartos.trim() || Number.isNaN(n) || n < 1) {
          setToast(tpw.quartosRequired);
          return;
        }
      }
    }

    if (propertyWizardStep < 2) {
      setPropertyWizardStep(propertyWizardStep + 1);
    } else if (isEditing && propertyId != null) {
      // PATCH — manda só os campos que mudaram em relação ao snapshot pré-preenchido.
      try {
        const inicial = snapshotRef.current;
        const patch: Record<string, unknown> = {};
        if (!inicial || formData.address !== inicial.address) patch.endereco = formData.address;
        if (!inicial || formData.numero !== inicial.numero) patch.numero = formData.numero.trim() || null;
        if (!inicial || formData.complemento !== inicial.complemento) {
          patch.complemento = formData.complemento.trim() || null;
        }
        if (!inicial || formData.cep !== inicial.cep) patch.cep = formData.cep.trim() || null;
        if (!inicial || formData.cidadeId !== inicial.cidadeId) patch.cidadeId = formData.cidadeId;
        if (!inicial || formData.imobiliariaId !== inicial.imobiliariaId) {
          patch.imobiliariaId = formData.imobiliariaId ? formData.imobiliariaId : null;
        }
        if (!inicial || formData.type !== inicial.type) patch.tipo = formData.type || undefined;
        if (!inicial || formData.metragem !== inicial.metragem) patch.metragem = parseFloat(formData.metragem);
        if (!inicial || formData.cobertura !== inicial.cobertura) patch.cobertura = formData.cobertura;
        if (!inicial || formData.temQuarto !== inicial.temQuarto || formData.quartos !== inicial.quartos) {
          // 0 = sentinela de "chip desligado"; o PATCH trata <=0 como null (omit vs null não dá para distinguir).
          patch.quartos = formData.temQuarto ? parseInt(formData.quartos, 10) : 0;
        }

        await patchImovelMutation.mutateAsync({ id: propertyId, ...patch });

        setToast(tpw.updated);
        setPropertyWizardStep(0);
        setFormData(emptyFormData());
        navigate('/properties');
      } catch (error) {
        setToast(tpw.updateError);
      }
    } else {
      // Submit to API — payload matches the real Imovel entity (cidadeId FK, endereco,
      // cep, metragem, mobiliado, tipo). No dormitorios/banheiros/tipoAcesso: the
      // backend has no such columns (see dominio.md `imoveis`).
      try {
        const novo = await createImovelMutation.mutateAsync({
          cidadeId: formData.cidadeId,
          endereco: formData.address,
          numero: formData.numero.trim() || null,
          complemento: formData.complemento.trim() || null,
          cep: formData.cep.trim() || null,
          metragem: parseFloat(formData.metragem),
          // Ocultos nesta iteração — enviados com o default seguro (reintroduzidos depois).
          mobiliado: false,
          valorAluguel: null,
          tipo: formData.type || undefined,
          cobertura: formData.cobertura,
          quartos: formData.temQuarto ? parseInt(formData.quartos, 10) : null,
          imobiliariaId: formData.imobiliariaId ? formData.imobiliariaId : undefined,
          idempotencyKey,
        });

        setIdempotencyKey(newIdempotencyKey());
        setToast(tpw.created);
        setPropertyWizardStep(0);
        setFormData(emptyFormData());
        if (returnTo) {
          const sep = returnTo.includes('?') ? '&' : '?';
          navigate(`${returnTo}${sep}createdImovelId=${encodeURIComponent(novo.id)}`);
        } else {
          navigate('/properties');
        }
      } catch (error) {
        setToast(tpw.createError);
      }
    }
  };

  const steps = [
    { id: 0, label: tpw.steps.address },
    { id: 1, label: tpw.steps.features },
    { id: 2, label: tpw.steps.confirmation },
  ];

  // Ao sair do wizard (inclusive pelo "Voltar" do topo), zera o passo para a
  // próxima abertura não retomar no meio.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => setPropertyWizardStep(0), []);

  // Edição: dados ainda não chegaram — evita mostrar o form vazio por um instante.
  if (isEditing && !hidratado && imovelQuery.isLoading) {
    return (
      <div className="property-wizard-layout">
        <div className="property-wizard-container">
          <BackButton to={returnTo ?? undefined} corner />
          <InfoHint title={tpw.editTitle}>
            <p>{tpw.editHint}</p>
          </InfoHint>
          <Card className="wizard-card">
            <p className="wizard-description">{tpw.loadingProperty}</p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="property-wizard-layout">
      <div className="property-wizard-container">
        <BackButton to={returnTo ?? undefined} />
        <InfoHint title={isEditing ? tpw.editTitle : tpw.createTitle}>
          <p>{isEditing ? tpw.editHint : tpw.createHint}</p>
        </InfoHint>

        {/* Steps */}
        <div className="pw-steps">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={`pw-step ${
                idx < propertyWizardStep ? 'pw-step--done' : ''
              } ${idx === propertyWizardStep ? 'pw-step--active' : ''}`}
            >
              <div className="pw-step-line"></div>
              <div className="pw-step-number">{String(step.id + 1).padStart(2, '0')}</div>
              <div className="pw-step-label">{step.label}</div>
            </div>
          ))}
        </div>

        {/* Content */}
        <Card className="wizard-card">
          {propertyWizardStep === 0 && (
            <div className="pw-step-content">
              <h2 className="type-h3">{tpw.step0Title}</h2>
              <p className="wizard-description">{tpw.step0Desc}</p>

              <div className="form-section">
                {lockedImobiliariaId ? (
                  <div className="form-group pw-full">
                    <label htmlFor="imobiliariaId" className="form-label">{tpw.agencyLabel}</label>
                    <select
                      id="imobiliariaId"
                      className="form-select"
                      value={formData.imobiliariaId}
                      disabled
                    >
                      <option value={lockedImobiliariaId}>{tpw.agencyFromRequest}</option>
                    </select>
                    <p className="pw-field-hint">{tpw.agencyLockedHint}</p>
                  </div>
                ) : precisaEscolherImobiliaria && (
                  <div className="form-group pw-full">
                    <label htmlFor="imobiliariaId" className="form-label">{tpw.agencyLabel}</label>
                    <select
                      id="imobiliariaId"
                      className="form-select"
                      value={formData.imobiliariaId}
                      onChange={(e) => handleInputChange('imobiliariaId', e.target.value)}
                    >
                      <option value="">{t.common.select}</option>
                      {imobiliariasDisponiveis.map((im) => (
                        <option key={im.id} value={im.id}>{im.nomeFantasia || im.razaoSocial}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <div className="pw-label-row">
                    <label htmlFor="cep" className="form-label">{tpw.cepLabel}</label>
                    <FieldHint>
                      {enderecoCep.isFetching ? tpw.cepSearching : tpw.cepHint}
                    </FieldHint>
                  </div>
                  <input
                    id="cep"
                    className={`form-input${cepCidadeErro ? ' form-input--error' : ''}`}
                    placeholder={tpw.cepPlaceholder}
                    value={formData.cep}
                    autoComplete="off"
                    aria-invalid={cepCidadeErro || undefined}
                    maxLength={9}
                    onChange={(e) => handleInputChange('cep', e.target.value)}
                  />
                  {cepCidadeErro && (
                    <p className="pw-field-error">
                      {fmt(tpw.cepCityNotRegistered, { cidade: cidadeDoCepNaoCadastrada })}
                    </p>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="cidadeId" className="form-label">{tpw.cityLabel}</label>
                  <input
                    id="cidadeId"
                    className="form-input"
                    value={cidadeSelecionada ? `${cidadeSelecionada.nome}/${cidadeSelecionada.uf}` : ''}
                    placeholder={isLoadingCidades ? t.common.loading : tpw.cityFromCep}
                    readOnly
                    aria-readonly="true"
                  />
                </div>

                <div className="pw-full">
                  <Input
                    label={tpw.streetLabel}
                    placeholder={tpw.streetPlaceholder}
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                  />
                </div>
                <Input
                  label={tpw.numberLabel}
                  placeholder={tpw.numberPlaceholder}
                  value={formData.numero}
                  onChange={(e) => handleInputChange('numero', e.target.value)}
                />
                <Input
                  label={tpw.complementLabel}
                  placeholder={tpw.complementPlaceholder}
                  value={formData.complemento}
                  onChange={(e) => handleInputChange('complemento', e.target.value)}
                />
              </div>
            </div>
          )}

          {propertyWizardStep === 1 && (
            <div className="pw-step-content">
              <h2 className="type-h3">{tpw.step1Title}</h2>
              <p className="wizard-description">{tpw.step1Desc}</p>

              <div className="form-section">
                <Select
                  label={tpw.typeLabel}
                  options={TIPOS}
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                />
                <Input
                  label={tpw.areaLabel}
                  type="number"
                  placeholder={tpw.areaPlaceholder}
                  value={formData.metragem}
                  onChange={(e) => handleInputChange('metragem', e.target.value)}
                />
                <div className="pw-full">
                  <p className="pw-field-hint" id="pw-features-chips-label">{tpw.featuresChipsAria}</p>
                  <div className="pw-chips" role="group" aria-labelledby="pw-features-chips-label">
                    <button
                      type="button"
                      className={`pw-chip ${formData.cobertura ? 'pw-chip--on' : ''}`}
                      aria-pressed={formData.cobertura}
                      onClick={() => handleInputChange('cobertura', !formData.cobertura)}
                    >
                      {tpw.coberturaChip}
                    </button>
                    <button
                      type="button"
                      className={`pw-chip ${formData.temQuarto ? 'pw-chip--on' : ''}`}
                      aria-pressed={formData.temQuarto}
                      aria-expanded={formData.temQuarto}
                      aria-controls={formData.temQuarto ? 'pw-quartos-quantos' : undefined}
                      onClick={() => {
                        setFormData((prev) => {
                          const next = !prev.temQuarto;
                          return { ...prev, temQuarto: next, quartos: next ? prev.quartos : '' };
                        });
                      }}
                    >
                      {tpw.quartoChip}
                    </button>
                  </div>
                </div>
                {formData.temQuarto && (
                  <div id="pw-quartos-quantos" className="pw-full">
                    <Input
                      label={tpw.quartosQuantosLabel}
                      type="number"
                      min={1}
                      placeholder={tpw.quartosQuantosPlaceholder}
                      value={formData.quartos}
                      onChange={(e) => handleInputChange('quartos', e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {propertyWizardStep === 2 && (
            <div className="pw-step-content">
              <h2 className="type-h3">{tpw.step2Title}</h2>
              <p className="wizard-description">
                {isEditing ? tpw.step2DescEdit : tpw.step2DescCreate}
              </p>

              <div className="pw-summary">
                <div className="pw-summary-section">
                  <p className="pw-summary-label">{tpw.sumAddress}</p>
                  <p className="pw-summary-value">
                    {[formData.address, formData.numero].filter(Boolean).join(', ') || tpw.notFilled}
                  </p>
                  {formData.complemento && (
                    <p className="pw-summary-value">{formData.complemento}</p>
                  )}
                  <p className="pw-summary-value">
                    {formData.cep ? formData.cep : tpw.cepNotInformed}
                  </p>
                  <p className="pw-summary-value">
                    {cidadeSelecionada ? `${cidadeSelecionada.nome}/${cidadeSelecionada.uf}` : tpw.notSelected}
                  </p>
                </div>
                <div className="pw-summary-section">
                  <p className="pw-summary-label">{tpw.sumFeatures}</p>
                  <p className="pw-summary-value">{formData.type || tpw.notSelected}</p>
                  <p className="pw-summary-value">
                    {formData.metragem ? `${formData.metragem} m²` : tpw.notDefined}
                  </p>
                  <p className="pw-summary-value">
                    {formData.cobertura ? tpw.sumCobertura : tpw.sumNoCobertura}
                  </p>
                  {formData.temQuarto && formData.quartos && (
                    <p className="pw-summary-value">
                      {fmt(tpw.sumQuartos, { n: formData.quartos })}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* Footer Navigation */}
        <div className="pw-footer">
          <div className="pw-footer-left">
            <Button
              variant="ghost"
              size="md"
              disabled={propertyWizardStep === 0}
              onClick={handlePrevStep}
            >
              {t.common.back}
            </Button>
          </div>
          <Button
            variant="primary"
            size="md"
            onClick={handleNextStep}
            disabled={propertyWizardStep === 2 && (createImovelMutation.isPending || patchImovelMutation.isPending)}
          >
            {propertyWizardStep === 2
              ? ((createImovelMutation.isPending || patchImovelMutation.isPending)
                  ? tpw.saving
                  : (isEditing ? tpw.saveChanges : tpw.saveProperty))
              : t.common.next}
          </Button>
        </div>
      </div>
    </div>
  );
};
