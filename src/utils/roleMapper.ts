import type { Role } from '../store/useAppStore';

/**
 * Maps backend perfil (from JWT) to frontend nav role.
 *
 * Backend perfis: admin, suporte, imob_gerencia, imob_operacao, vistoriador, cliente
 * Frontend roles: admin, vistoriador, corretor, cliente
 *
 * Mapping logic:
 * - vistoriador → vistoriador (field inspector role)
 * - admin, suporte → admin (both are staff/back-office; actual permissions enforced server-side)
 * - imob_gerencia, imob_operacao → corretor (agency-side roles creating solicitações/imóveis)
 * - cliente → cliente (B2C end customer — own nav bucket, not the agency's)
 */
export function mapPerfilToRole(perfil: string): Role {
  if (perfil === 'vistoriador') {
    return 'vistoriador';
  }
  if (perfil === 'admin' || perfil === 'suporte') {
    return 'admin';
  }
  if (perfil === 'cliente') {
    return 'cliente';
  }
  // imob_gerencia, imob_operacao
  return 'corretor';
}
