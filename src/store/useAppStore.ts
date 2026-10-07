import { create } from 'zustand';

export type Role = 'corretor' | 'vistoriador' | 'admin' | 'cliente';

/** Visualização da tela de Solicitações: lista paginada ou quadro kanban. */
export type RequestsView = 'lista' | 'board';

export interface AuthState {
  accessToken: string | null;
  userEmail: string | null;
  /** Nome real do usuário, vindo de GET /v1/usuarios/me — o JWT não carrega isso.
   *  Opcional: nem todo call-site que monta um AuthState parcial precisa informá-lo. */
  userName?: string | null;
  userId: string | null;
  perfil: string | null;
  imobiliariaId: string | null;
  imobiliariaIds?: string[]; // V25: todos os vínculos (>=1 quando não-admin vinculado)
  loginError: string | null;
}

interface AppState {
  // Auth
  auth: AuthState;
  setAuth: (auth: Partial<AuthState>) => void;
  logout: () => void;
  setLoginError: (error: string | null) => void;

  // UI
  role: Role;
  requestsView: RequestsView;
  theme: 'light' | 'dark';
  sidebarCollapsed: boolean;
  toastMessage: string | null;
  drawerOpen: boolean;
  navOpen: boolean;
  expandedRequestId: string | null;
  expandedPropertyId: string | null;
  wizardStep: number;
  propertyWizardStep: number;
  realEstateWizardStep: number;
  clienteWizardStep: number;
  inspectionPhotos: Record<string, string[]>;
  propertyFilters: {
    tipo: string;
    cidade: string;
    situacao: string;
  };

  setRole: (role: Role) => void;
  setRequestsView: (view: RequestsView) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  /** Aplica o tema vindo do perfil; valores desconhecidos são ignorados. */
  applyTema: (tema: string | null | undefined) => void;
  toggleTheme: () => void;
  toggleSidebar: () => void;
  setToast: (message: string | null) => void;
  toggleDrawer: () => void;
  setNavOpen: (open: boolean) => void;
  setExpandedRequestId: (id: string | null) => void;
  setExpandedPropertyId: (id: string | null) => void;
  setWizardStep: (step: number) => void;
  setPropertyWizardStep: (step: number) => void;
  setRealEstateWizardStep: (step: number) => void;
  setClienteWizardStep: (step: number) => void;
  addInspectionPhoto: (inspectionId: string, ambienteId: string, photoUrl: string) => void;
  setPropertyFilters: (filters: Partial<{ tipo: string; cidade: string; situacao: string }>) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Auth state
  auth: {
    accessToken: null,
    userEmail: null,
    userName: null,
    userId: null,
    perfil: null,
    imobiliariaId: null,
    imobiliariaIds: [],
    loginError: null,
  },

  setAuth: (auth) => set((state) => ({ auth: { ...state.auth, ...auth } })),

  setLoginError: (error) => set((state) => ({ auth: { ...state.auth, loginError: error } })),

  logout: () => {
    set({
      auth: {
        accessToken: null,
        userEmail: null,
        userName: null,
        userId: null,
        perfil: null,
        imobiliariaId: null,
        imobiliariaIds: [],
        loginError: null,
      },
      role: 'corretor',
    });
  },

  // UI state
  role: 'corretor',
  requestsView: (localStorage.getItem('mv-requests-view') as RequestsView) || 'board',
  theme: localStorage.getItem('mv-theme') as 'light' | 'dark' || 'light',
  sidebarCollapsed: false,
  toastMessage: null,
  drawerOpen: false,
  navOpen: false,
  expandedRequestId: null,
  expandedPropertyId: null,
  wizardStep: 0,
  propertyWizardStep: 0,
  realEstateWizardStep: 0,
  clienteWizardStep: 0,
  inspectionPhotos: {},
  propertyFilters: {
    tipo: '',
    cidade: '',
    situacao: '',
  },

  setRole: (role) => set({ role }),

  setRequestsView: (view) => {
    set({ requestsView: view });
    try {
      localStorage.setItem('mv-requests-view', view);
    } catch {
      // localStorage indisponível (modo privado etc.) — a escolha só não persiste entre sessões.
    }
  },

  setTheme: (theme) => {
    set({ theme });
    try {
      localStorage.setItem('mv-theme', theme);
    } catch {
      // localStorage indisponível (modo privado etc.) — a escolha só não persiste neste aparelho.
    }
    document.documentElement.setAttribute('data-theme', theme);
  },

  applyTema: (tema) => {
    if (tema === 'light' || tema === 'dark') {
      get().setTheme(tema);
    }
  },

  toggleTheme: () => {
    get().setTheme(get().theme === 'light' ? 'dark' : 'light');
  },

  toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),

  setToast: (message) => set({ toastMessage: message }),

  toggleDrawer: () => set({ drawerOpen: !get().drawerOpen }),

  setNavOpen: (open) => set({ navOpen: open }),

  setExpandedRequestId: (id) => set({ expandedRequestId: id }),

  setExpandedPropertyId: (id) => set({ expandedPropertyId: id }),

  setWizardStep: (step) => set({ wizardStep: step }),

  setPropertyWizardStep: (step) => set({ propertyWizardStep: step }),

  setRealEstateWizardStep: (step) => set({ realEstateWizardStep: step }),

  setClienteWizardStep: (step) => set({ clienteWizardStep: step }),

  addInspectionPhoto: (inspectionId, ambienteId, photoUrl) => {
    const key = `${inspectionId}-${ambienteId}`;
    const current = get().inspectionPhotos;
    set({
      inspectionPhotos: {
        ...current,
        [key]: [...(current[key] || []), photoUrl],
      },
    });
  },

  setPropertyFilters: (filters) => {
    const current = get().propertyFilters;
    set({ propertyFilters: { ...current, ...filters } });
  },
}));

// Initialize theme on mount
const theme = localStorage.getItem('mv-theme') || 'light';
document.documentElement.setAttribute('data-theme', theme);
