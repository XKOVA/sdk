/**
 * Minimal faucet ABI for claim-only interactions.
 *
 * @remarks
 * Purpose:
 * - Provide the ABI fragment required to call the faucet `claimTokens` method.
 *
 * When to use:
 * - Use when encoding calls against faucet contracts configured in tenant networks.
 *
 * When not to use:
 * - Do not use for non-faucet contracts; this ABI is intentionally minimal.
 *
 * Parameters:
 * - None.
 *
 * Return semantics:
 * - Constant ABI array for use with viem/ethers.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - ABI contains only the `claimTokens` function signature.
 *
 * Data/auth references:
 * - Used with faucet contracts returned in tenant config.
 */
export declare const FaucetABI: readonly [{
    readonly type: "function";
    readonly name: "claimTokens";
    readonly inputs: readonly [];
    readonly outputs: readonly [];
    readonly stateMutability: "nonpayable";
}];
