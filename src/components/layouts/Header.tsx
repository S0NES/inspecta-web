import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { IconButton } from '../shared/Button';
import { Icon } from '../shared/Icon';
import { getBreadcrumb } from '../../utils/navigation';
import { useTranslation } from '../../i18n';
import { apiClient } from '../../api/client';
import './Header.css';

export const Header: React.FC = () => {
  const { role, theme, toggleTheme, sidebarCollapsed } = useAppStore();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const crumbs = getBreadcrumb(pathname, role);

  return (
    <header className={`header ${sidebarCollapsed ? 'header--collapsed' : ''}`}>
      <div className="header-content">
        <div className="header-title">
          {/* Trilha em cascata: todo degrau menos o último navega. */}
          <nav className="header-crumbs" aria-label={t.layout.header.breadcrumbNav}>
            {crumbs.map((crumb, i) => {
              const ultimo = i === crumbs.length - 1;
              return (
                <React.Fragment key={`${crumb.label}-${i}`}>
                  {i > 0 && (
                    <span className="crumb-sep" aria-hidden="true">
                      /
                    </span>
                  )}
                  {ultimo || !crumb.to ? (
                    <span className="crumb crumb--current" aria-current="page">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link className="crumb crumb--link" to={crumb.to}>
                      {crumb.label}
                    </Link>
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        </div>

        {/* Perfil e logout vivem no rodapé da barra lateral. */}
        <div className="header-actions">
          <IconButton
            variant="ghost"
            size="md"
            onClick={() => {
              const next = theme === 'light' ? 'dark' : 'light';
              toggleTheme();
              void apiClient.atualizarTema(next).catch(() => {
                // Preferência local já foi aplicada; o próximo login re-sincroniza com o servidor.
              });
            }}
            title={theme === 'light' ? t.layout.header.darkMode : t.layout.header.lightMode}
          >
            {/* Ícone de traço (Lucide), não emoji (FRONTEND.md §1). */}
            <Icon name={theme === 'light' ? 'theme-dark' : 'theme-light'} size={20} />
          </IconButton>
        </div>
      </div>
    </header>
  );
};
