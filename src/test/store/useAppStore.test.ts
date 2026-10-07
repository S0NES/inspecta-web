import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

describe('useAppStore (Zustand)', () => {
  beforeEach(() => {
    // Reset store state before each test
    useAppStore.setState({
      auth: {
        accessToken: null,
        userEmail: null,
        userId: null,
        perfil: null,
        imobiliariaId: null,
        loginError: null,
      },
      role: 'corretor',
      theme: 'light',
      sidebarCollapsed: false,
      toastMessage: null,
      drawerOpen: false,
      navOpen: false,
      expandedRequestId: null,
      expandedPropertyId: null,
      wizardStep: 0,
      propertyWizardStep: 0,
      inspectionPhotos: {},
      propertyFilters: {
        tipo: '',
        cidade: '',
        situacao: '',
      },
    });

    // Clear localStorage
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    test('has correct default auth state', () => {
      const state = useAppStore.getState();
      expect(state.auth).toEqual({
        accessToken: null,
        userEmail: null,
        userId: null,
        perfil: null,
        imobiliariaId: null,
        loginError: null,
      });
    });

    test('has correct default UI state', () => {
      const state = useAppStore.getState();
      expect(state.role).toBe('corretor');
      expect(state.requestsView).toBe('board');
      expect(state.theme).toBe('light');
      expect(state.sidebarCollapsed).toBe(false);
      expect(state.toastMessage).toBeNull();
      expect(state.drawerOpen).toBe(false);
      expect(state.navOpen).toBe(false);
    });

    test('has correct default wizard state', () => {
      const state = useAppStore.getState();
      expect(state.wizardStep).toBe(0);
      expect(state.propertyWizardStep).toBe(0);
    });

    test('has correct default inspection state', () => {
      const state = useAppStore.getState();
      expect(state.inspectionPhotos).toEqual({});
    });

    test('has correct default property filters', () => {
      const state = useAppStore.getState();
      expect(state.propertyFilters).toEqual({
        tipo: '',
        cidade: '',
        situacao: '',
      });
    });
  });

  describe('Auth state management', () => {
    describe('setAuth', () => {
      test('updates auth state with partial object', () => {
        useAppStore.getState().setAuth({
          accessToken: 'token123',
          userEmail: 'user@example.com',
        });

        const state = useAppStore.getState();
        expect(state.auth.accessToken).toBe('token123');
        expect(state.auth.userEmail).toBe('user@example.com');
        expect(state.auth.userId).toBeNull();
      });

      test('preserves existing auth fields when updating', () => {
        useAppStore.getState().setAuth({
          accessToken: 'token123',
          userEmail: 'user@example.com',
          userId: 'user-id-456',
        });

        useAppStore.getState().setAuth({
          perfil: 'vistoriador',
        });

        const state = useAppStore.getState();
        expect(state.auth.accessToken).toBe('token123');
        expect(state.auth.userEmail).toBe('user@example.com');
        expect(state.auth.userId).toBe('user-id-456');
        expect(state.auth.perfil).toBe('vistoriador');
      });

      test('updates multiple auth fields at once', () => {
        useAppStore.getState().setAuth({
          accessToken: 'token123',
          userEmail: 'test@example.com',
          userId: 'user123',
          perfil: 'corretor',
          imobiliariaId: '42',
        });

        const state = useAppStore.getState();
        expect(state.auth.accessToken).toBe('token123');
        expect(state.auth.userEmail).toBe('test@example.com');
        expect(state.auth.userId).toBe('user123');
        expect(state.auth.perfil).toBe('corretor');
        expect(state.auth.imobiliariaId).toBe('42');
      });

      test('can clear auth fields by setting to null', () => {
        useAppStore.getState().setAuth({
          accessToken: 'token123',
          userEmail: 'test@example.com',
        });

        useAppStore.getState().setAuth({
          accessToken: null,
          userEmail: null,
        });

        const state = useAppStore.getState();
        expect(state.auth.accessToken).toBeNull();
        expect(state.auth.userEmail).toBeNull();
      });
    });

    describe('setLoginError', () => {
      test('sets login error message', () => {
        useAppStore.getState().setLoginError('Invalid credentials');
        expect(useAppStore.getState().auth.loginError).toBe('Invalid credentials');
      });

      test('updates login error to new value', () => {
        useAppStore.getState().setLoginError('Error 1');
        useAppStore.getState().setLoginError('Error 2');
        expect(useAppStore.getState().auth.loginError).toBe('Error 2');
      });

      test('clears login error by setting to null', () => {
        useAppStore.getState().setLoginError('Some error');
        useAppStore.getState().setLoginError(null);
        expect(useAppStore.getState().auth.loginError).toBeNull();
      });

      test('preserves other auth fields when setting login error', () => {
        useAppStore.getState().setAuth({
          accessToken: 'token123',
          userEmail: 'test@example.com',
        });

        useAppStore.getState().setLoginError('Login failed');

        const state = useAppStore.getState();
        expect(state.auth.accessToken).toBe('token123');
        expect(state.auth.userEmail).toBe('test@example.com');
        expect(state.auth.loginError).toBe('Login failed');
      });
    });

    describe('logout', () => {
      test('clears all auth state', () => {
        useAppStore.getState().setAuth({
          accessToken: 'token123',
          userEmail: 'user@example.com',
          userId: 'user123',
          perfil: 'vistoriador',
          imobiliariaId: '42',
          loginError: 'Some error',
        });

        useAppStore.getState().logout();

        const state = useAppStore.getState();
        expect(state.auth.accessToken).toBeNull();
        expect(state.auth.userEmail).toBeNull();
        expect(state.auth.userId).toBeNull();
        expect(state.auth.perfil).toBeNull();
        expect(state.auth.imobiliariaId).toBeNull();
        expect(state.auth.loginError).toBeNull();
      });

      test('sets role to corretor', () => {
        useAppStore.setState({ role: 'admin' });
        useAppStore.getState().logout();
        expect(useAppStore.getState().role).toBe('corretor');
      });

      test('does not clear non-auth UI state', () => {
        useAppStore.setState({
          theme: 'dark',
          sidebarCollapsed: true,
          expandedRequestId: 'req123',
        });

        useAppStore.getState().logout();

        const state = useAppStore.getState();
        expect(state.theme).toBe('dark');
        expect(state.sidebarCollapsed).toBe(true);
        expect(state.expandedRequestId).toBe('req123');
      });
    });
  });

  describe('UI state management', () => {
    describe('setRole', () => {
      test('sets role to corretor', () => {
        useAppStore.getState().setRole('corretor');
        expect(useAppStore.getState().role).toBe('corretor');
      });

      test('sets role to vistoriador', () => {
        useAppStore.getState().setRole('vistoriador');
        expect(useAppStore.getState().role).toBe('vistoriador');
      });

      test('sets role to admin', () => {
        useAppStore.getState().setRole('admin');
        expect(useAppStore.getState().role).toBe('admin');
      });

      test('updates role from one value to another', () => {
        useAppStore.getState().setRole('corretor');
        expect(useAppStore.getState().role).toBe('corretor');
        useAppStore.getState().setRole('admin');
        expect(useAppStore.getState().role).toBe('admin');
      });
    });

    describe('toggleSidebar', () => {
      test('toggles sidebar from false to true', () => {
        expect(useAppStore.getState().sidebarCollapsed).toBe(false);
        useAppStore.getState().toggleSidebar();
        expect(useAppStore.getState().sidebarCollapsed).toBe(true);
      });

      test('toggles sidebar from true to false', () => {
        useAppStore.setState({ sidebarCollapsed: true });
        useAppStore.getState().toggleSidebar();
        expect(useAppStore.getState().sidebarCollapsed).toBe(false);
      });

      test('toggles sidebar multiple times', () => {
        expect(useAppStore.getState().sidebarCollapsed).toBe(false);
        useAppStore.getState().toggleSidebar();
        expect(useAppStore.getState().sidebarCollapsed).toBe(true);
        useAppStore.getState().toggleSidebar();
        expect(useAppStore.getState().sidebarCollapsed).toBe(false);
      });
    });

    describe('toggleTheme', () => {
      test('toggles theme from light to dark', () => {
        expect(useAppStore.getState().theme).toBe('light');
        useAppStore.getState().toggleTheme();
        expect(useAppStore.getState().theme).toBe('dark');
      });

      test('toggles theme from dark to light', () => {
        useAppStore.setState({ theme: 'dark' });
        useAppStore.getState().toggleTheme();
        expect(useAppStore.getState().theme).toBe('light');
      });

      test('toggles theme multiple times', () => {
        expect(useAppStore.getState().theme).toBe('light');
        useAppStore.getState().toggleTheme();
        expect(useAppStore.getState().theme).toBe('dark');
        useAppStore.getState().toggleTheme();
        expect(useAppStore.getState().theme).toBe('light');
        useAppStore.getState().toggleTheme();
        expect(useAppStore.getState().theme).toBe('dark');
      });

      test('persists theme to localStorage', () => {
        useAppStore.getState().toggleTheme();
        expect(localStorage.getItem('mv-theme')).toBe('dark');

        useAppStore.getState().toggleTheme();
        expect(localStorage.getItem('mv-theme')).toBe('light');
      });

      test('updates document theme attribute', () => {
        const spy = vi.spyOn(document.documentElement, 'setAttribute');

        useAppStore.getState().toggleTheme();
        expect(spy).toHaveBeenCalledWith('data-theme', 'dark');

        useAppStore.getState().toggleTheme();
        expect(spy).toHaveBeenCalledWith('data-theme', 'light');
      });

      test('applies a valid tema from the user profile', () => {
        useAppStore.getState().applyTema('dark');
        expect(useAppStore.getState().theme).toBe('dark');
        expect(localStorage.getItem('mv-theme')).toBe('dark');
        expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
      });

      test('ignores an unknown tema from the user profile', () => {
        useAppStore.setState({ theme: 'light' });
        useAppStore.getState().applyTema('solarized');
        useAppStore.getState().applyTema(undefined);
        expect(useAppStore.getState().theme).toBe('light');
      });
    });

    describe('setToast', () => {
      test('sets toast message', () => {
        useAppStore.getState().setToast('Hello!');
        expect(useAppStore.getState().toastMessage).toBe('Hello!');
      });

      test('updates toast message', () => {
        useAppStore.getState().setToast('First message');
        useAppStore.getState().setToast('Second message');
        expect(useAppStore.getState().toastMessage).toBe('Second message');
      });

      test('clears toast by setting to null', () => {
        useAppStore.getState().setToast('Message');
        useAppStore.getState().setToast(null);
        expect(useAppStore.getState().toastMessage).toBeNull();
      });
    });

    describe('toggleDrawer', () => {
      test('toggles drawer from false to true', () => {
        expect(useAppStore.getState().drawerOpen).toBe(false);
        useAppStore.getState().toggleDrawer();
        expect(useAppStore.getState().drawerOpen).toBe(true);
      });

      test('toggles drawer from true to false', () => {
        useAppStore.setState({ drawerOpen: true });
        useAppStore.getState().toggleDrawer();
        expect(useAppStore.getState().drawerOpen).toBe(false);
      });

      test('toggles drawer multiple times', () => {
        expect(useAppStore.getState().drawerOpen).toBe(false);
        useAppStore.getState().toggleDrawer();
        expect(useAppStore.getState().drawerOpen).toBe(true);
        useAppStore.getState().toggleDrawer();
        expect(useAppStore.getState().drawerOpen).toBe(false);
      });
    });

    describe('setNavOpen', () => {
      test('sets nav open to true', () => {
        useAppStore.getState().setNavOpen(true);
        expect(useAppStore.getState().navOpen).toBe(true);
      });

      test('sets nav open to false', () => {
        useAppStore.setState({ navOpen: true });
        useAppStore.getState().setNavOpen(false);
        expect(useAppStore.getState().navOpen).toBe(false);
      });

      test('updates nav open multiple times', () => {
        useAppStore.getState().setNavOpen(true);
        expect(useAppStore.getState().navOpen).toBe(true);
        useAppStore.getState().setNavOpen(false);
        expect(useAppStore.getState().navOpen).toBe(false);
        useAppStore.getState().setNavOpen(true);
        expect(useAppStore.getState().navOpen).toBe(true);
      });
    });
  });

  describe('Expansion state management', () => {
    describe('setExpandedRequestId', () => {
      test('sets expanded request id', () => {
        useAppStore.getState().setExpandedRequestId('req-123');
        expect(useAppStore.getState().expandedRequestId).toBe('req-123');
      });

      test('updates expanded request id', () => {
        useAppStore.getState().setExpandedRequestId('req-1');
        useAppStore.getState().setExpandedRequestId('req-2');
        expect(useAppStore.getState().expandedRequestId).toBe('req-2');
      });

      test('clears expanded request id', () => {
        useAppStore.getState().setExpandedRequestId('req-123');
        useAppStore.getState().setExpandedRequestId(null);
        expect(useAppStore.getState().expandedRequestId).toBeNull();
      });
    });

    describe('setExpandedPropertyId', () => {
      test('sets expanded property id', () => {
        useAppStore.getState().setExpandedPropertyId('prop-456');
        expect(useAppStore.getState().expandedPropertyId).toBe('prop-456');
      });

      test('updates expanded property id', () => {
        useAppStore.getState().setExpandedPropertyId('prop-1');
        useAppStore.getState().setExpandedPropertyId('prop-2');
        expect(useAppStore.getState().expandedPropertyId).toBe('prop-2');
      });

      test('clears expanded property id', () => {
        useAppStore.getState().setExpandedPropertyId('prop-456');
        useAppStore.getState().setExpandedPropertyId(null);
        expect(useAppStore.getState().expandedPropertyId).toBeNull();
      });
    });

  });

  describe('Wizard state management', () => {
    describe('setWizardStep', () => {
      test('sets wizard step to 0', () => {
        useAppStore.getState().setWizardStep(0);
        expect(useAppStore.getState().wizardStep).toBe(0);
      });

      test('sets wizard step to various positive numbers', () => {
        const steps = [0, 1, 2, 3, 5, 10];
        steps.forEach((step) => {
          useAppStore.getState().setWizardStep(step);
          expect(useAppStore.getState().wizardStep).toBe(step);
        });
      });

      test('updates wizard step multiple times', () => {
        useAppStore.getState().setWizardStep(1);
        expect(useAppStore.getState().wizardStep).toBe(1);
        useAppStore.getState().setWizardStep(2);
        expect(useAppStore.getState().wizardStep).toBe(2);
      });
    });

    describe('setPropertyWizardStep', () => {
      test('sets property wizard step to 0', () => {
        useAppStore.getState().setPropertyWizardStep(0);
        expect(useAppStore.getState().propertyWizardStep).toBe(0);
      });

      test('sets property wizard step to various positive numbers', () => {
        const steps = [0, 1, 2, 3, 5, 10];
        steps.forEach((step) => {
          useAppStore.getState().setPropertyWizardStep(step);
          expect(useAppStore.getState().propertyWizardStep).toBe(step);
        });
      });

      test('updates property wizard step multiple times', () => {
        useAppStore.getState().setPropertyWizardStep(1);
        expect(useAppStore.getState().propertyWizardStep).toBe(1);
        useAppStore.getState().setPropertyWizardStep(3);
        expect(useAppStore.getState().propertyWizardStep).toBe(3);
      });
    });
  });

  describe('Inspection photo management', () => {
    describe('addInspectionPhoto', () => {
      test('adds first photo for inspection-ambiente combo', () => {
        useAppStore.getState().addInspectionPhoto('insp-1', 'sala', 'photo-1.jpg');

        const photos = useAppStore.getState().inspectionPhotos;
        expect(photos['insp-1-sala']).toEqual(['photo-1.jpg']);
      });

      test('composes key from inspectionId and ambienteId', () => {
        useAppStore.getState().addInspectionPhoto('inspection-abc', 'quarto', 'photo.jpg');

        const photos = useAppStore.getState().inspectionPhotos;
        expect(photos['inspection-abc-quarto']).toBeDefined();
        expect(photos['inspection-abc-quarto']).toEqual(['photo.jpg']);
      });

      test('appends photo to existing array', () => {
        useAppStore.getState().addInspectionPhoto('insp-1', 'sala', 'photo-1.jpg');
        useAppStore.getState().addInspectionPhoto('insp-1', 'sala', 'photo-2.jpg');

        const photos = useAppStore.getState().inspectionPhotos;
        expect(photos['insp-1-sala']).toEqual(['photo-1.jpg', 'photo-2.jpg']);
      });

      test('maintains separate arrays for different ambientes', () => {
        useAppStore.getState().addInspectionPhoto('insp-1', 'sala', 'photo-1.jpg');
        useAppStore.getState().addInspectionPhoto('insp-1', 'quarto', 'photo-2.jpg');

        const photos = useAppStore.getState().inspectionPhotos;
        expect(photos['insp-1-sala']).toEqual(['photo-1.jpg']);
        expect(photos['insp-1-quarto']).toEqual(['photo-2.jpg']);
      });

      test('maintains separate arrays for different inspections', () => {
        useAppStore.getState().addInspectionPhoto('insp-1', 'sala', 'photo-1.jpg');
        useAppStore.getState().addInspectionPhoto('insp-2', 'sala', 'photo-2.jpg');

        const photos = useAppStore.getState().inspectionPhotos;
        expect(photos['insp-1-sala']).toEqual(['photo-1.jpg']);
        expect(photos['insp-2-sala']).toEqual(['photo-2.jpg']);
      });

      test('adds multiple photos in correct order', () => {
        const photoUrls = ['photo-1.jpg', 'photo-2.jpg', 'photo-3.jpg'];
        photoUrls.forEach((url) => {
          useAppStore.getState().addInspectionPhoto('insp-1', 'sala', url);
        });

        const photos = useAppStore.getState().inspectionPhotos;
        expect(photos['insp-1-sala']).toEqual(photoUrls);
      });

      test('preserves other state when adding photos', () => {
        useAppStore.setState({ expandedRequestId: 'req-1' });

        useAppStore.getState().addInspectionPhoto('insp-1', 'sala', 'photo.jpg');

        const state = useAppStore.getState();
        expect(state.expandedRequestId).toBe('req-1');
        expect(state.inspectionPhotos['insp-1-sala']).toEqual(['photo.jpg']);
      });
    });
  });

  describe('Property filters management', () => {
    describe('setPropertyFilters', () => {
      test('sets tipo filter', () => {
        useAppStore.getState().setPropertyFilters({ tipo: 'apartamento' });
        expect(useAppStore.getState().propertyFilters.tipo).toBe('apartamento');
      });

      test('sets cidade filter', () => {
        useAppStore.getState().setPropertyFilters({ cidade: 'São Paulo' });
        expect(useAppStore.getState().propertyFilters.cidade).toBe('São Paulo');
      });

      test('sets situacao filter', () => {
        useAppStore.getState().setPropertyFilters({ situacao: 'disponível' });
        expect(useAppStore.getState().propertyFilters.situacao).toBe('disponível');
      });

      test('sets multiple filters at once', () => {
        useAppStore.getState().setPropertyFilters({
          tipo: 'casa',
          cidade: 'Rio de Janeiro',
          situacao: 'aluguel',
        });

        const filters = useAppStore.getState().propertyFilters;
        expect(filters.tipo).toBe('casa');
        expect(filters.cidade).toBe('Rio de Janeiro');
        expect(filters.situacao).toBe('aluguel');
      });

      test('partially updates filters (merge behavior)', () => {
        useAppStore.getState().setPropertyFilters({
          tipo: 'apartamento',
          cidade: 'São Paulo',
        });

        useAppStore.getState().setPropertyFilters({ situacao: 'venda' });

        const filters = useAppStore.getState().propertyFilters;
        expect(filters.tipo).toBe('apartamento');
        expect(filters.cidade).toBe('São Paulo');
        expect(filters.situacao).toBe('venda');
      });

      test('overwrites existing filter values', () => {
        useAppStore.getState().setPropertyFilters({
          tipo: 'apartamento',
          cidade: 'São Paulo',
        });

        useAppStore.getState().setPropertyFilters({ tipo: 'casa' });

        const filters = useAppStore.getState().propertyFilters;
        expect(filters.tipo).toBe('casa');
        expect(filters.cidade).toBe('São Paulo');
      });

      test('can clear individual filters by setting to empty string', () => {
        useAppStore.getState().setPropertyFilters({
          tipo: 'apartamento',
          cidade: 'São Paulo',
        });

        useAppStore.getState().setPropertyFilters({ tipo: '' });

        const filters = useAppStore.getState().propertyFilters;
        expect(filters.tipo).toBe('');
        expect(filters.cidade).toBe('São Paulo');
      });

      test('can clear all filters by setting each to empty string', () => {
        useAppStore.getState().setPropertyFilters({
          tipo: 'apartamento',
          cidade: 'São Paulo',
          situacao: 'venda',
        });

        useAppStore.getState().setPropertyFilters({
          tipo: '',
          cidade: '',
          situacao: '',
        });

        const filters = useAppStore.getState().propertyFilters;
        expect(filters).toEqual({
          tipo: '',
          cidade: '',
          situacao: '',
        });
      });

      test('handles complex filter values', () => {
        useAppStore.getState().setPropertyFilters({
          tipo: 'apartamento com 3 quartos',
          cidade: 'São Paulo - SP',
          situacao: 'em reforma e aluguel',
        });

        const filters = useAppStore.getState().propertyFilters;
        expect(filters.tipo).toBe('apartamento com 3 quartos');
        expect(filters.cidade).toBe('São Paulo - SP');
        expect(filters.situacao).toBe('em reforma e aluguel');
      });
    });
  });

  describe('state isolation and independence', () => {
    test('auth state changes do not affect UI state', () => {
      useAppStore.setState({
        role: 'admin',
        theme: 'dark',
      });

      useAppStore.getState().setAuth({
        accessToken: 'token',
        userEmail: 'test@example.com',
      });

      const state = useAppStore.getState();
      expect(state.role).toBe('admin');
      expect(state.theme).toBe('dark');
    });

    test('UI state changes do not affect auth state', () => {
      useAppStore.getState().setAuth({
        accessToken: 'token',
        userEmail: 'test@example.com',
      });

      useAppStore.getState().setRole('vistoriador');

      const state = useAppStore.getState();
      expect(state.auth.accessToken).toBe('token');
      expect(state.auth.userEmail).toBe('test@example.com');
    });

    test('filter changes do not affect expansion state', () => {
      useAppStore.setState({
        expandedRequestId: 'req-1',
        expandedPropertyId: 'prop-1',
      });

      useAppStore.getState().setPropertyFilters({
        tipo: 'casa',
        cidade: 'São Paulo',
      });

      const state = useAppStore.getState();
      expect(state.expandedRequestId).toBe('req-1');
      expect(state.expandedPropertyId).toBe('prop-1');
    });
  });

  describe('edge cases', () => {
    test('handles empty inspection photo key with empty strings', () => {
      useAppStore.getState().addInspectionPhoto('', '', 'photo.jpg');
      const photos = useAppStore.getState().inspectionPhotos;
      expect(photos['-']).toEqual(['photo.jpg']);
    });

    test('handles special characters in inspection ids', () => {
      useAppStore.getState().addInspectionPhoto('insp-123-ABC', 'sala-1', 'photo.jpg');
      const photos = useAppStore.getState().inspectionPhotos;
      expect(photos['insp-123-ABC-sala-1']).toEqual(['photo.jpg']);
    });

    test('handles unicode characters in filters', () => {
      useAppStore.getState().setPropertyFilters({
        cidade: 'São Paulo',
        tipo: 'Imóvel',
      });

      const filters = useAppStore.getState().propertyFilters;
      expect(filters.cidade).toBe('São Paulo');
      expect(filters.tipo).toBe('Imóvel');
    });

    test('multiple rapid state updates work correctly', () => {
      useAppStore.getState().setRole('admin');
      useAppStore.getState().toggleTheme();
      useAppStore.getState().setExpandedRequestId('req-1');
      useAppStore.getState().setPropertyFilters({ tipo: 'casa' });

      const state = useAppStore.getState();
      expect(state.role).toBe('admin');
      expect(state.theme).toBe('dark');
      expect(state.expandedRequestId).toBe('req-1');
      expect(state.propertyFilters.tipo).toBe('casa');
    });
  });
});
