import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { getNavItems, isGroup } from '../../utils/navigation';
import { apiClient } from '../../api/client';
import { useTranslation } from '../../i18n';
import { Icon } from '../shared/Icon';
import './Sidebar.css';

export const Sidebar: React.FC = () => {
  const {
    role,
    sidebarCollapsed,
    toggleSidebar,
    auth,
    logout,
    setToast,
  } = useAppStore();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  /** Rótulo de exibição de cada perfil vindo do backend. */
  const PERFIL_LABEL: Record<string, string> = t.layout.sidebar.roles;
  const items = getNavItems(role, auth.perfil);
  const [menuOpen, setMenuOpen] = useState(false);
  const [gruposAbertos, setGruposAbertos] = useState<Record<string, boolean>>({});
  const footerRef = useRef<HTMLDivElement>(null);

  const toggleGrupo = (g: string) => setGruposAbertos((s) => ({ ...s, [g]: !s[g] }));

  const childActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  // Abre automaticamente o grupo cuja rota está ativa.
  useEffect(() => {
    for (const node of items) {
      if (isGroup(node) && node.children.some((c) => childActive(c.to))) {
        setGruposAbertos((s) => (s[node.group] ? s : { ...s, [node.group]: true }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Clique fora fecha o menu — sem isso ele só fecharia clicando de novo no perfil.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!footerRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  // A sidebar colapsada não tem onde ancorar o menu; fecha ao colapsar.
  useEffect(() => {
    if (sidebarCollapsed) setMenuOpen(false);
  }, [sidebarCollapsed]);

  const email = auth.userEmail ?? '';
  const emailName = email ? email.split('@')[0].replace(/[._-]/g, ' ') : '';
  const displayName = auth.userName?.trim() || emailName || t.layout.sidebar.defaultUser;
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || 'U';
  const perfilLabel = auth.perfil ? PERFIL_LABEL[auth.perfil] ?? auth.perfil : '';

  const handleLogout = async () => {
    setMenuOpen(false);
    try {
      await apiClient.logout();
    } finally {
      logout();
      navigate('/login');
      setToast(t.layout.sidebar.loggedOut);
      setTimeout(() => setToast(null), 4200);
    }
  };

  const handleAccessProfile = () => {
    setMenuOpen(false);
    navigate('/profile');
  };

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar-header">
        {/* Os dois logos ficam sempre montados; a CSS alterna por .sidebar--collapsed.
            Trocar o `src` no toggle causava um flash enquanto o novo SVG carregava.
            Expandida: lockup horizontal negativo (branco). Recolhida: símbolo vermelho. */}
        <img src="/inspecta-horizontal-negativo.svg" alt={t.nav.root} className="sidebar-logo" />
        <img src="/inspecta-simbolo-vermelho.svg" alt={t.nav.root} className="sidebar-logo-mark" />

        <button
          className="sidebar-hamburger"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? t.layout.sidebar.expandMenu : t.layout.sidebar.collapseMenu}
          aria-expanded={!sidebarCollapsed}
          title={sidebarCollapsed ? t.layout.sidebar.expandMenu : t.layout.sidebar.collapseMenu}
        >
          <span className="hamburger-box" aria-hidden="true">
            <Icon name="menu" size={20} />
          </span>
        </button>
      </div>

      <nav className="sidebar-nav">
        {items.map((node) => {
          if (!isGroup(node)) {
            return (
              <NavLink
                key={node.to}
                to={node.to}
                end={node.to === '/dashboard'}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
                title={node.label}
              >
                <span className="nav-icon"><Icon name={node.icon} /></span>
                {!sidebarCollapsed && <span className="nav-label">{node.label}</span>}
              </NavLink>
            );
          }

          const aberto = !!gruposAbertos[node.group];
          const temAtivo = node.children.some((c) => childActive(c.to));
          return (
            <div key={node.group} className="nav-group">
              <button
                className={`nav-item nav-group-header ${temAtivo ? 'nav-item--active' : ''}`}
                onClick={() => toggleGrupo(node.group)}
                title={node.label}
                aria-expanded={aberto}
              >
                <span className="nav-icon"><Icon name={node.icon} /></span>
                {!sidebarCollapsed && (
                  <>
                    <span className="nav-label">{node.label}</span>
                    <span className={`nav-group-caret ${aberto ? 'nav-group-caret--open' : ''}`} aria-hidden="true">
                      <Icon name="chevron-down" size={14} />
                    </span>
                  </>
                )}
              </button>
              {aberto && !sidebarCollapsed && (
                <div className="nav-group-children">
                  {node.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      className={({ isActive }) => `nav-item nav-item--child ${isActive ? 'nav-item--active' : ''}`}
                      title={child.label}
                    >
                      <span className="nav-icon"><Icon name={child.icon} /></span>
                      <span className="nav-label">{child.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* O clique no perfil abre um menu com acesso ao perfil e saída. */}
      <div className="sidebar-footer" ref={footerRef}>
        {menuOpen && !sidebarCollapsed && (
          <div className="profile-menu" role="menu">
            <div className="profile-menu-email" title={email}>
              {email}
            </div>
            <button className="profile-menu-item" role="menuitem" onClick={handleAccessProfile}>
              {t.layout.sidebar.accessProfile}
            </button>
            <button
              className="profile-menu-item profile-menu-item--danger"
              role="menuitem"
              onClick={handleLogout}
            >
              <Icon name="log-out" size={14} /> {t.layout.sidebar.logout}
            </button>
          </div>
        )}

        <button
          className="sidebar-profile"
          // Recolhida não há onde ancorar o menu: o clique expande a sidebar primeiro.
          onClick={() => (sidebarCollapsed ? toggleSidebar() : setMenuOpen((v) => !v))}
          title={email || t.layout.sidebar.profile}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <span className="profile-avatar">{initials}</span>
          {!sidebarCollapsed && (
            <>
              <span className="profile-info">
                <span className="profile-name">{displayName}</span>
                <span className="profile-role">{perfilLabel}</span>
              </span>
              <span className={`profile-caret ${menuOpen ? 'profile-caret--open' : ''}`} aria-hidden="true">
                <Icon name="chevron-up" size={14} />
              </span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
