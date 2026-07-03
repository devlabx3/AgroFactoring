"use client";

import { useState, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { apiPost } from "@/lib/api-client";
import { useFreighter } from "@/features/stellar/hooks/use-freighter";
import {
  buildInitTx,
  buildReleasePhaseTx,
  submitAndConfirm,
} from "@/features/stellar/utils/transaction-builder";
import type { TxStatus, TxStep } from "@/features/stellar/types";
import type { InitDataResponse, ReleaseDataResponse } from "@/features/dashboard/types";

function useTxFlow() {
  const [status, setStatus] = useState<TxStatus>({
    step: "idle",
    message: "",
  });
  const [showModal, setShowModal] = useState(false);
  const lastStepRef = useRef<TxStep>("idle");

  const trackSetStatus = useCallback((newStatus: TxStatus) => {
    if (newStatus.step !== "error") {
      lastStepRef.current = newStatus.step;
    }
    setStatus(newStatus);
  }, []);

  const setError = useCallback((message: string, error: string) => {
    setStatus({
      step: "error",
      message,
      error,
      errorAtStep: lastStepRef.current,
    });
  }, []);

  const reset = useCallback(() => {
    lastStepRef.current = "idle";
    setStatus({ step: "idle", message: "" });
    setShowModal(false);
  }, []);

  return { status, setStatus: trackSetStatus, setError, showModal, setShowModal, reset };
}

export function useInitContract() {
  const { address, sign } = useFreighter();
  const queryClient = useQueryClient();
  const { status, setStatus, setError, showModal, setShowModal, reset } = useTxFlow();

  const execute = useCallback(
    async (contractId: string, cropId: string, exporterId: string) => {
      if (!address) return;

      setShowModal(true);

      try {
        // 1. Get init data from backend
        setStatus({ step: "preparing", message: "Preparing transaction..." });
        const initData = await apiPost<InitDataResponse>(
          "/api/contract/get-init-data",
          { crop_id: cropId, exporter_id: exporterId }
        );

        // 2. Build + simulate tx
        setStatus({ step: "simulating", message: "Simulating on Soroban..." });
        const xdr = await buildInitTx(address, {
          farmerAddress: initData.farmer_address,
          cropIdNum: initData.crop_id_num,
          totalAmountStroops: initData.total_amount_stroops,
          phaseAmountStroops: initData.phase_amount_stroops,
        });

        // 3. Sign with Freighter
        setStatus({ step: "signing", message: "Waiting for wallet signature..." });
        const signedXdr = await sign(xdr);

        // 4. Submit + poll
        setStatus({ step: "submitting", message: "Submitting transaction..." });
        const txHash = await submitAndConfirm(signedXdr);

        // 5. Confirm in backend
        setStatus({ step: "confirming", message: "Waiting for confirmation..." });
        await apiPost("/api/contract/confirm-on-chain", {
          contract_id: contractId,
          tx_type: "init",
          tx_hash: txHash,
          exporter_address: address,
          farmer_address: initData.farmer_address,
        });

        // 6. Success
        setStatus({ step: "confirmed", message: "Transaction confirmed", txHash });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["contracts"] });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError("Transaction failed", message);
      }
    },
    [address, sign, setStatus, setError, setShowModal, queryClient]
  );

  return { status, showModal, execute, reset };
}

export function useReleasePhase() {
  const { address, sign } = useFreighter();
  const queryClient = useQueryClient();
  const { status, setStatus, setError, showModal, setShowModal, reset } = useTxFlow();

  const execute = useCallback(
    async (contractId: string) => {
      if (!address) return;

      setShowModal(true);

      try {
        // 1. Get release data
        setStatus({ step: "preparing", message: "Preparing transaction..." });
        const releaseData = await apiPost<ReleaseDataResponse>(
          "/api/contract/get-release-data",
          { contract_id: contractId }
        );

        // 2. Build + simulate tx
        setStatus({ step: "simulating", message: "Simulating on Soroban..." });
        const xdr = await buildReleasePhaseTx(address, {
          cropIdNum: releaseData.crop_id_num,
          newPhaseNum: releaseData.new_phase_num,
        });

        // 3. Sign
        setStatus({ step: "signing", message: "Waiting for wallet signature..." });
        const signedXdr = await sign(xdr);

        // 4. Submit + poll
        setStatus({ step: "submitting", message: "Submitting transaction..." });
        const txHash = await submitAndConfirm(signedXdr);

        // 5. Confirm in backend
        setStatus({ step: "confirming", message: "Waiting for confirmation..." });
        await apiPost("/api/contract/confirm-on-chain", {
          contract_id: contractId,
          tx_type: "release",
          tx_hash: txHash,
          new_phase: releaseData.new_phase_num,
        });

        // 6. Success
        setStatus({ step: "confirmed", message: "Transaction confirmed", txHash });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError("Transaction failed", message);
      }
    },
    [address, sign, setStatus, setError, setShowModal, queryClient]
  );

  return { status, showModal, execute, reset };
}
