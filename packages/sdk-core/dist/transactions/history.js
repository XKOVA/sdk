import { formatTransactionAmount } from "../services.js";
const AGENT_AVATAR_DATA_URL = (() => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#f5f5f5'/><stop offset='100%' stop-color='#e4e4e7'/></linearGradient></defs><rect width='56' height='56' rx='12' fill='url(#g)'/><rect x='14' y='16' width='28' height='22' rx='8' fill='#111827'/><circle cx='23' cy='27' r='3' fill='#ffffff'/><circle cx='33' cy='27' r='3' fill='#ffffff'/><rect x='24' y='8' width='8' height='7' rx='3' fill='#111827'/><rect x='21' y='38' width='14' height='4' rx='2' fill='#111827'/></svg>";
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
})();
const GENERIC_TX_AVATAR_DATA_URL = (() => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 56 56'><defs><linearGradient id='g2' x1='0' y1='0' x2='1' y2='1'><stop offset='0%' stop-color='#f5f5f5'/><stop offset='100%' stop-color='#e4e4e7'/></linearGradient></defs><rect width='56' height='56' rx='12' fill='url(#g2)'/><path d='M16 22h24' stroke='#111827' stroke-width='3' stroke-linecap='round'/><path d='M16 34h24' stroke='#111827' stroke-width='3' stroke-linecap='round'/><path d='M34 18l6 4-6 4' stroke='#111827' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' fill='none'/><path d='M22 30l-6 4 6 4' stroke='#111827' stroke-width='3' stroke-linecap='round' stroke-linejoin='round' fill='none'/></svg>";
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
})();
/**
 * Derive a UI feed status from canonical transaction status.
 *
 * @remarks
 * This keeps lightweight transaction feeds aligned to server canonical semantics
 * without each app duplicating status mapping logic.
 *
 * @param statusCanonical - Canonical status emitted by apps/api.
 * @returns Feed status enum for simple UI rendering.
 */
export const deriveFeedStatus = (statusCanonical) => {
    if (statusCanonical === "success")
        return "completed";
    if (statusCanonical === "failed")
        return "failed";
    return "pending";
};
/**
 * Build query params for transaction history requests.
 *
 * @remarks
 * Purpose:
 * - Apply the same query normalization as sdk-react hooks.
 * - Default is grouped view (1 row per agent transaction); set view=events for raw fee-split transfers.
 * - Excludes user-operation wrapper rows by default unless explicitly disabled.
 *
 * Return semantics:
 * - Returns URLSearchParams ready to append to `/transactions/history`.
 */
export const buildTransactionHistorySearchParams = (params) => {
    const search = new URLSearchParams();
    const excludeUserOperationWrappers = typeof params?.excludeUserOperationWrappers === "boolean"
        ? params.excludeUserOperationWrappers
        : true;
    if (params?.account)
        search.set("account", params.account.toLowerCase());
    if (params?.agentInstallationId)
        search.set("agentInstallationId", params.agentInstallationId);
    if (params?.agentServiceId)
        search.set("agentServiceId", params.agentServiceId);
    if (params?.networkId !== undefined)
        search.set("networkId", String(params.networkId));
    if (params?.eventType)
        search.set("eventType", params.eventType);
    if (params?.eventSubtype)
        search.set("eventSubtype", params.eventSubtype);
    if (params?.executionMethod)
        search.set("executionMethod", params.executionMethod);
    if (excludeUserOperationWrappers) {
        search.set("excludeUserOperationWrappers", "true");
    }
    if (params?.status)
        search.set("status", params.status);
    if (params?.direction)
        search.set("direction", params.direction);
    if (params?.contract)
        search.set("contract", params.contract.toLowerCase());
    if (params?.category)
        search.set("category", params.category);
    if (params?.assetType)
        search.set("assetType", params.assetType);
    if (params?.source)
        search.set("source", params.source);
    // Default view is grouped. Only send `view` when explicitly requesting raw events.
    if (params?.view && params.view !== "grouped")
        search.set("view", params.view);
    if (typeof params?.limit === "number" && Number.isFinite(params.limit)) {
        const normalizedLimit = Math.floor(params.limit);
        if (normalizedLimit > 0) {
            search.set("limit", String(Math.min(normalizedLimit, 100)));
        }
    }
    // Cursor-based pagination (preferred)
    if (params?.cursor)
        search.set("cursor", params.cursor);
    // Legacy offset pagination (deprecated)
    if (typeof params?.offset === "number" && !params?.cursor)
        search.set("offset", String(params.offset));
    return search;
};
/**
 * Normalize and enrich transaction history response items.
 *
 * @remarks
 * Purpose:
 * - Compute display amounts, token metadata fallbacks, and direction.
 * - Preserve API-owned canonical semantics (`category`, `provenance`, `counterparty`).
 * - Extract contact/provider metadata for display labels only.
 * - Prefer API-provided canonical image object and apply strict fallback mapping when absent.
 * - Filter duplicate user_operation wrapper rows when grouped.
 *
 * Return semantics:
 * - Returns a response object with mapped transaction items.
 */
export const normalizeTransactionHistoryResponse = (payload, options) => {
    const tokens = options?.tokens ?? [];
    const transferProviders = options?.transferProviders ?? [];
    const faucetByAddress = new Map();
    const providerById = new Map();
    const providerByProviderId = new Map();
    for (const provider of transferProviders) {
        const addr = provider.faucetContract?.trim().toLowerCase();
        if (!addr)
            continue;
        faucetByAddress.set(addr, {
            providerId: provider.providerId,
            name: provider.name,
            id: provider.id,
            logoUrl: provider.logoUrl ?? null,
        });
        if (provider.id) {
            providerById.set(String(provider.id), {
                logoUrl: provider.logoUrl ?? null,
                name: provider.name
            });
        }
        if (provider.providerId) {
            providerByProviderId.set(String(provider.providerId), {
                logoUrl: provider.logoUrl ?? null,
                name: provider.name
            });
        }
    }
    const normalizeMetadata = (value) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return {};
        }
        return value;
    };
    const readMetadataString = (metadata, keys) => {
        for (const key of keys) {
            const raw = metadata[key];
            if (typeof raw === "string" && raw.trim().length > 0) {
                return raw.trim();
            }
        }
        return null;
    };
    const humanizeLabel = (value) => {
        const cleaned = value.replace(/[_-]+/g, " ").trim();
        if (!cleaned)
            return value;
        return cleaned
            .split(/\s+/)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");
    };
    const categoryLabel = (category) => {
        switch (category) {
            case "agent":
                return "Agent";
            case "p2p":
                return "P2P";
            case "transfer":
                return "Transfer";
            case "escrow":
                return "Escrow";
            default:
                return null;
        }
    };
    const eventTypeLabel = (eventType) => {
        switch (eventType) {
            case "token_transfer":
                return "Transfer";
            case "nft_transfer":
                return "NFT Transfer";
            case "contract_interaction":
                return "Contract Interaction";
            case "account_deployment":
                return "Account Deployment";
            default:
                return null;
        }
    };
    const normalizeDirection = (d) => {
        if (d === "incoming")
            return "in";
        if (d === "outgoing")
            return "out";
        if (d === "in" || d === "out" || d === "internal")
            return d;
        return d ?? "internal";
    };
    const isImageSource = (value) => value === "ramp_provider" ||
        value === "agent_icon" ||
        value === "counterparty_avatar" ||
        value === "network_logo" ||
        value === "fallback";
    const resolveExpectedImageSource = (tx) => {
        if (tx.category === "transfer")
            return "ramp_provider";
        if (tx.category === "agent")
            return "agent_icon";
        if (tx.category === "p2p")
            return "counterparty_avatar";
        if (tx.provenance === "external")
            return "network_logo";
        return "fallback";
    };
    const resolveCanonicalImage = (params) => {
        const { tx, expectedSource, counterpartyLabel, providerLabel, providerLogoUrl, legacyCounterpartyAvatarUrl, legacyAgentServiceIconUrl, } = params;
        const apiImageRaw = tx?.image;
        const apiImage = apiImageRaw && typeof apiImageRaw === "object" && !Array.isArray(apiImageRaw)
            ? apiImageRaw
            : null;
        const apiUrl = typeof apiImage?.url === "string" && apiImage.url.trim().length > 0
            ? apiImage.url.trim()
            : null;
        const apiSource = isImageSource(apiImage?.source) ? apiImage.source : null;
        const apiAlt = typeof apiImage?.alt === "string" && apiImage.alt.trim().length > 0
            ? apiImage.alt.trim()
            : null;
        if (apiUrl && apiSource) {
            return {
                url: apiUrl,
                source: apiSource,
                alt: apiAlt,
            };
        }
        const legacyBySource = (() => {
            if (expectedSource === "ramp_provider") {
                return providerLogoUrl;
            }
            if (expectedSource === "agent_icon") {
                return legacyAgentServiceIconUrl;
            }
            if (expectedSource === "counterparty_avatar") {
                return legacyCounterpartyAvatarUrl;
            }
            return null;
        })();
        if (legacyBySource) {
            const legacyAlt = expectedSource === "ramp_provider"
                ? providerLabel ?? "Ramp Provider"
                : expectedSource === "agent_icon"
                    ? counterpartyLabel ?? "Agent"
                    : counterpartyLabel ?? "Counterparty";
            return {
                url: legacyBySource,
                source: expectedSource,
                alt: legacyAlt,
            };
        }
        if (expectedSource === "agent_icon") {
            return {
                url: AGENT_AVATAR_DATA_URL,
                source: "fallback",
                alt: counterpartyLabel ?? "Agent",
            };
        }
        const fallbackAlt = expectedSource === "network_logo"
            ? "Network"
            : expectedSource === "ramp_provider"
                ? providerLabel ?? "Ramp Provider"
                : counterpartyLabel ?? "Transaction";
        return {
            url: GENERIC_TX_AVATAR_DATA_URL,
            source: "fallback",
            alt: fallbackAlt,
        };
    };
    const mappedTransactions = (payload.transactions ?? []).map((tx) => {
        const txWithLegacy = tx;
        const { counterpartyAvatarUrl: legacyCounterpartyAvatarUrl, rampProviderLogoUrl: legacyRampProviderLogoUrl, agentServiceIconUrl: legacyAgentServiceIconUrl, ...txBase } = txWithLegacy;
        const metadata = normalizeMetadata(tx?.metadata);
        const agentServiceName = typeof tx?.agentServiceName === "string" &&
            tx.agentServiceName.trim().length > 0
            ? tx.agentServiceName.trim()
            : null;
        const isAgentTransaction = tx?.category === "agent" ||
            tx?.counterparty?.type === "agent" ||
            Boolean(tx?.agentServiceId) ||
            Boolean(agentServiceName);
        const shouldInjectAgentNote = isAgentTransaction &&
            agentServiceName &&
            !readMetadataString(metadata, ["note", "description"]);
        const metadataWithAgentHint = shouldInjectAgentNote
            ? { ...metadata, note: agentServiceName }
            : metadata;
        const senderContact = readMetadataString(metadataWithAgentHint, ["sender_contact", "senderContact"]);
        const recipientContact = readMetadataString(metadataWithAgentHint, ["recipient_contact", "recipientContact"]);
        const rampProviderId = readMetadataString(metadataWithAgentHint, ["ramp_provider_id", "rampProviderId"]);
        const rampProviderName = readMetadataString(metadataWithAgentHint, ["ramp_provider_name", "rampProviderName"]);
        const faucetMatch = (() => {
            if (faucetByAddress.size === 0)
                return null;
            const byTo = faucetByAddress.get((tx.toAccount ?? "").toLowerCase());
            if (byTo)
                return byTo;
            const byFrom = faucetByAddress.get((tx.fromAccount ?? "").toLowerCase());
            if (byFrom)
                return byFrom;
            return null;
        })();
        const providerRaw = rampProviderName ??
            rampProviderId ??
            faucetMatch?.name ??
            faucetMatch?.providerId ??
            faucetMatch?.id ??
            null;
        const rampLogoFromProviderId = rampProviderId
            ? providerByProviderId.get(String(rampProviderId))?.logoUrl ?? null
            : null;
        const rampLogoFromId = rampProviderId
            ? providerById.get(String(rampProviderId))?.logoUrl ?? null
            : null;
        const rampProviderLogoUrl = rampLogoFromProviderId ??
            rampLogoFromId ??
            faucetMatch?.logoUrl ??
            legacyRampProviderLogoUrl ??
            null;
        const isFaucet = providerRaw ? providerRaw.toLowerCase().includes("faucet") : false;
        const providerLabel = providerRaw ? humanizeLabel(providerRaw) : null;
        const computedDirection = normalizeDirection(tx.direction);
        const tokenMeta = tx.contract
            ? tokens.find((t) => typeof t !== "string" && t.contract?.toLowerCase() === tx.contract?.toLowerCase())
            : undefined;
        const tokenDecimals = tx.tokenDecimals ?? tokenMeta?.decimals ?? 18;
        const tokenSymbol = tx.tokenSymbol ?? tokenMeta?.symbol ?? (tx.contract ? "TOKEN" : "NATIVE");
        const tokenLogoUrl = tokenMeta && "logoUrl" in tokenMeta ? (tokenMeta.logoUrl ?? null) : null;
        // Only show a human amount for transfers where amountRaw represents an asset movement.
        // Contract interactions (e.g. user_operation) often have no amountRaw and should not show a fake token amount.
        const displayAmount = tx.amountRaw != null && (tx.eventType === "token_transfer" || tx.eventType === "nft_transfer")
            ? formatTransactionAmount({
                amountRaw: String(tx.amountRaw),
                tokenDecimals,
                tokenSymbol,
                direction: computedDirection
            })
            : "-";
        const categoryDisplay = categoryLabel(tx.category);
        const eventTypeDisplay = eventTypeLabel(tx.eventType) ||
            (tx.eventType ? humanizeLabel(tx.eventType) : null);
        const counterpartyLabel = (() => {
            if (tx.counterparty?.primaryLabel) {
                return tx.counterparty.primaryLabel;
            }
            if (isFaucet && providerLabel)
                return providerLabel;
            if (computedDirection === "out") {
                return recipientContact ?? tx.toAccount ?? null;
            }
            if (computedDirection === "in") {
                return senderContact ?? tx.fromAccount ?? null;
            }
            return (recipientContact ??
                senderContact ??
                tx.toAccount ??
                tx.fromAccount ??
                null);
        })();
        const faucetDisplay = isFaucet && providerLabel
            ? computedDirection === "out"
                ? `${providerLabel} Withdraw`
                : computedDirection === "in"
                    ? `${providerLabel} Deposit`
                    : providerLabel
            : null;
        const provenanceDisplay = tx.provenance === "external" ? "External" : null;
        const displayType = faucetDisplay ||
            provenanceDisplay ||
            categoryDisplay ||
            eventTypeDisplay ||
            "Transaction";
        const expectedImageSource = resolveExpectedImageSource(tx);
        const image = resolveCanonicalImage({
            tx,
            expectedSource: expectedImageSource,
            counterpartyLabel,
            providerLabel,
            providerLogoUrl: rampProviderLogoUrl,
            legacyCounterpartyAvatarUrl: typeof legacyCounterpartyAvatarUrl === "string"
                ? legacyCounterpartyAvatarUrl
                : null,
            legacyAgentServiceIconUrl: typeof legacyAgentServiceIconUrl === "string"
                ? legacyAgentServiceIconUrl
                : null,
        });
        return {
            ...txBase,
            direction: computedDirection,
            feedStatus: deriveFeedStatus(tx.statusCanonical),
            tokenDecimals,
            tokenSymbol,
            displayAmount,
            tokenLogoUrl,
            image,
            rampProviderLogoUrl: image.source === "ramp_provider" ? image.url : null,
            displayType,
            counterpartyLabel,
            counterpartyAvatarUrl: image.source === "ramp_provider" ? null : image.url,
            senderContact,
            recipientContact,
            rampProviderId: rampProviderId ?? faucetMatch?.providerId ?? null,
            rampProviderName: rampProviderName ?? faucetMatch?.name ?? null,
            ...(shouldInjectAgentNote ? { metadata: metadataWithAgentHint } : {}),
        };
    });
    // If a tx hash has a token_transfer row, hide the "user_operation" meta row for the same hash.
    //
    // IMPORTANT: Only do this for the default grouped UX.
    // If the caller explicitly requested `view=events`, they want raw rows and we must not drop anything.
    const filteredTransactions = (() => {
        if (options?.view === "events")
            return mappedTransactions;
        const hashesWithTransfers = new Set(mappedTransactions
            .filter((t) => t.transactionHash && t.eventType === "token_transfer")
            .map((t) => t.transactionHash));
        return mappedTransactions.filter((t) => {
            if (!t.transactionHash)
                return true;
            if (!hashesWithTransfers.has(t.transactionHash))
                return true;
            return !(t.eventType === "contract_interaction" &&
                t.eventSubtype === "user_operation" &&
                t.executionMethod === "user_operation");
        });
    })();
    return {
        ...payload,
        transactions: filteredTransactions
    };
};
