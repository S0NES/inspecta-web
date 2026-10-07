import { describe, it, expect } from 'vitest';
import { statusTone } from '../../utils/statusTone';

// Tabela de FRONTEND.md §2 — o tom carrega significado, então cada faixa é testada.
describe('statusTone', () => {
  it('usa ink para estado ativo/positivo forte', () => {
    expect(statusTone('Em campo')).toBe('ink');
    expect(statusTone('Assinado')).toBe('ink');
    expect(statusTone('Faturada')).toBe('ink');
    expect(statusTone('Aprovada')).toBe('ink');
  });

  it('usa gray para estado neutro/aguardando', () => {
    expect(statusTone('Solicitada')).toBe('gray');
    expect(statusTone('Atribuída')).toBe('gray');
    expect(statusTone('Agendada')).toBe('gray');
    expect(statusTone('A receber')).toBe('gray');
  });

  it('usa outline para informativo/histórico', () => {
    expect(statusTone('Concluída')).toBe('outline');
    expect(statusTone('Corretor')).toBe('outline');
    expect(statusTone('Nova')).toBe('outline');
  });

  it('usa red para exceção que exige ação', () => {
    expect(statusTone('Cancelada')).toBe('red');
    expect(statusTone('Retida')).toBe('red');
    expect(statusTone('Ajustes solicitados')).toBe('red');
    expect(statusTone('Sem assinatura')).toBe('red');
  });

  it('ignora acento e caixa', () => {
    expect(statusTone('CONCLUÍDA')).toBe('outline');
    expect(statusTone('concluida')).toBe('outline');
    expect(statusTone('  Atribuida  ')).toBe('gray');
  });

  it('cai em gray para status desconhecido, nunca em acento', () => {
    expect(statusTone('Status Inventado')).toBe('gray');
    expect(statusTone('')).toBe('gray');
  });
});
