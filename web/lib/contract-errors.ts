/** Map contract error codes to user-friendly Spanish messages.
 *  #1–#9, #11 = AgroFactoring escrow contract (ContractError enum in lib.rs).
 *  #10, #13   = Stellar Asset Contract (USDC token) errors propagated during
 *               cross-contract calls (e.g. token.transfer inside init).
 *
 *  Shared between the client (transaction-builder) and the server routes
 *  (trigger-disaster, resolve-disaster, ...) so simulation errors are mapped
 *  consistently everywhere — not dumped raw to the UI.
 */
export const CONTRACT_ERRORS: Record<string, string> = {
  "#1": "Admin no inicializado",
  "#2": "El escrow ya fue inicializado para este cultivo",
  "#3": "No autorizado para esta acción",
  "#4": "Escrow no encontrado — inicialice el contrato on-chain primero",
  "#5": "Monto inválido (cero, negativo o no divisible)",
  "#6": "El escrow está congelado por desastre",
  "#7": "Fase inválida o fuera de orden",
  "#8": "USDC no configurado en el contrato",
  "#9": "Las partes no coinciden con el escrow",
  "#10": "Saldo USDC insuficiente — el exportador no tiene fondos suficientes para cubrir el monto total del contrato",
  "#11": "El escrow no está congelado — solo se puede resolver un escrow congelado",
  "#13": "Transferencia de token no autorizada o allowance insuficiente",
};

/** Convert a raw Soroban simulation error string into a user-friendly message.
 *  Extracts the `#N` code, looks it up in CONTRACT_ERRORS, and falls back to
 *  a trimmed first line if no code is found.
 */
export function parseSimulationError(raw: string, method: string): string {
  const errorMatch = raw.match(/#(\d+)/);
  if (errorMatch) {
    const code = `#${errorMatch[1]}`;
    const friendly = CONTRACT_ERRORS[code];
    if (friendly) return friendly;
    return `Error del contrato (${code}) al ejecutar "${method}"`;
  }
  // Fallback: trim the verbose diagnostic log
  const firstLine = raw.split("\n")[0];
  if (firstLine.length > 120) {
    return firstLine.slice(0, 120) + "…";
  }
  return firstLine;
}
