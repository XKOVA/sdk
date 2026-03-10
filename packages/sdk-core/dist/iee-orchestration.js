import { ValidationError, IeeError } from "./errors.js";
import { generateRequestId } from "./telemetry.js";
export const CANONICAL_SERVER_ACTION_TYPES = [
    "payment_request_create_v1",
    "payment_request_complete_v1",
    "payment_request_fail_v1",
    "payment_request_cancel_v1",
    "payment_request_decline_v1",
    "payment_request_remind_v1",
    "payment_request_verify_v1",
    "send_payment_submit_v1",
    "send_payment_cancel_v1",
    "send_payment_cancel_onchain_v1",
    "send_payment_decline_v1",
    "send_payment_remind_v1",
    "send_payment_verify_v1",
    "send_payment_notify_v1",
    "send_payment_generate_v1",
    "aa_userop_submit_v1",
    "agent_pass_grant_v1",
    "agent_pass_revoke_v1",
    "short_url_create_v1",
    "short_url_update_v1",
    "short_url_delete_v1",
    "transfer_transaction_create_v1",
    "transfer_faucet_execute_v1",
    "transfer_transaction_update_v1",
    "contact_create_v1",
    "contact_update_v1",
    "contact_delete_v1",
    "contact_bulk_operation_v1",
    "notification_send_v1",
    "notification_preferences_update_v1",
    "notification_preferences_channel_update_v1",
    "notification_preferences_quiet_hours_update_v1",
    "notification_preferences_global_update_v1",
    "notification_preferences_reset_v1",
    "notification_browser_subscribe_v1",
    "notification_browser_unsubscribe_v1",
    "notification_browser_unsubscribe_all_v1",
    "xns_handle_update_v1",
    "xns_handle_delete_v1",
    "agent_install_prepare_v1",
    "agent_install_confirm_v1",
    "agent_uninstall_initiate_v1",
    "agent_uninstall_confirm_v1",
    "agent_budget_increase_prepare_v1",
    "agent_budget_decrease_prepare_v1",
    "agent_budget_increase_offchain_v1",
    "agent_budget_increase_v1",
    "agent_budget_decrease_v1",
    "agent_installation_pause_v1",
    "agent_installation_resume_v1",
    "agent_installation_retry_webhook_v1",
    "agent_installation_config_update_v1",
    "session_revoke_v1",
    "session_revoke_others_v1",
    "profile_update_v1",
    "account_sub_account_add_v1",
];
const SERVER_REQUIRED_KEYS = {
    payment_request_complete_v1: ["payment_request_id", "transaction_hash"],
    payment_request_fail_v1: ["payment_request_id", "reason"],
    payment_request_cancel_v1: ["payment_request_id"],
    payment_request_decline_v1: ["payment_request_id"],
    payment_request_remind_v1: ["payment_request_id"],
    payment_request_verify_v1: ["payment_request_id", "transaction_hash"],
    send_payment_cancel_v1: ["payment_transfer_id"],
    send_payment_cancel_onchain_v1: ["payment_transfer_id"],
    send_payment_decline_v1: ["payment_transfer_id"],
    send_payment_verify_v1: ["payment_transfer_id", "transaction_hash"],
    send_payment_remind_v1: ["payment_transfer_id"],
    send_payment_notify_v1: ["payment_transfer_id"],
    contact_create_v1: ["email", "name"],
    contact_update_v1: ["contact_id"],
    contact_delete_v1: ["contact_id"],
    contact_bulk_operation_v1: ["operation", "contact_ids_csv"],
    notification_send_v1: [
        "template_id",
        "category",
        "priority",
        "context_type",
        "data_json",
    ],
    notification_preferences_update_v1: ["preferences_json"],
    notification_preferences_channel_update_v1: [
        "notification_type",
        "channel_type",
        "enabled",
    ],
    notification_preferences_quiet_hours_update_v1: ["start", "end", "timezone"],
    notification_preferences_global_update_v1: ["enabled"],
    notification_browser_subscribe_v1: ["endpoint", "p256dh", "auth"],
    notification_browser_unsubscribe_v1: ["subscription_id"],
    short_url_create_v1: ["token_type", "public_token"],
    short_url_update_v1: ["short_code"],
    short_url_delete_v1: ["short_code"],
    xns_handle_update_v1: ["handle_id"],
    xns_handle_delete_v1: ["handle_id"],
    transfer_transaction_update_v1: ["transfer_transaction_id", "status"],
    transfer_faucet_execute_v1: [
        "transfer_type",
        "provider_id",
        "network_id",
        "account",
        "crypto_symbol",
        "fiat_currency",
        "fiat_amount",
        "crypto_amount_wei",
        "payment_method",
    ],
    agent_install_confirm_v1: ["agent_service_id", "budget"],
    agent_install_prepare_v1: ["agent_service_id", "budget"],
    agent_uninstall_initiate_v1: ["installation_id"],
    agent_uninstall_confirm_v1: ["installation_id"],
    agent_budget_increase_prepare_v1: ["installation_id", "additional_budget"],
    agent_budget_decrease_prepare_v1: ["installation_id", "decrease_amount"],
    agent_budget_increase_offchain_v1: ["installation_id", "additional_budget"],
    agent_budget_increase_v1: ["installation_id", "additional_budget"],
    agent_budget_decrease_v1: ["installation_id", "decrease_amount"],
    agent_installation_pause_v1: ["installation_id"],
    agent_installation_resume_v1: ["installation_id"],
    agent_installation_retry_webhook_v1: ["installation_id"],
    agent_installation_config_update_v1: ["installation_id", "install_inputs_json"],
    agent_pass_grant_v1: ["installation_id"],
    agent_pass_revoke_v1: ["installation_id"],
    session_revoke_v1: ["session_id"],
    session_revoke_others_v1: ["current_session_id"],
    aa_userop_submit_v1: ["context_hash"],
};
const CONTACT_TYPES = new Set(["account", "email", "phone", "username"]);
const normalizeContactType = (value) => {
    const normalized = value.trim().toLowerCase();
    if (CONTACT_TYPES.has(normalized))
        return normalized;
    return null;
};
const requireString = (payload, key, actionType) => {
    const value = payload?.[key];
    if (typeof value !== "string" || value.trim() === "") {
        throw new ValidationError(`Missing required field '${key}' for action_type '${actionType}'`);
    }
    return value.trim();
};
const requireBoolean = (payload, key, actionType) => {
    const value = payload?.[key];
    if (typeof value === "boolean")
        return value;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true")
            return true;
        if (normalized === "false")
            return false;
    }
    throw new ValidationError(`Missing required field '${key}' for action_type '${actionType}'`);
};
const validateSendPaymentSubmit = (payload) => {
    const actionType = "send_payment_submit_v1";
    const required = [
        "transaction_type",
        "amount_wei",
        "network_id",
        "token_address",
        "recipient_contact",
        "expires_at",
    ];
    for (const key of required) {
        requireString(payload, key, actionType);
    }
    const contactTypeRaw = requireString(payload, "contact_type", actionType);
    const normalizedContactType = normalizeContactType(contactTypeRaw);
    if (!normalizedContactType) {
        throw new ValidationError(`Invalid contact_type for action_type '${actionType}' (expected account, email, phone, or username)`);
    }
    payload["contact_type"] = normalizedContactType;
    const isPending = requireBoolean(payload, "is_pending_payment", actionType);
    if (isPending) {
        requireString(payload, "fingerprint", actionType);
    }
    else {
        requireString(payload, "recipient_wallet_address", actionType);
    }
    return payload;
};
const EXPOSED_ACTION_SPECS = [
    { sdkActionType: "profile_update", serverActionType: "profile_update_v1" },
    { sdkActionType: "session_revoke", serverActionType: "session_revoke_v1" },
    { sdkActionType: "session_revoke_others", serverActionType: "session_revoke_others_v1" },
    { sdkActionType: "contact_create", serverActionType: "contact_create_v1" },
    { sdkActionType: "contact_update", serverActionType: "contact_update_v1" },
    { sdkActionType: "contact_delete", serverActionType: "contact_delete_v1" },
    { sdkActionType: "contact_bulk_operation", serverActionType: "contact_bulk_operation_v1" },
    { sdkActionType: "transfer_transaction_create", serverActionType: "transfer_transaction_create_v1" },
    { sdkActionType: "transfer_transaction_update", serverActionType: "transfer_transaction_update_v1" },
    { sdkActionType: "transfer_faucet_execute", serverActionType: "transfer_faucet_execute_v1" },
    { sdkActionType: "agent_install_prepare", serverActionType: "agent_install_prepare_v1" },
    { sdkActionType: "agent_install_confirm", serverActionType: "agent_install_confirm_v1" },
    { sdkActionType: "agent_uninstall_initiate", serverActionType: "agent_uninstall_initiate_v1" },
    { sdkActionType: "agent_uninstall_confirm", serverActionType: "agent_uninstall_confirm_v1" },
    { sdkActionType: "agent_installation_pause", serverActionType: "agent_installation_pause_v1" },
    { sdkActionType: "agent_installation_resume", serverActionType: "agent_installation_resume_v1" },
    { sdkActionType: "agent_installation_retry_webhook", serverActionType: "agent_installation_retry_webhook_v1" },
    {
        sdkActionType: "agent_installation_config_update",
        serverActionType: "agent_installation_config_update_v1",
    },
    { sdkActionType: "agent_budget_increase_offchain", serverActionType: "agent_budget_increase_offchain_v1" },
    { sdkActionType: "agent_budget_increase_prepare", serverActionType: "agent_budget_increase_prepare_v1" },
    { sdkActionType: "agent_budget_increase", serverActionType: "agent_budget_increase_v1" },
    { sdkActionType: "agent_budget_decrease_prepare", serverActionType: "agent_budget_decrease_prepare_v1" },
    { sdkActionType: "agent_budget_decrease", serverActionType: "agent_budget_decrease_v1" },
    { sdkActionType: "payment_request_create", serverActionType: "payment_request_create_v1" },
    { sdkActionType: "payment_request_complete", serverActionType: "payment_request_complete_v1" },
    { sdkActionType: "payment_request_cancel", serverActionType: "payment_request_cancel_v1" },
    { sdkActionType: "payment_request_decline", serverActionType: "payment_request_decline_v1" },
    { sdkActionType: "payment_request_remind", serverActionType: "payment_request_remind_v1" },
    { sdkActionType: "send_payment_submit", serverActionType: "send_payment_submit_v1" },
    { sdkActionType: "send_payment_cancel", serverActionType: "send_payment_cancel_v1" },
    { sdkActionType: "send_payment_cancel_onchain", serverActionType: "send_payment_cancel_onchain_v1" },
    { sdkActionType: "send_payment_remind", serverActionType: "send_payment_remind_v1" },
    { sdkActionType: "send_payment_verify", serverActionType: "send_payment_verify_v1" },
];
const THIRD_PARTY_UNSUPPORTED_SERVER_ACTION_TYPES = new Set([]);
const ACTION_SPECS = EXPOSED_ACTION_SPECS.map((spec) => {
    const requiredKeys = SERVER_REQUIRED_KEYS[spec.serverActionType] ?? [];
    const validate = spec.serverActionType === "send_payment_submit_v1" ? validateSendPaymentSubmit : undefined;
    return {
        sdkActionType: spec.sdkActionType,
        serverActionType: spec.serverActionType,
        requiredKeys,
        validate,
        requiresIee: true,
        thirdPartyUnsupported: THIRD_PARTY_UNSUPPORTED_SERVER_ACTION_TYPES.has(spec.serverActionType),
    };
});
const ACTION_SPECS_BY_SDK = new Map(ACTION_SPECS.map((spec) => [spec.sdkActionType, spec]));
const ACTION_SPECS_BY_SERVER = new Map(ACTION_SPECS.map((spec) => [spec.serverActionType, spec]));
export const resolveIeeActionSpec = (actionType) => {
    if (!actionType)
        return null;
    const normalized = String(actionType).trim();
    if (!normalized)
        return null;
    const bySdk = ACTION_SPECS_BY_SDK.get(normalized);
    if (bySdk)
        return bySdk;
    const byServer = ACTION_SPECS_BY_SERVER.get(normalized);
    if (byServer)
        return byServer;
    return null;
};
const normalizeSdkActionType = (actionType) => {
    if (actionType.endsWith("_v1")) {
        return actionType.slice(0, -3);
    }
    return actionType;
};
const normalizeContextValue = (value) => {
    if (typeof value !== "string")
        return "";
    return value.trim();
};
const mergeContextPayload = (payload, context) => {
    if (!context)
        return payload;
    const next = { ...(payload ?? {}) };
    if (!("tenant_id" in next) || !normalizeContextValue(next["tenant_id"])) {
        const tenantId = normalizeContextValue(context.tenantId);
        if (tenantId)
            next["tenant_id"] = tenantId;
    }
    if (!("client_id" in next) || !normalizeContextValue(next["client_id"])) {
        const clientId = normalizeContextValue(context.clientId);
        if (clientId)
            next["client_id"] = clientId;
    }
    if (!("user_id" in next) || !normalizeContextValue(next["user_id"])) {
        const userId = normalizeContextValue(context.userId);
        if (userId)
            next["user_id"] = userId;
    }
    return next;
};
export const prepareIeeActionPayload = (params) => {
    const spec = resolveIeeActionSpec(params.actionType);
    if (!spec) {
        throw new IeeError(`SafeApprove action mapping missing for '${params.actionType}'`, "IEE_ACTION_MAPPING_MISSING", {
            sdkActionType: normalizeSdkActionType(params.actionType),
            serverActionType: params.actionType.endsWith("_v1") ? params.actionType : null,
        });
    }
    let next = mergeContextPayload(params.payload ?? {}, params.context);
    if (spec.canonicalize) {
        next = spec.canonicalize(next);
    }
    if (spec.requiredKeys.length > 0) {
        for (const key of spec.requiredKeys) {
            requireString(next, key, spec.serverActionType);
        }
    }
    if (spec.validate) {
        const validated = spec.validate(next);
        if (validated) {
            next = validated;
        }
    }
    return { spec, payload: next };
};
export class IeeOrchestrator {
    constructor(config = {}) {
        this.inflight = new Map();
        this.receiptProvider = config.receiptProvider;
        this.requireExplicitReceipt = Boolean(config.requireExplicitReceipt);
        this.contextProvider = config.contextProvider;
    }
    async ensureReceipt(params) {
        const context = this.contextProvider?.() ?? null;
        const { spec, payload } = prepareIeeActionPayload({
            actionType: params.actionType,
            payload: params.payload,
            context,
        });
        if (spec.thirdPartyUnsupported) {
            throw new IeeError(`Action is not supported for third-party clients (${spec.sdkActionType}).`, "THIRD_PARTY_ACTION_UNSUPPORTED", { sdkActionType: spec.sdkActionType, serverActionType: spec.serverActionType });
        }
        const receipt = String(params.receipt ?? "").trim();
        if (receipt) {
            return {
                status: "approved",
                receipt,
                sdkActionType: spec.sdkActionType,
                serverActionType: spec.serverActionType,
            };
        }
        if (this.requireExplicitReceipt || !this.receiptProvider) {
            throw new IeeError(`SafeApprove receipt required for ${spec.sdkActionType}. Run in a browser with a SafeApprove provider or pass a receipt explicitly.`, "IEE_REQUIRED", { sdkActionType: spec.sdkActionType, serverActionType: spec.serverActionType });
        }
        const missingContext = [];
        if (!normalizeContextValue(payload["tenant_id"]))
            missingContext.push("tenant_id");
        if (!normalizeContextValue(payload["client_id"]))
            missingContext.push("client_id");
        if (!normalizeContextValue(payload["user_id"]))
            missingContext.push("user_id");
        if (missingContext.length > 0) {
            throw new ValidationError(`Missing SafeApprove context: ${missingContext.join(", ")}.`);
        }
        const key = spec.sdkActionType;
        const pending = this.inflight.get(key);
        if (pending) {
            return pending;
        }
        const requestId = generateRequestId();
        const promise = this.receiptProvider
            .getReceipt({
            serverActionType: spec.serverActionType,
            payload,
            receiptRequestId: requestId,
        })
            .then((result) => {
            if (result.status === "approved") {
                return {
                    ...result,
                    sdkActionType: spec.sdkActionType,
                    serverActionType: spec.serverActionType,
                };
            }
            if (result.status === "cancelled") {
                throw new IeeError(`SafeApprove approval cancelled for ${spec.sdkActionType}.`, "IEE_CANCELLED", { sdkActionType: spec.sdkActionType, serverActionType: spec.serverActionType });
            }
            throw new IeeError(result.error?.message || `SafeApprove approval failed for ${spec.sdkActionType}.`, "IEE_FAILED", {
                sdkActionType: spec.sdkActionType,
                serverActionType: spec.serverActionType,
                providerErrorCode: result.error?.code ?? null,
            });
        })
            .finally(() => {
            this.inflight.delete(key);
        });
        this.inflight.set(key, promise);
        return promise;
    }
    async withReceipt(params) {
        const approval = await this.ensureReceipt({
            actionType: params.actionType,
            payload: params.payload,
            receipt: params.receipt,
        });
        return params.run(approval);
    }
}
export const iee = {
    resolveIeeActionSpec,
    prepareIeeActionPayload,
    IeeOrchestrator,
};
