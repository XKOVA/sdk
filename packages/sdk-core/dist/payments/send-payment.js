const normalizeOptionalString = (value) => {
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
};
const normalizeContactType = (value) => {
    const normalized = value.trim().toLowerCase();
    if (normalized === "account")
        return "account";
    if (normalized === "email")
        return "email";
    if (normalized === "phone")
        return "phone";
    if (normalized === "username")
        return "username";
    return null;
};
const resolveContactType = (contact, provided) => {
    if (provided) {
        const normalized = normalizeContactType(provided);
        if (!normalized) {
            throw new Error("contactType must be one of: account, email, phone, username");
        }
        return normalized;
    }
    if (/^0x[a-fA-F0-9]{40}$/.test(contact)) {
        return "account";
    }
    if (/^\\+?\\d{6,}$/.test(contact)) {
        return "phone";
    }
    if (contact.includes("@")) {
        return "email";
    }
    return "username";
};
/**
 * Normalize and validate send-payment submission input.
 *
 * @remarks
 * Purpose:
 * - Apply the same validation, trimming, and defaults as the sdk-react hook.
 * - Produce a receipt payload for IEE (SafeApprove) approval.
 *
 * Return semantics:
 * - Returns normalized values and the receipt payload.
 *
 * Errors/failure modes:
 * - Throws with the same error messages as useSubmitSendPayment for invalid inputs.
 */
export const normalizeSubmitSendPaymentInput = (payload) => {
    const transactionType = String(payload.transactionType ?? "").trim();
    if (!transactionType) {
        throw new Error("transactionType is required to submit a send payment");
    }
    const amountWei = String(payload.amountWei ?? "").trim();
    if (!amountWei) {
        throw new Error("amountWei is required to submit a send payment");
    }
    const networkId = String(payload.networkId ?? "").trim();
    if (!networkId) {
        throw new Error("networkId is required to submit a send payment");
    }
    const tokenAddress = String(payload.contract ?? "").trim();
    if (!tokenAddress) {
        throw new Error("contract is required to submit a send payment");
    }
    const recipientContact = String(payload.recipientContact ?? payload.recipientEmail ?? "").trim();
    if (!recipientContact) {
        throw new Error("recipientContact is required to submit a send payment");
    }
    const contactType = resolveContactType(recipientContact, payload.contactType);
    const recipientWallet = normalizeOptionalString(payload.recipientAccount);
    const isPending = payload.isPendingPayment !== undefined
        ? Boolean(payload.isPendingPayment)
        : !recipientWallet;
    const fingerprint = normalizeOptionalString(payload.fingerprint);
    if (isPending && !fingerprint) {
        throw new Error("fingerprint is required for pending payments");
    }
    if (!isPending && !recipientWallet) {
        throw new Error("recipientAccount is required for non-pending payments");
    }
    const expiresAt = String(payload.expiresAt ?? "").trim();
    if (!expiresAt) {
        throw new Error("expiresAt is required to submit a send payment");
    }
    const note = typeof payload.description === "string"
        ? payload.description.slice(0, 160)
        : "";
    const recipientProfileId = normalizeOptionalString(payload.recipientProfileId);
    const recipientName = normalizeOptionalString(payload.recipientName);
    const idempotencyKey = normalizeOptionalString(payload.idempotencyKey);
    const normalized = {
        transactionType,
        amountWei,
        networkId,
        tokenAddress,
        recipientContact,
        contactType,
        ...(recipientWallet ? { recipientWallet } : {}),
        ...(recipientProfileId ? { recipientProfileId } : {}),
        ...(recipientName ? { recipientName } : {}),
        isPending,
        ...(fingerprint ? { fingerprint } : {}),
        expiresAt,
        note,
    };
    const receiptPayload = {
        transaction_type: transactionType,
        amount_wei: amountWei,
        network_id: networkId,
        token_address: tokenAddress,
        recipient_contact: recipientContact,
        contact_type: contactType,
        note,
        is_pending_payment: isPending,
        expires_at: expiresAt,
        ...(recipientWallet ? { recipient_wallet_address: recipientWallet } : {}),
        ...(recipientProfileId ? { recipient_profile_id: recipientProfileId } : {}),
        ...(recipientName ? { recipient_name: recipientName } : {}),
        ...(fingerprint ? { fingerprint } : {}),
        ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    };
    return { normalized, receiptPayload };
};
/**
 * Resolve a send-payment submission body using IEE (SafeApprove) approval data.
 *
 * @remarks
 * Purpose:
 * - Apply IEE (SafeApprove)-resolved payload overrides.
 * - Enforce transaction hash matching and required fields.
 *
 * Return semantics:
 * - Returns the final request body for `/payments/send`.
 *
 * Errors/failure modes:
 * - Throws with the same error messages as useSubmitSendPayment on mismatch/absence.
 */
export const buildSubmitSendPaymentBody = (params) => {
    const { input, normalized, approval } = params;
    const resolvedPayload = approval.resolvedPayload ?? {};
    const approvalTxHash = String(approval.transactionHash ?? approval.userOpHash ?? "").trim();
    const providedTxHash = String(input.transactionHash ?? "").trim();
    if (approvalTxHash &&
        providedTxHash &&
        approvalTxHash.toLowerCase() !== providedTxHash.toLowerCase()) {
        throw new Error("transactionHash does not match SafeApprove approval");
    }
    const resolvedTransactionHash = approvalTxHash || providedTxHash;
    if (!resolvedTransactionHash) {
        throw new Error("transactionHash is required to submit a send payment");
    }
    const resolvedRecipientContact = typeof resolvedPayload.recipient_contact === "string"
        ? resolvedPayload.recipient_contact
        : normalized.recipientContact;
    const resolvedContactType = typeof resolvedPayload.contact_type === "string"
        ? resolvedPayload.contact_type
        : normalized.contactType;
    const resolvedRecipientWallet = typeof resolvedPayload.recipient_wallet_address === "string"
        ? resolvedPayload.recipient_wallet_address
        : normalized.recipientWallet;
    const resolvedIsPending = typeof resolvedPayload.is_pending_payment === "boolean"
        ? resolvedPayload.is_pending_payment
        : normalized.isPending;
    const resolvedFingerprint = typeof resolvedPayload.fingerprint === "string"
        ? resolvedPayload.fingerprint
        : normalized.fingerprint;
    const resolvedExpiresAt = typeof resolvedPayload.expires_at === "string"
        ? resolvedPayload.expires_at
        : normalized.expiresAt;
    const resolvedRecipientProfileId = typeof resolvedPayload.recipient_profile_id === "string"
        ? resolvedPayload.recipient_profile_id
        : input.recipientProfileId;
    const resolvedRecipientName = typeof resolvedPayload.recipient_name === "string"
        ? resolvedPayload.recipient_name
        : input.recipientName;
    const normalizedRecipientAccount = normalizeOptionalString(resolvedRecipientWallet);
    const normalizedFingerprint = normalizeOptionalString(resolvedFingerprint);
    const normalizedRecipientProfileId = normalizeOptionalString(resolvedRecipientProfileId);
    const normalizedRecipientName = normalizeOptionalString(resolvedRecipientName);
    const normalizedRecipientEmail = normalizeOptionalString(input.recipientEmail);
    const normalizedSenderAccount = normalizeOptionalString(input.senderAccount);
    const normalizedTokenSymbol = normalizeOptionalString(input.tokenSymbol);
    const normalizedJwtToken = normalizeOptionalString(input.jwtToken);
    const normalizedDescription = normalizeOptionalString(input.description);
    const normalizedIdempotencyKey = normalizeOptionalString(input.idempotencyKey);
    return {
        transactionType: normalized.transactionType,
        amountWei: normalized.amountWei,
        networkId: normalized.networkId,
        contract: normalized.tokenAddress,
        transactionHash: resolvedTransactionHash,
        recipientContact: resolvedRecipientContact,
        contactType: resolvedContactType,
        isPendingPayment: resolvedIsPending,
        expiresAt: resolvedExpiresAt,
        ...(normalizedRecipientAccount
            ? { recipientAccount: normalizedRecipientAccount }
            : {}),
        ...(normalizedFingerprint ? { fingerprint: normalizedFingerprint } : {}),
        ...(normalizedRecipientProfileId
            ? { recipientProfileId: normalizedRecipientProfileId }
            : {}),
        ...(normalizedRecipientName ? { recipientName: normalizedRecipientName } : {}),
        ...(normalizedRecipientEmail ? { recipientEmail: normalizedRecipientEmail } : {}),
        ...(normalizedSenderAccount ? { senderAccount: normalizedSenderAccount } : {}),
        ...(normalizedTokenSymbol ? { tokenSymbol: normalizedTokenSymbol } : {}),
        ...(Number.isFinite(input.tokenDecimals)
            ? { tokenDecimals: input.tokenDecimals }
            : {}),
        ...(normalizedDescription ? { description: normalizedDescription } : {}),
        ...(normalizedJwtToken ? { jwtToken: normalizedJwtToken } : {}),
        ...(normalizedIdempotencyKey ? { idempotencyKey: normalizedIdempotencyKey } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
    };
};
