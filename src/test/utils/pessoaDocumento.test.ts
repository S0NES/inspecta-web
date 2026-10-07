import { describe, test, expect } from 'vitest';
import {
  isCpf, normalizeCpf, isEmail, normalizeEmail, isNomeCompleto,
  CPF_INVALIDO, EMAIL_INVALIDO, NOME_COMPLETO_INVALIDO,
} from '../../utils/pessoaDocumento';

// Mesmos vetores de inspecta-core PessoaDocumentoTest.java.
describe('pessoaDocumento', () => {
  test('CPF válido — com e sem máscara', () => {
    expect(isCpf('11144477735')).toBe(true);
    expect(isCpf('111.444.777-35')).toBe(true);
    expect(normalizeCpf('111.444.777-35')).toBe('11144477735');
  });

  test('CPF inválido — vazio, curto, repetido, DV errado', () => {
    for (const bad of [null, '', '123456789', '11111111111', '11144477734', '000.000.000-00']) {
      expect(isCpf(bad)).toBe(false);
    }
    expect(() => normalizeCpf('11144477734')).toThrow(CPF_INVALIDO);
  });

  test('e-mail — trim + lower na gravação; recusa vazio / sem @ / sem ponto / com espaço', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(normalizeEmail('  Foo.Bar@Example.COM ')).toBe('foo.bar@example.com');
    for (const bad of [null, '', 'foo', 'foo@bar', 'a b@c.com', '@c.com']) {
      expect(isEmail(bad)).toBe(false);
    }
    expect(() => normalizeEmail('foo')).toThrow(EMAIL_INVALIDO);
  });

  test('nome completo — ≥2 palavras com ≥2 letras cada', () => {
    expect(isNomeCompleto('Ana Silva')).toBe(true);
    for (const bad of [null, '', '   ', 'Ana', 'A S', 'Ana S']) {
      expect(isNomeCompleto(bad)).toBe(false);
    }
  });

  test('códigos de erro estáveis', () => {
    expect(CPF_INVALIDO).toBe('cpf_invalido');
    expect(EMAIL_INVALIDO).toBe('email_invalido');
    expect(NOME_COMPLETO_INVALIDO).toBe('nome_completo_invalido');
  });
});
