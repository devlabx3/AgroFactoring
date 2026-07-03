"use client";

import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type {
  ContractListResponse,
  DashboardState,
} from "@/features/dashboard/types";

export function useContracts() {
  return useQuery<ContractListResponse>({
    queryKey: ["contracts"],
    queryFn: () => apiGet<ContractListResponse>("/api/contracts/list"),
  });
}

export function useDashboard(contractId: string | null) {
  return useQuery<DashboardState>({
    queryKey: ["dashboard", contractId],
    queryFn: () =>
      apiGet<DashboardState>(
        `/api/dashboard/state?contract_id=${contractId}`
      ),
    enabled: !!contractId,
    refetchInterval: 10_000,
  });
}
