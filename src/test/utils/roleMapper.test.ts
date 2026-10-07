import { describe, test, expect } from 'vitest';
import { mapPerfilToRole } from '../../utils/roleMapper';
import type { Role } from '../../store/useAppStore';

describe('roleMapper.ts', () => {
  describe('mapPerfilToRole', () => {
    describe('vistoriador mapping', () => {
      test('maps "vistoriador" to "vistoriador" role', () => {
        const result = mapPerfilToRole('vistoriador');
        expect(result).toBe('vistoriador');
      });
    });

    describe('admin mapping', () => {
      test('maps "admin" to "admin" role', () => {
        const result = mapPerfilToRole('admin');
        expect(result).toBe('admin');
      });

      test('maps "suporte" to "admin" role', () => {
        const result = mapPerfilToRole('suporte');
        expect(result).toBe('admin');
      });
    });

    describe('corretor mapping', () => {
      test('maps "imob_gerencia" to "corretor" role', () => {
        const result = mapPerfilToRole('imob_gerencia');
        expect(result).toBe('corretor');
      });

      test('maps "imob_operacao" to "corretor" role', () => {
        const result = mapPerfilToRole('imob_operacao');
        expect(result).toBe('corretor');
      });
    });

    describe('cliente mapping', () => {
      test('maps "cliente" to "cliente" role', () => {
        const result = mapPerfilToRole('cliente');
        expect(result).toBe('cliente');
      });
    });

    describe('backend perfil coverage', () => {
      test('handles all documented backend perfis', () => {
        const backendPerfis = [
          'admin',
          'suporte',
          'imob_gerencia',
          'imob_operacao',
          'vistoriador',
          'cliente',
        ];

        const results = backendPerfis.map((perfil) => mapPerfilToRole(perfil));
        const validRoles: Role[] = ['admin', 'vistoriador', 'corretor', 'cliente'];

        results.forEach((result) => {
          expect(validRoles).toContain(result);
        });
      });

      test('returns valid Role type for all mappings', () => {
        const backendPerfis = [
          'admin',
          'suporte',
          'imob_gerencia',
          'imob_operacao',
          'vistoriador',
          'cliente',
        ];

        backendPerfis.forEach((perfil) => {
          const result = mapPerfilToRole(perfil);
          expect(['admin', 'vistoriador', 'corretor', 'cliente']).toContain(result);
          expect(typeof result).toBe('string');
        });
      });
    });

    describe('edge cases', () => {
      test('unknown perfil defaults to "corretor"', () => {
        expect(mapPerfilToRole('unknown')).toBe('corretor');
        expect(mapPerfilToRole('xyz')).toBe('corretor');
        expect(mapPerfilToRole('invalid_role')).toBe('corretor');
      });

      test('empty string defaults to "corretor"', () => {
        expect(mapPerfilToRole('')).toBe('corretor');
      });

      test('case sensitivity - lowercase admin', () => {
        // Test actual case sensitivity behavior
        expect(mapPerfilToRole('admin')).toBe('admin');
      });

      test('case sensitivity - uppercase versions fall through to corretor', () => {
        // Test case sensitivity - uppercase should not match
        expect(mapPerfilToRole('ADMIN')).toBe('corretor');
        expect(mapPerfilToRole('VISTORIADOR')).toBe('corretor');
        expect(mapPerfilToRole('SUPORTE')).toBe('corretor');
      });

      test('mixed case unknown variants default to corretor', () => {
        expect(mapPerfilToRole('Admin')).toBe('corretor');
        expect(mapPerfilToRole('Vistoriador')).toBe('corretor');
      });
    });

    describe('mapping summary', () => {
      test('two roles map to admin (admin, suporte)', () => {
        expect(mapPerfilToRole('admin')).toBe('admin');
        expect(mapPerfilToRole('suporte')).toBe('admin');
        expect(mapPerfilToRole('admin')).toBe(mapPerfilToRole('suporte'));
      });

      test('one role maps to vistoriador', () => {
        expect(mapPerfilToRole('vistoriador')).toBe('vistoriador');
      });

      test('two perfis map to corretor (imob_gerencia, imob_operacao)', () => {
        expect(mapPerfilToRole('imob_gerencia')).toBe('corretor');
        expect(mapPerfilToRole('imob_operacao')).toBe('corretor');
      });

      test('one perfil maps to cliente', () => {
        expect(mapPerfilToRole('cliente')).toBe('cliente');
      });

      test('any other perfil defaults to corretor (catch-all)', () => {
        expect(mapPerfilToRole('some_other_role')).toBe('corretor');
        expect(mapPerfilToRole('new_role')).toBe('corretor');
        expect(mapPerfilToRole('beta_role')).toBe('corretor');
      });
    });
  });
});
