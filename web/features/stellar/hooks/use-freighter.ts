"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
  signTransaction,
  getNetwork,
} from "@stellar/freighter-api";
import { NETWORK_PASSPHRASE, STELLAR_NETWORK } from "../config";

export interface FreighterState {
  connected: boolean;
  address: string | null;
  network: string | null;
  isCorrectNetwork: boolean;
  isInstalled: boolean | null;
}

export function useFreighter() {
  const [state, setState] = useState<FreighterState>({
    connected: false,
    address: null,
    network: null,
    isCorrectNetwork: false,
    isInstalled: null,
  });

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const { isConnected: installed, error } = await isConnected();
    if (error || !installed) {
      setState((s) => ({ ...s, isInstalled: false }));
      return;
    }

    setState((s) => ({ ...s, isInstalled: true }));

    const { address: addr, error: addrError } = await getAddress();
    if (addrError || !addr) return;

    const { network: net, error: netError } = await getNetwork();
    if (netError) return;

    setState({
      connected: true,
      address: addr,
      network: net,
      isCorrectNetwork: net === STELLAR_NETWORK,
      isInstalled: true,
    });
  };

  const connect = useCallback(async () => {
    const { isConnected: installed, error } = await isConnected();
    if (error || !installed) {
      throw new Error("FREIGHTER_NOT_INSTALLED");
    }

    const { address: addr, error: accessError } = await requestAccess();
    if (accessError) throw new Error(accessError.message);

    const { network: net, error: netError } = await getNetwork();
    if (netError) throw new Error(netError.message);

    setState({
      connected: true,
      address: addr,
      network: net,
      isCorrectNetwork: net === STELLAR_NETWORK,
      isInstalled: true,
    });

    return addr;
  }, []);

  const disconnect = useCallback(() => {
    setState({
      connected: false,
      address: null,
      network: null,
      isCorrectNetwork: false,
      isInstalled: state.isInstalled,
    });
  }, [state.isInstalled]);

  const sign = useCallback(
    async (xdr: string) => {
      if (!state.connected) throw new Error("WALLET_NOT_CONNECTED");
      if (!state.isCorrectNetwork) throw new Error("WRONG_NETWORK");

      const { signedTxXdr, error } = await signTransaction(xdr, {
        networkPassphrase: NETWORK_PASSPHRASE,
      });

      if (error) {
        if (error.message?.includes("User declined")) {
          throw new Error("USER_REJECTED");
        }
        throw new Error(error.message);
      }

      return signedTxXdr;
    },
    [state.connected, state.isCorrectNetwork]
  );

  return { ...state, connect, disconnect, sign };
}
