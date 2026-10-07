import React from 'react';
import { useTranslation } from '../../i18n';
import './FormElements.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input: React.FC<InputProps> = ({ label, ...props }) => {
  const id = props.id || `input-${Math.random()}`;
  return (
    <div className="form-group">
      {label && <label htmlFor={id} className="form-label">{label}</label>}
      <input id={id} className="form-input" {...props} />
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: string[];
}

export const Select: React.FC<SelectProps> = ({ label, options, ...props }) => {
  const { t } = useTranslation();
  const id = props.id || `select-${Math.random()}`;
  return (
    <div className="form-group">
      {label && <label htmlFor={id} className="form-label">{label}</label>}
      <select id={id} className="form-select" {...props}>
        <option value="">{t.common.select}</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </div>
  );
};

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({ label, ...props }) => {
  const id = props.id || `checkbox-${Math.random()}`;
  return (
    <div className="form-group checkbox-group">
      <input id={id} type="checkbox" className="form-checkbox" {...props} />
      {label && <label htmlFor={id} className="checkbox-label">{label}</label>}
    </div>
  );
};

interface RadioProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Radio: React.FC<RadioProps> = ({ label, ...props }) => {
  const id = props.id || `radio-${Math.random()}`;
  return (
    <div className="form-group radio-group">
      <input id={id} type="radio" className="form-radio" {...props} />
      {label && <label htmlFor={id} className="radio-label">{label}</label>}
    </div>
  );
};

interface SwitchProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Switch: React.FC<SwitchProps> = ({ label, ...props }) => {
  const id = props.id || `switch-${Math.random()}`;
  return (
    <div className="form-group switch-group">
      <input id={id} type="checkbox" className="form-switch" {...props} />
      <label htmlFor={id} className="switch-label"></label>
      {label && <span className="switch-text">{label}</span>}
    </div>
  );
};
