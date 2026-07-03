"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import type { WithdrawalResponse } from "../types";

interface WithdrawParams {
  contract_id: string;
  amount: number;
  bank_name: string;
  account_last4: string;
}

export function useWithdraw() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: WithdrawParams) =>
      apiPost<WithdrawalResponse>("/api/contract/withdraw", params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
    },
  });
}
