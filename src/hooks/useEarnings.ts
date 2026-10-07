import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

export interface PagamentoVistoriador {
  id: string;
  periodo: string;
  valor: number;
  status: string;
  dataRecebimento?: string;
}

export interface Extrato {
  vistoriadorId: string;
  periodo: string;
  ganhosBrutos: number;
  comissao: number;
  pagoPendente: number;
  pagamentos: PagamentoVistoriador[];
  totalPago: number;
  totalPendente: number;
}

export const useEarnings = (vistoriadorId: string | undefined, periodo: string) => {
  return useQuery({
    queryKey: ['earnings', vistoriadorId, periodo],
    queryFn: async () => {
      if (!vistoriadorId) throw new Error('Vistoriador ID required');
      return apiClient.request<Extrato>(
        `/v1/vistoriadores/${vistoriadorId}/extrato?periodo=${periodo}`
      );
    },
    enabled: !!vistoriadorId,
  });
};
