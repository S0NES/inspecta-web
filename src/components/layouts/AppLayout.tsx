import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { Toast } from '../shared/DataDisplay';
import './AppLayout.css';

interface AppLayoutProps {
  /** Conteúdo explícito (usado em testes). Em produção o router injeta via `<Outlet />`. */
  children?: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { sidebarCollapsed, toastMessage, setToast } = useAppStore();

  return (
    <div className="app-layout">
      <Sidebar />
      <Header />
      <main className={`app-main ${sidebarCollapsed ? 'app-main--collapsed' : ''}`}>
        {children ?? <Outlet />}
      </main>
      {toastMessage && <Toast message={toastMessage} onClose={() => setToast(null)} />}
    </div>
  );
};
