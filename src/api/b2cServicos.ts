import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

/**
 * Catálogo dos serviços que um Cliente B2C pode ser habilitado a solicitar
 * (ex.: "Vistoria de Entrada") — substitui o antigo catálogo fixo `CLIENT_SERVICES`.
 * Consumido pela tela Biletagem Cliente (abas), pelo cadastro de Cliente B2C
 * (acesso por serviço) e pelo wizard de solicitação do próprio cliente.
 *
 * Contrato (inspecta-api):
 *   GET  /v1/b2c-servicos?incluirInativos=bool -> B2cServico[]
 *   POST /v1/b2c-servicos { nome, descricao?, icone?, ordem? } -> 201 B2cServico
 */
export interface B2cServico {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  ativo: boolean;
}

export function useB2cServicos(incluirInativos = false) {
  return useQuery({
    queryKey: ['b2c-servicos', incluirInativos],
    queryFn: () =>
      apiClient.request<B2cServico[]>(
        `/v1/b2c-servicos${incluirInativos ? '?incluirInativos=true' : ''}`,
      ),
  });
}

export function useCreateB2cServico() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { nome: string; descricao?: string; icone?: string }) =>
      apiClient.request<B2cServico>('/v1/b2c-servicos', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['b2c-servicos'] }),
  });
}
