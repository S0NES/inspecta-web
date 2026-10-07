import React from 'react';
import { useTranslation } from '../../i18n';
import './PlaceholderPage.css';

interface PlaceholderPageProps {
  /** Id da tela — quando ausente, o componente age como 404 genérico do shell. */
  screen?: string;
  screenLabel?: string;
}

export const PlaceholderPage: React.FC<PlaceholderPageProps> = ({ screen, screenLabel }) => {
  const { t } = useTranslation();
  return (
    <div className="placeholder-page">
      <div className="placeholder-content">
        <div className="placeholder-icon">◬</div>
        <h1 className="type-h1-page">{screenLabel ?? t.placeholder.notFoundTitle}</h1>
        <p className="placeholder-text">
          {screen ? t.placeholder.comingSoon : t.placeholder.noAddress}
        </p>
        {screen && (
          <p className="placeholder-id">
            {t.placeholder.screenId} <code>{screen}</code>
          </p>
        )}
      </div>
    </div>
  );
};
