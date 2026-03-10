export declare const CANONICAL_SERVER_ACTION_TYPES: readonly ["payment_request_create_v1", "payment_request_complete_v1", "payment_request_fail_v1", "payment_request_cancel_v1", "payment_request_decline_v1", "payment_request_remind_v1", "payment_request_verify_v1", "send_payment_submit_v1", "send_payment_cancel_v1", "send_payment_cancel_onchain_v1", "send_payment_decline_v1", "send_payment_remind_v1", "send_payment_verify_v1", "send_payment_notify_v1", "send_payment_generate_v1", "aa_userop_submit_v1", "agent_pass_grant_v1", "agent_pass_revoke_v1", "short_url_create_v1", "short_url_update_v1", "short_url_delete_v1", "transfer_transaction_create_v1", "transfer_faucet_execute_v1", "transfer_transaction_update_v1", "contact_create_v1", "contact_update_v1", "contact_delete_v1", "contact_bulk_operation_v1", "notification_send_v1", "notification_preferences_update_v1", "notification_preferences_channel_update_v1", "notification_preferences_quiet_hours_update_v1", "notification_preferences_global_update_v1", "notification_preferences_reset_v1", "notification_browser_subscribe_v1", "notification_browser_unsubscribe_v1", "notification_browser_unsubscribe_all_v1", "xns_handle_update_v1", "xns_handle_delete_v1", "agent_install_prepare_v1", "agent_install_confirm_v1", "agent_uninstall_initiate_v1", "agent_uninstall_confirm_v1", "agent_budget_increase_prepare_v1", "agent_budget_decrease_prepare_v1", "agent_budget_increase_offchain_v1", "agent_budget_increase_v1", "agent_budget_decrease_v1", "agent_installation_pause_v1", "agent_installation_resume_v1", "agent_installation_retry_webhook_v1", "agent_installation_config_update_v1", "session_revoke_v1", "session_revoke_others_v1", "profile_update_v1", "account_sub_account_add_v1"];
export type CanonicalServerActionType = typeof CANONICAL_SERVER_ACTION_TYPES[number];
export type SdkActionType = string;
export type IeeActionContext = {
    tenantId?: string | null;
    clientId?: string | null;
    userId?: string | null;
};
export interface IeeActionSpec {
    sdkActionType: SdkActionType;
    serverActionType: CanonicalServerActionType;
    requiredKeys: string[];
    canonicalize?: (payload: Record<string, unknown>) => Record<string, unknown>;
    validate?: (payload: Record<string, unknown>) => Record<string, unknown> | void;
    requiresIee?: boolean;
    thirdPartyUnsupported?: boolean;
}
export type IeeReceiptProviderApproved = {
    status: "approved";
    receipt: string;
    actionType?: string;
    actionHash?: string;
    jti?: string;
    contextHash?: string | null;
    transactionHash?: string | null;
    userOpHash?: string | null;
    preparationToken?: string | null;
    installationId?: string | null;
    resolvedPayload?: Record<string, unknown> | null;
};
export type IeeReceiptProviderResult = IeeReceiptProviderApproved | {
    status: "cancelled";
} | {
    status: "error";
    error: {
        code: string;
        message: string;
    };
};
export interface IeeReceiptProviderParams {
    serverActionType: CanonicalServerActionType;
    payload: Record<string, unknown>;
    receiptRequestId?: string;
}
export interface IeeReceiptProvider {
    getReceipt: (params: IeeReceiptProviderParams) => Promise<IeeReceiptProviderResult>;
}
export interface IeeReceiptApproval extends IeeReceiptProviderApproved {
    sdkActionType: SdkActionType;
    serverActionType: CanonicalServerActionType;
}
export interface IeeOrchestratorConfig {
    receiptProvider?: IeeReceiptProvider;
    requireExplicitReceipt?: boolean;
    contextProvider?: () => IeeActionContext | null | undefined;
}
export declare const resolveIeeActionSpec: (actionType: string) => IeeActionSpec | null;
export declare const prepareIeeActionPayload: (params: {
    actionType: string;
    payload: Record<string, unknown>;
    context?: IeeActionContext | null;
}) => {
    spec: IeeActionSpec;
    payload: Record<string, unknown>;
};
export declare class IeeOrchestrator {
    private readonly receiptProvider?;
    private readonly requireExplicitReceipt;
    private readonly contextProvider?;
    private readonly inflight;
    constructor(config?: IeeOrchestratorConfig);
    ensureReceipt(params: {
        actionType: string;
        payload: Record<string, unknown>;
        receipt?: string | null;
    }): Promise<IeeReceiptApproval>;
    withReceipt<T>(params: {
        actionType: string;
        payload: Record<string, unknown>;
        receipt?: string | null;
        run: (approval: IeeReceiptApproval) => Promise<T>;
    }): Promise<T>;
}
export declare const iee: {
    resolveIeeActionSpec: (actionType: string) => IeeActionSpec | null;
    prepareIeeActionPayload: (params: {
        actionType: string;
        payload: Record<string, unknown>;
        context?: IeeActionContext | null;
    }) => {
        spec: IeeActionSpec;
        payload: Record<string, unknown>;
    };
    IeeOrchestrator: typeof IeeOrchestrator;
};
