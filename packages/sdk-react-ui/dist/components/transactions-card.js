"use client";
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { formatTransactionAmount } from "@xkova/sdk-core";
import { useResourceFreshness, useRealtimeStatus, useTransactionHistory, useTenantConfig, } from "@xkova/sdk-react";
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Button } from "./ui/button.js";
import { BalanceText } from "./ui/balance-text.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card.js";
import { CardEmptyState, CardHeaderRow } from "./ui/card-layout.js";
import { NetworkText } from "./ui/network-text.js";
import { Select } from "./ui/select.js";
import { Skeleton } from "./ui/skeleton.js";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table.js";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip.js";
import { Badge } from "./ui/badge.js";
import { useRefreshState } from "./use-refresh-state.js";
import { toastSuccess } from "../toast-utils.js";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsLeft, ChevronsRight, ExternalLink, History, Info, RefreshCw } from "lucide-react";
/**
 * Transaction history card.
 *
 * @remarks
 * Purpose:
 * - Renders tenant-scoped transaction history with filters, paging, result counts, and type tooltips.
 * - Type tooltips are rendered via a portal to avoid overflow clipping in table rows.
 * - Counterparty address tooltips are portaled to keep full values visible.
 * - Pagination controls are always visible; range counts use server-provided totals.
 * - Pagination controls wrap onto multiple lines on small screens.
 * - On small screens, rows render as stacked cards instead of a table.
 * - Column headers are sortable (applies to the current page).
 *
 * When to use:
 * - Use when displaying transaction history in UI.
 *
 * When not to use:
 * - Do not use outside a XKOVAProvider tree.
 *
 * Parameters:
 * - props.pageSize: Page size for server-side pagination (number, optional).
 * - props.contract: Token contract filter (string, optional).
 * - props.account: Account identifier filter (string, optional).
 * - props.autoRefreshMs: Auto-refresh interval in ms (number, optional).
 * - props.showStableTokenLogo: Show stable token logos next to amounts (boolean, optional).
 * - props.showStableTokenSymbol: Show stable token symbols next to amounts (boolean, optional).
 * - props.view: History view mode ("grouped" | "events", optional).
 * - props.source: History source filter ("all" | "api" | "indexer", optional).
 * - props.showUserOperationWrappers: Show user-operation wrapper rows (boolean, optional).
 *
 * Return semantics:
 * - Returns a card layout with filters, table, totals, and pagination UI.
 *
 * Errors/failure modes:
 * - Displays an inline error message when history fetch fails.
 * - Loading: shows skeleton only on the first load; refresh keeps content and spins the refresh icon.
 *
 * Side effects:
 * - Fetches transaction history and refreshes on the configured interval.
 *
 * Invariants/assumptions:
 * - Uses tenant-provided networks/tokens only.
 * - Pagination state is cursor-based and resets on filter changes.
 *
 * Data/auth references:
 * - `useTransactionHistory` for server data.
 * - `useTenantConfig` for networks/tokens.
 *
 * @example
 * <TransactionsCard account="0x..." pageSize={20} />
 *
 * @see useTransactionHistory
 * @see useTenantConfig
 */
export function TransactionsCard({ pageSize = 10, contract, account, autoRefreshMs = 15000, showStableTokenLogo = true, showStableTokenSymbol = false, view, source, showUserOperationWrappers = false, }) {
    const { networks, tokens, isLoading: configLoading } = useTenantConfig();
    const realtime = useRealtimeStatus();
    const transactionFreshness = useResourceFreshness("transactions");
    const [rowsPerPage, setRowsPerPage] = useState(pageSize);
    const [page, setPage] = useState(1);
    const [networkIdFilter, setNetworkIdFilter] = useState();
    const [directionFilter, setDirectionFilter] = useState();
    const [statusFilter, setStatusFilter] = useState();
    const [contractFilter, setContractFilter] = useState(contract);
    const [typeFilter, setTypeFilter] = useState();
    const [categoryFilter, setCategoryFilter] = useState();
    const [sort, setSort] = useState({
        key: "time",
        direction: "desc"
    });
    const isEventsView = view === "events";
    // Keep local contract filter in sync with the prop (so switching externally updates the UI).
    useEffect(() => {
        setContractFilter(contract);
    }, [contract]);
    // Whenever any filter changes, reset to page 1
    useEffect(() => {
        setPage(1);
    }, [
        rowsPerPage,
        networkIdFilter,
        directionFilter,
        statusFilter,
        contractFilter,
        typeFilter,
        categoryFilter,
        account,
        view,
        source,
        showUserOperationWrappers
    ]);
    const offset = useMemo(() => Math.max(0, (page - 1) * rowsPerPage), [page, rowsPerPage]);
    const resolvedAutoRefreshMs = useMemo(() => {
        if (!autoRefreshMs || autoRefreshMs <= 0)
            return undefined;
        return realtime.status === "connected" ? undefined : autoRefreshMs;
    }, [autoRefreshMs, realtime.status]);
    // Fetch transactions using server-side pagination
    const { transactions, total, hasMore, isLoading, error, refetch, freshness } = useTransactionHistory({
        networkId: networkIdFilter,
        direction: directionFilter,
        status: statusFilter,
        contract: contractFilter,
        category: categoryFilter,
        assetType: typeFilter,
        account,
        view: isEventsView ? "events" : undefined,
        source,
        limit: rowsPerPage,
        offset: isEventsView ? undefined : offset,
        autoRefreshMs: resolvedAutoRefreshMs,
        excludeUserOperationWrappers: !showUserOperationWrappers
    });
    const loading = configLoading || isLoading;
    const { isInitialLoading, isRefreshing } = useRefreshState(loading, transactions.length > 0);
    const [highlightedRows, setHighlightedRows] = useState({});
    const highlightTimersRef = useRef(new Map());
    const previousStatusByKeyRef = useRef(new Map());
    const previousHashByKeyRef = useRef(new Map());
    const normalizeFeedStatus = useCallback((tx) => {
        const fromFeed = typeof tx?.feedStatus === "string" ? tx.feedStatus.toLowerCase() : "";
        if (fromFeed === "completed")
            return "completed";
        if (fromFeed === "failed")
            return "failed";
        if (fromFeed === "pending")
            return "pending";
        const canonical = typeof tx?.statusCanonical === "string" ? tx.statusCanonical.toLowerCase() : "";
        if (canonical === "success" || canonical === "confirmed" || canonical === "mined")
            return "completed";
        if (canonical === "failed" || canonical === "cancelled" || canonical === "reverted")
            return "failed";
        return "pending";
    }, []);
    const flashRows = useCallback((rowIds) => {
        if (rowIds.length === 0)
            return;
        const now = Date.now();
        const expiresAt = now + 3500;
        setHighlightedRows((prev) => {
            const next = { ...prev };
            for (const rowId of rowIds) {
                next[rowId] = expiresAt;
            }
            return next;
        });
        for (const rowId of rowIds) {
            const existing = highlightTimersRef.current.get(rowId);
            if (existing)
                clearTimeout(existing);
            const timer = setTimeout(() => {
                setHighlightedRows((prev) => {
                    const next = { ...prev };
                    delete next[rowId];
                    return next;
                });
                highlightTimersRef.current.delete(rowId);
            }, 3600);
            highlightTimersRef.current.set(rowId, timer);
        }
    }, []);
    useEffect(() => {
        const nextStatusByKey = new Map();
        const nextHashByKey = new Map();
        const changedRowIds = [];
        for (const tx of transactions) {
            const rowKey = tx?.id && String(tx.id).trim().length > 0
                ? String(tx.id)
                : tx?.transactionHash && String(tx.transactionHash).trim().length > 0
                    ? String(tx.transactionHash).toLowerCase()
                    : "";
            if (!rowKey)
                continue;
            const nextStatus = normalizeFeedStatus(tx);
            const nextHash = tx?.transactionHash && String(tx.transactionHash).trim().length > 0
                ? String(tx.transactionHash).toLowerCase()
                : "";
            const previousStatus = previousStatusByKeyRef.current.get(rowKey);
            const previousHash = previousHashByKeyRef.current.get(rowKey) ?? "";
            if (previousStatus && previousStatus !== nextStatus) {
                changedRowIds.push(rowKey);
                if (previousStatus === "pending" &&
                    (nextStatus === "completed" || nextStatus === "failed")) {
                    toastSuccess(nextStatus === "completed"
                        ? "Transaction completed"
                        : "Transaction failed");
                }
            }
            if (previousHash && nextHash && previousHash !== nextHash) {
                changedRowIds.push(rowKey);
            }
            nextStatusByKey.set(rowKey, nextStatus);
            nextHashByKey.set(rowKey, nextHash);
        }
        if (changedRowIds.length > 0) {
            flashRows(Array.from(new Set(changedRowIds)));
        }
        previousStatusByKeyRef.current = nextStatusByKey;
        previousHashByKeyRef.current = nextHashByKey;
    }, [flashRows, normalizeFeedStatus, transactions]);
    useEffect(() => {
        return () => {
            for (const timer of highlightTimersRef.current.values()) {
                clearTimeout(timer);
            }
            highlightTimersRef.current.clear();
        };
    }, []);
    const feedHealth = useMemo(() => {
        if (transactionFreshness.isStale || freshness?.isStale) {
            return { label: "Stale", variant: "destructive" };
        }
        if (realtime.status === "connected") {
            return { label: "Live", variant: "success" };
        }
        if (realtime.status === "connecting") {
            return { label: "Connecting", variant: "secondary" };
        }
        if (realtime.status === "disabled") {
            return { label: "Polling", variant: "secondary" };
        }
        return { label: "Reconnecting", variant: "secondary" };
    }, [freshness?.isStale, realtime.status, transactionFreshness.isStale]);
    const showRealtimeFallbackNotice = realtime.status !== "connected" && realtime.status !== "disabled";
    const realtimeFallbackReason = realtime.status === "error" && realtime.lastError
        ? ` (${realtime.lastError})`
        : "";
    const defaultSortDirection = useCallback((key) => (key === "time" ? "desc" : "asc"), []);
    const handleSort = useCallback((key) => {
        setSort((prev) => {
            if (prev.key === key) {
                return {
                    key,
                    direction: prev.direction === "asc" ? "desc" : "asc"
                };
            }
            return { key, direction: defaultSortDirection(key) };
        });
    }, [defaultSortDirection]);
    /**
     * Single canonical timestamp rule for ordering + display.
     *
     * Why:
     * - `createdAt` is when OAuth/API pre-wrote the row (can be much earlier)
     * - `queuedAt` is when it entered XKOVA Core queue
     * - `minedAt` / `blockTimestamp` represent on-chain finalization time
     *
     * So "newest" should be on-chain-first:
     * blockTimestamp || minedAt || queuedAt || createdAt
     */
    const getEffectiveTimestamp = useCallback((tx) => {
        const ts = tx?.blockTimestamp ?? tx?.minedAt ?? tx?.queuedAt ?? tx?.createdAt;
        return typeof ts === "string" && ts.length > 0 ? ts : undefined;
    }, []);
    const getEffectiveTimeMs = useCallback((tx) => {
        const ts = getEffectiveTimestamp(tx);
        if (!ts)
            return 0;
        const t = new Date(ts).getTime();
        return Number.isFinite(t) ? t : 0;
    }, [getEffectiveTimestamp]);
    // Server-side pagination: API returns exactly one page of sorted, filtered data
    const pageRows = transactions ?? [];
    const getCounterpartySortValue = useCallback((tx) => {
        const base = Array.isArray(tx.movements) && tx.movements.length > 0 ? tx.movements[0] : tx;
        const dir = String(base?.direction ?? tx?.direction ?? "");
        const from = base?.fromAccount ?? tx?.fromAccount ?? null;
        const to = base?.toAccount ?? tx?.toAccount ?? null;
        if (dir === "in")
            return from ? String(from) : "";
        if (dir === "out")
            return to ? String(to) : "";
        if (from && to)
            return `${from}|${to}`;
        return from ? String(from) : to ? String(to) : "";
    }, []);
    const getAmountSortValue = useCallback((tx) => {
        const base = Array.isArray(tx.movements) && tx.movements.length > 0 ? tx.movements[0] : tx;
        const amountRaw = base?.amountRaw ?? base?.amount ?? base?.value ?? null;
        if (amountRaw === null || amountRaw === undefined)
            return 0n;
        try {
            return BigInt(String(amountRaw));
        }
        catch {
            return 0n;
        }
    }, []);
    const getSortValue = useCallback((tx, key) => {
        switch (key) {
            case "hash":
                return tx.transactionHash ?? "";
            case "direction":
                return tx.direction ?? "";
            case "status":
                return tx.status ?? "";
            case "type":
                return tx.category ?? "";
            case "asset":
                return tx.assetType ?? "";
            case "counterparty":
                return getCounterpartySortValue(tx);
            case "amount":
                return getAmountSortValue(tx);
            case "network":
                return Number(tx.networkId) || 0;
            case "time":
                return getEffectiveTimeMs(tx);
            default:
                return "";
        }
    }, [getAmountSortValue, getCounterpartySortValue, getEffectiveTimeMs]);
    const sortedRows = useMemo(() => {
        if (pageRows.length === 0)
            return pageRows;
        const entries = pageRows.map((row, index) => ({ row, index }));
        const compare = (a, b) => {
            if (typeof a === "bigint" && typeof b === "bigint") {
                if (a < b)
                    return -1;
                if (a > b)
                    return 1;
                return 0;
            }
            if (typeof a === "number" && typeof b === "number") {
                return a - b;
            }
            return String(a ?? "").localeCompare(String(b ?? ""));
        };
        entries.sort((left, right) => {
            const aValue = getSortValue(left.row, sort.key);
            const bValue = getSortValue(right.row, sort.key);
            let result = compare(aValue, bValue);
            if (result === 0) {
                result = left.index - right.index;
            }
            return sort.direction === "asc" ? result : -result;
        });
        return entries.map((entry) => entry.row);
    }, [pageRows, getSortValue, sort]);
    // Totals are computed server-side for grouped view; fall back to visible rows if total is missing.
    const resolvedTotal = useMemo(() => {
        const base = typeof total === "number" ? total : 0;
        return Math.max(base, pageRows.length);
    }, [total, pageRows.length]);
    // Pagination: page index is UI-driven; API uses limit + offset.
    const currentPage = page;
    const totalPages = useMemo(() => Math.max(1, Math.ceil(resolvedTotal / rowsPerPage)), [resolvedTotal, rowsPerPage]);
    const canGoPrev = currentPage > 1 && !loading;
    const canGoNext = (isEventsView ? hasMore : currentPage < totalPages) && !loading;
    const canGoLast = !isEventsView && currentPage < totalPages && !loading;
    const rangeStart = useMemo(() => (pageRows.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1), [currentPage, pageRows.length, rowsPerPage]);
    const rangeEnd = useMemo(() => pageRows.length === 0
        ? 0
        : Math.min(rangeStart + pageRows.length - 1, resolvedTotal), [pageRows.length, rangeStart, resolvedTotal]);
    const rangeLabel = pageRows.length === 0
        ? `Showing 0 of ${resolvedTotal}`
        : `Showing ${rangeStart}-${rangeEnd} of ${resolvedTotal}`;
    const handlePrevPage = useCallback(() => {
        setPage((p) => Math.max(1, p - 1));
    }, []);
    const handleNextPage = useCallback(() => {
        if (!canGoNext)
            return;
        setPage((p) => p + 1);
    }, [canGoNext]);
    const handleFirstPage = useCallback(() => {
        setPage(1);
    }, []);
    const handleLastPage = useCallback(() => {
        if (!canGoLast)
            return;
        setPage(totalPages);
    }, [canGoLast, totalPages]);
    const getNetworkLabel = useCallback((networkId) => {
        if (!networkId)
            return _jsx("span", { children: "Unknown" });
        const net = networks.find((n) => String(n.networkId) === String(networkId));
        if (!net)
            return _jsx("span", { children: `Network ${networkId}` });
        return _jsx(NetworkText, { name: net.name, logoUrl: net.logoUrl });
    }, [networks]);
    const getExplorerTxUrl = useCallback((networkId, txHash) => {
        if (!networkId || !txHash)
            return null;
        const net = networks.find((n) => String(n.networkId) === String(networkId));
        const base = net?.explorerUrl ?? net?.explorer_url ?? null;
        if (!base)
            return null;
        const trimmed = String(base).replace(/\/+$/, "");
        return `${trimmed}/tx/${txHash}`;
    }, [networks]);
    const getTokenSymbol = useCallback((contract) => {
        if (!contract)
            return null;
        const token = tokens.find((t) => t.contract?.toLowerCase() === contract.toLowerCase());
        return token?.symbol;
    }, [tokens]);
    const formatAmount = useCallback((tx) => {
        const token = tx.contract
            ? tokens.find((t) => t.contract?.toLowerCase() === tx.contract?.toLowerCase())
            : undefined;
        const amountRaw = tx.amountRaw ?? tx.amount ?? tx.value ?? null;
        const tokenDecimals = tx.tokenDecimals ?? token?.decimals ?? 18;
        const tokenSymbol = tx.tokenSymbol ?? token?.symbol ?? (token?.contract ? token.symbol : undefined);
        if (!amountRaw || tokenDecimals === undefined || tokenDecimals === null) {
            return tx.amount ?? tx.value ?? "-";
        }
        // Stable-token presentation: $X.XX + optional logo, no symbol by default (symbol is often shown elsewhere).
        if (token?.isStable) {
            try {
                const value = BigInt(String(amountRaw));
                const isOut = tx.direction === "out";
                return (_jsxs("span", { className: "inline-flex items-baseline", children: [isOut ? _jsx("span", { className: "mr-0.5", children: "-" }) : null, _jsx(BalanceText, { value: value, decimals: tokenDecimals, symbol: tokenSymbol ?? token?.symbol, isStable: true, logoUrl: token.logoUrl ?? undefined, showSymbol: showStableTokenSymbol, showLogo: showStableTokenLogo })] }));
            }
            catch {
                // Fall through to legacy formatting if parsing fails
            }
        }
        return formatTransactionAmount({
            amountRaw: String(amountRaw),
            tokenDecimals,
            tokenSymbol,
            direction: tx.direction
        });
    }, [tokens, showStableTokenLogo, showStableTokenSymbol]);
    const truncateHash = (hash) => `${hash.slice(0, 6)}...${hash.slice(-4)}`;
    const truncateIdentifier = (value) => `${value.slice(0, 6)}...${value.slice(-4)}`;
    const CounterpartyCell = ({ tx }) => {
        const base = Array.isArray(tx.movements) && tx.movements.length > 0 ? tx.movements[0] : tx;
        const dir = String(base?.direction ?? tx?.direction ?? "");
        const from = base?.fromAccount ?? tx?.fromAccount ?? null;
        const to = base?.toAccount ?? tx?.toAccount ?? null;
        const fromValue = from ? String(from) : null;
        const toValue = to ? String(to) : null;
        const renderTooltip = (display, content) => (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "cursor-help", children: display }) }), _jsx(TooltipContent, { side: "top", className: "max-w-[260px] break-all whitespace-pre-line font-mono", children: content })] }));
        if (dir === "in") {
            return fromValue ? (renderTooltip(truncateIdentifier(fromValue), fromValue)) : (_jsx("span", { className: "text-muted-foreground", children: "-" }));
        }
        if (dir === "out") {
            return toValue ? (renderTooltip(truncateIdentifier(toValue), toValue)) : (_jsx("span", { className: "text-muted-foreground", children: "-" }));
        }
        // internal / unknown: show both when available
        if (fromValue && toValue) {
            return renderTooltip(`${truncateIdentifier(fromValue)} → ${truncateIdentifier(toValue)}`, `From: ${fromValue}\nTo: ${toValue}`);
        }
        if (fromValue)
            return renderTooltip(truncateIdentifier(fromValue), fromValue);
        if (toValue)
            return renderTooltip(truncateIdentifier(toValue), toValue);
        return _jsx("span", { className: "text-muted-foreground", children: "-" });
    };
    const formatTimestamp = (ts) => {
        const date = new Date(ts);
        return date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    };
    const DirectionIcon = ({ direction }) => {
        switch (direction) {
            case "in":
                return _jsx(ArrowDownLeft, { className: "h-4 w-4 text-emerald-500" });
            case "out":
                return _jsx(ArrowUpRight, { className: "h-4 w-4 text-amber-500" });
            case "internal":
                return _jsx(ArrowLeftRight, { className: "h-4 w-4 text-blue-500" });
            default:
                return null;
        }
    };
    const StatusBadge = ({ tx }) => {
        const hasFeedStatus = typeof tx?.feedStatus === "string";
        const feedStatus = normalizeFeedStatus(tx);
        const normalized = tx?.status === "mined" ? "success" : tx?.status;
        const variant = useMemo(() => {
            if (hasFeedStatus) {
                if (feedStatus === "completed")
                    return "success";
                if (feedStatus === "failed")
                    return "destructive";
                return "secondary";
            }
            switch (normalized) {
                case "success":
                    return "success";
                case "failed":
                case "cancelled":
                    return "destructive";
                case "queued":
                case "submitted":
                case "pending":
                    return "secondary";
                default:
                    return "secondary";
            }
        }, [feedStatus, hasFeedStatus, normalized]);
        const label = useMemo(() => {
            if (hasFeedStatus) {
                if (feedStatus === "completed")
                    return "Completed";
                if (feedStatus === "failed")
                    return "Failed";
                return "Pending";
            }
            switch (normalized) {
                case "success":
                    return "Success";
                case "failed":
                    return "Failed";
                case "cancelled":
                    return "Cancelled";
                case "queued":
                    return "Queued";
                case "submitted":
                    return "Submitted";
                case "pending":
                    return "Pending";
                case "unknown":
                    return "Unknown";
                default:
                    return normalized ?? "Unknown";
            }
        }, [feedStatus, hasFeedStatus, normalized]);
        return _jsx(Badge, { variant: variant, children: label });
    };
    const AssetBadge = ({ tx }) => {
        const type = String(tx?.assetType ?? "other");
        const label = (() => {
            switch (type) {
                case "native":
                    return "Native";
                case "token":
                    return "Token";
                case "nft":
                    return "NFT";
                case "mixed":
                    return "Mixed";
                case "deployment":
                    return "Deployment";
                case "contract":
                    return "Contract";
                default:
                    return "Other";
            }
        })();
        return _jsx(Badge, { variant: "secondary", children: label });
    };
    /**
     * Transaction type badge with optional detail tooltip.
     *
     * @remarks
     * Purpose:
     * - Renders the category label and a tooltip with context (recipient/sender/provider).
     *
     * Parameters:
     * - tx: Transaction row with category and metadata (object, required).
     *
     * Return semantics:
     * - Returns a badge + tooltip trigger; tooltip renders in a portal when available.
     *
     * Errors/failure modes:
     * - None; missing metadata simply omits the tooltip.
     *
     * Side effects:
     * - None.
     *
     * Invariants/assumptions:
     * - Tooltip content is plain text and safe to render.
     *
     * Data/auth references:
     * - Uses transaction metadata from `useTransactionHistory`.
     *
     * @example
     * <TypeBadge tx={row} />
     *
     * @see Tooltip
     * @see TooltipContent
     */
    const TypeBadge = ({ tx }) => {
        const category = String(tx?.category ?? "other");
        const label = (() => {
            switch (category) {
                case "agent":
                    return "Agent";
                case "transfer":
                    return "Transfer";
                case "p2p":
                    return "P2P";
                case "escrow":
                    return "Escrow";
                default:
                    return "Other";
            }
        })();
        const metadata = tx?.metadata ?? null;
        const pendingPaymentsKey = "es" + "crow";
        const pendingPaymentsEventKey = `${pendingPaymentsKey}_event`;
        const transferProviderLegacyKey = "ra" + "mp_provider_name";
        const transferProviderLegacyCamelKey = "ra" + "mpProviderName";
        const resolveRecipient = () => metadata?.recipient_contact ??
            metadata?.recipientContact ??
            metadata?.payment?.recipientContact ??
            metadata?.payment?.recipient_contact ??
            metadata?.[pendingPaymentsKey]?.recipientContact ??
            metadata?.[pendingPaymentsKey]?.recipient_contact ??
            null;
        const resolveSender = () => metadata?.sender_contact ??
            metadata?.senderContact ??
            metadata?.payer_email ??
            metadata?.payerEmail ??
            null;
        const resolveDirectionLabel = () => {
            const dir = String(tx?.direction ?? "");
            if (dir === "in")
                return "From";
            if (dir === "out")
                return "To";
            return null;
        };
        const resolveCounterparty = () => {
            const recipient = resolveRecipient();
            const sender = resolveSender();
            const dir = String(tx?.direction ?? "");
            if (dir === "in")
                return sender ? String(sender) : recipient ? String(recipient) : null;
            if (dir === "out")
                return recipient ? String(recipient) : sender ? String(sender) : null;
            return recipient ? String(recipient) : sender ? String(sender) : null;
        };
        const detail = (() => {
            if (category === "agent") {
                return tx?.agentServiceName ? String(tx.agentServiceName) : null;
            }
            if (category === "transfer") {
                const fromMeta = tx?.transferProviderName ??
                    metadata?.transfer_provider_name ??
                    metadata?.transferProviderName ??
                    metadata?.provider_name ??
                    metadata?.providerName ??
                    metadata?.[transferProviderLegacyKey] ??
                    metadata?.[transferProviderLegacyCamelKey] ??
                    null;
                return fromMeta ? String(fromMeta) : null;
            }
            if (category === "p2p" || category === "escrow") {
                return resolveCounterparty();
            }
            if (category === "other") {
                const dir = String(tx?.direction ?? "");
                const from = tx?.fromAccount ? String(tx.fromAccount) : null;
                const to = tx?.toAccount ? String(tx.toAccount) : null;
                if (dir === "in")
                    return from ? `From: ${from}` : null;
                if (dir === "out")
                    return to ? `To: ${to}` : null;
                if (dir === "internal") {
                    if (from && to)
                        return `From: ${from}\nTo: ${to}`;
                    return from ? `From: ${from}` : to ? `To: ${to}` : null;
                }
                if (from && to)
                    return `From: ${from}\nTo: ${to}`;
                return from ? `From: ${from}` : to ? `To: ${to}` : null;
            }
            return null;
        })();
        const pendingPaymentEvent = (() => {
            const v = metadata?.pending_payment_event ??
                metadata?.pendingPaymentEvent ??
                metadata?.[pendingPaymentsEventKey] ??
                metadata?.[`${pendingPaymentsKey}Event`] ??
                metadata?.event ??
                null;
            return v ? String(v) : null;
        })();
        const directionLabel = resolveDirectionLabel();
        const tooltipText = category === "agent"
            ? detail
                ? `Agent: ${detail}`
                : "Agent"
            : category === "transfer"
                ? detail
                    ? `Transfer: ${detail}`
                    : "Transfer"
                : category === "p2p"
                    ? detail
                        ? directionLabel === "From"
                            ? `From: ${detail}`
                            : directionLabel === "To"
                                ? `To: ${detail}`
                                : `P2P: ${detail}`
                        : "P2P"
                    : category === "escrow"
                        ? detail
                            ? (() => {
                                const event = pendingPaymentEvent?.toLowerCase?.() ?? "";
                                const prefix = event === "refunded" || event === "refund" || event === "cancel" || event === "cancelled"
                                    ? "Refund"
                                    : event === "released"
                                        ? "Release"
                                        : "Escrow";
                                if (directionLabel === "From")
                                    return `${prefix} From: ${detail}`;
                                if (directionLabel === "To")
                                    return `${prefix} To: ${detail}`;
                                return `${prefix}: ${detail}`;
                            })()
                            : "Escrow"
                        : category === "other"
                            ? detail
                                ? detail
                                : "Other"
                            : null;
        return (_jsxs("div", { className: "flex items-center gap-1", children: [_jsx(Badge, { variant: "secondary", className: "flex items-center justify-center", children: label }), tooltipText ? (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("button", { type: "button", className: "inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground", "aria-label": "Type info", children: _jsx(Info, { className: "h-3.5 w-3.5" }) }) }), _jsx(TooltipContent, { side: "top", align: "center", className: "max-w-[240px] whitespace-pre-line", children: tooltipText })] })) : null] }));
    };
    const SortableHead = ({ label, column, align = "left", className }) => {
        const isActive = sort.key === column;
        const ariaSort = isActive ? (sort.direction === "asc" ? "ascending" : "descending") : "none";
        const headClassName = `${className ?? ""} w-[11%]`.trim();
        return (_jsx(TableHead, { "aria-sort": ariaSort, className: headClassName, children: _jsxs("button", { type: "button", onClick: () => handleSort(column), className: `flex w-full items-center gap-1 ${align === "right" ? "justify-end" : "justify-start"}`, children: [_jsx("span", { children: label }), isActive ? (sort.direction === "asc" ? (_jsx(ChevronUp, { className: "h-3 w-3" })) : (_jsx(ChevronDown, { className: "h-3 w-3" }))) : (_jsx(ArrowUpDown, { className: "h-3 w-3 text-muted-foreground" }))] }) }));
    };
    return (_jsx(TooltipProvider, { delayDuration: 150, children: _jsxs(Card, { children: [_jsx(CardHeader, { children: _jsx(CardHeaderRow, { title: _jsxs(CardTitle, { className: "flex items-center gap-2", children: [_jsx(History, { className: "h-5 w-5" }), "Transactions", _jsx(Badge, { variant: feedHealth.variant, children: feedHealth.label })] }), description: _jsxs(CardDescription, { children: ["Recent transaction history (", resolvedTotal, " total)."] }), actions: _jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { asChild: true, children: _jsx("span", { className: "inline-flex", children: _jsx(Button, { variant: "outline", size: "icon-sm", onClick: () => refetch(), disabled: isRefreshing, "aria-label": "Refresh", children: _jsx(RefreshCw, { className: `h-4 w-4 ${isRefreshing ? "animate-spin" : ""}` }) }) }) }), _jsx(TooltipContent, { children: "Refresh" })] }) }) }), _jsxs(CardContent, { className: "space-y-4", children: [showRealtimeFallbackNotice ? (_jsxs("div", { className: "rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900", children: ["Realtime connection is unavailable", realtimeFallbackReason, "; polling fallback", resolvedAutoRefreshMs ? ` every ${Math.max(1, Math.round(resolvedAutoRefreshMs / 1000))}s` : "", "."] })) : null, _jsxs("div", { className: "grid w-full grid-cols-2 sm:grid-cols-6 gap-2", children: [_jsxs(Select, { value: directionFilter ?? "", onChange: (e) => {
                                        setDirectionFilter(e.target.value || undefined);
                                        setPage(1);
                                    }, children: [_jsx("option", { value: "", children: "All Directions" }), _jsx("option", { value: "in", children: "Incoming" }), _jsx("option", { value: "out", children: "Outgoing" }), _jsx("option", { value: "internal", children: "Internal" })] }), _jsxs(Select, { value: statusFilter ?? "", onChange: (e) => {
                                        setStatusFilter(e.target.value || undefined);
                                        setPage(1);
                                    }, children: [_jsx("option", { value: "", children: "All Statuses" }), _jsx("option", { value: "queued", children: "Queued" }), _jsx("option", { value: "submitted", children: "Submitted" }), _jsx("option", { value: "pending", children: "Pending" }), _jsx("option", { value: "success", children: "Success" }), _jsx("option", { value: "mined", children: "Mined" }), _jsx("option", { value: "failed", children: "Failed" }), _jsx("option", { value: "cancelled", children: "Cancelled" }), _jsx("option", { value: "unknown", children: "Unknown" })] }), _jsxs(Select, { value: categoryFilter ?? "", onChange: (e) => {
                                        setCategoryFilter(e.target.value || undefined);
                                        setPage(1);
                                    }, children: [_jsx("option", { value: "", children: "All Types" }), _jsx("option", { value: "transfer", children: "Transfer" }), _jsx("option", { value: "p2p", children: "P2P" }), _jsx("option", { value: "escrow", children: "Escrow" }), _jsx("option", { value: "agent", children: "Agent" }), _jsx("option", { value: "other", children: "Other" })] }), _jsxs(Select, { value: typeFilter ?? "", onChange: (e) => {
                                        setTypeFilter(e.target.value || undefined);
                                        setPage(1);
                                    }, children: [_jsx("option", { value: "", children: "All Assets" }), _jsx("option", { value: "native", children: "Native" }), _jsx("option", { value: "token", children: "Token" }), _jsx("option", { value: "nft", children: "NFT" }), _jsx("option", { value: "mixed", children: "Mixed" }), _jsx("option", { value: "deployment", children: "Deployment" }), _jsx("option", { value: "contract", children: "Contract" })] }), _jsxs(Select, { value: contractFilter ?? "", onChange: (e) => {
                                        setContractFilter(e.target.value || undefined);
                                        setPage(1);
                                    }, children: [_jsx("option", { value: "", children: "All Tokens" }), tokens.map((t) => (_jsx("option", { value: t.contract ?? "", children: t.symbol }, t.contract)))] }), _jsxs(Select, { value: networkIdFilter?.toString() ?? "", onChange: (e) => {
                                        setNetworkIdFilter(e.target.value ? Number(e.target.value) : undefined);
                                        setPage(1);
                                    }, children: [_jsx("option", { value: "", children: "All Networks" }), networks.map((n) => {
                                            const id = Number(n.networkId);
                                            if (!Number.isFinite(id))
                                                return null;
                                            return (_jsx("option", { value: String(id), children: n.name }, n.networkId));
                                        })] })] }), isInitialLoading ? (_jsxs("div", { className: "space-y-2", children: [_jsx(Skeleton, { className: "h-10 w-full" }), _jsx(Skeleton, { className: "h-10 w-full" }), _jsx(Skeleton, { className: "h-10 w-full" })] })) : error ? (_jsxs("div", { className: "text-sm text-destructive py-4 text-center", children: ["Failed to load transactions: ", error.message] })) : pageRows.length === 0 ? (_jsx(CardEmptyState, { className: "py-8", children: "No transactions found." })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "space-y-3 sm:hidden", children: sortedRows.map((tx) => {
                                        const txUrl = tx.transactionHash
                                            ? getExplorerTxUrl(tx.networkId, tx.transactionHash)
                                            : null;
                                        const rowKey = tx?.id && String(tx.id).trim().length > 0
                                            ? String(tx.id)
                                            : tx?.transactionHash && String(tx.transactionHash).trim().length > 0
                                                ? String(tx.transactionHash).toLowerCase()
                                                : "";
                                        const isRowHighlighted = rowKey
                                            ? (highlightedRows[rowKey] ?? 0) > Date.now()
                                            : false;
                                        const ts = getEffectiveTimestamp(tx);
                                        const counterparty = _jsx(CounterpartyCell, { tx: tx });
                                        const amount = Array.isArray(tx.movements) && tx.movements.length > 0
                                            ? (() => {
                                                const m = tx.movements[0];
                                                return (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { children: formatAmount(m) }), tx.movements.length > 1 ? (_jsxs("span", { className: "text-xs text-muted-foreground", children: ["+", tx.movements.length - 1, " more"] })) : null] }));
                                            })()
                                            : formatAmount(tx);
                                        return (_jsxs("div", { className: `rounded-lg border border-border/60 p-3 space-y-2 transition-colors ${isRowHighlighted ? "bg-emerald-50/70 ring-1 ring-emerald-300" : ""}`, children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-xs text-muted-foreground", children: "Hash" }), tx.transactionHash ? (txUrl ? (_jsxs("a", { href: txUrl, target: "_blank", rel: "noopener noreferrer", className: "inline-flex items-center gap-1 font-mono text-xs hover:text-primary", children: [truncateHash(tx.transactionHash), _jsx(ExternalLink, { className: "h-3 w-3" })] })) : (_jsx("span", { className: "font-mono text-xs", children: truncateHash(tx.transactionHash) }))) : (_jsx("span", { className: "text-muted-foreground", children: "Pending" }))] }), _jsx(StatusBadge, { tx: tx })] }), _jsxs("div", { className: "flex items-center justify-between gap-2 text-sm", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx(DirectionIcon, { direction: tx.direction }), _jsx("span", { className: "capitalize", children: tx.direction ?? "-" })] }), _jsx("div", { className: "font-medium", children: amount })] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 text-xs text-muted-foreground", children: [_jsx(TypeBadge, { tx: tx }), _jsx(AssetBadge, { tx: tx })] }), _jsxs("div", { className: "space-y-1 text-xs text-muted-foreground", children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { children: "Counterparty" }), _jsx("span", { className: "font-mono text-right", children: counterparty })] }), _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { children: "Network" }), _jsx("span", { className: "text-right", children: getNetworkLabel(tx.networkId) })] }), _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { children: "Time" }), _jsx("span", { className: "text-right", children: ts ? formatTimestamp(ts) : "-" })] })] })] }, tx.id ?? tx.transactionHash));
                                    }) }), _jsx("div", { className: "hidden sm:block", children: _jsxs(Table, { className: "table-fixed", children: [_jsx(TableHeader, { children: _jsxs(TableRow, { children: [_jsx(SortableHead, { label: "Hash", column: "hash" }), _jsx(SortableHead, { label: "Direction", column: "direction" }), _jsx(SortableHead, { label: "Status", column: "status" }), _jsx(SortableHead, { label: "Type", column: "type" }), _jsx(SortableHead, { label: "Asset", column: "asset" }), _jsx(SortableHead, { label: "To/From", column: "counterparty" }), _jsx(SortableHead, { label: "Amount", column: "amount", align: "right", className: "text-right" }), _jsx(SortableHead, { label: "Network", column: "network" }), _jsx(SortableHead, { label: "Time", column: "time" })] }) }), _jsx(TableBody, { children: sortedRows.map((tx) => {
                                                    const rowKey = tx?.id && String(tx.id).trim().length > 0
                                                        ? String(tx.id)
                                                        : tx?.transactionHash && String(tx.transactionHash).trim().length > 0
                                                            ? String(tx.transactionHash).toLowerCase()
                                                            : "";
                                                    const isRowHighlighted = rowKey
                                                        ? (highlightedRows[rowKey] ?? 0) > Date.now()
                                                        : false;
                                                    return (_jsxs(TableRow, { className: isRowHighlighted
                                                            ? "bg-emerald-50/70 transition-colors"
                                                            : "transition-colors", children: [_jsx(TableCell, { className: "font-mono text-xs", children: tx.transactionHash ? ((() => {
                                                                    const url = getExplorerTxUrl(tx.networkId, tx.transactionHash);
                                                                    if (!url)
                                                                        return _jsx("span", { children: truncateHash(tx.transactionHash) });
                                                                    return (_jsxs("a", { href: url, target: "_blank", rel: "noopener noreferrer", className: "flex items-center gap-1 hover:text-primary", children: [truncateHash(tx.transactionHash), _jsx(ExternalLink, { className: "h-3 w-3" })] }));
                                                                })()) : (_jsx("span", { className: "text-muted-foreground", children: "Pending" })) }), _jsx(TableCell, { className: "text-center", children: _jsxs("div", { className: "flex items-center justify-center gap-1.5", children: [_jsx(DirectionIcon, { direction: tx.direction }), _jsx("span", { className: "capitalize text-sm", children: tx.direction ?? "-" })] }) }), _jsx(TableCell, { children: _jsx(StatusBadge, { tx: tx }) }), _jsx(TableCell, { children: _jsx(TypeBadge, { tx: tx }) }), _jsx(TableCell, { children: _jsx(AssetBadge, { tx: tx }) }), _jsx(TableCell, { className: "font-mono text-xs", children: _jsx(CounterpartyCell, { tx: tx }) }), _jsxs(TableCell, { className: "text-right", children: [_jsx("div", { className: "font-medium", children: Array.isArray(tx.movements) && tx.movements.length > 0 ? ((() => {
                                                                            const m = tx.movements[0];
                                                                            return (_jsxs("div", { className: "flex items-center justify-end gap-2", children: [_jsx("span", { children: formatAmount(m) }), tx.movements.length > 1 ? (_jsxs("span", { className: "text-xs text-muted-foreground", children: ["+", tx.movements.length - 1, " more"] })) : null] }));
                                                                        })()) : (formatAmount(tx)) }), !(Array.isArray(tx.movements) && tx.movements.length > 0) && tx.contract && (_jsx("div", { className: "text-xs text-muted-foreground", children: getTokenSymbol(tx.contract) ?? truncateIdentifier(tx.contract) }))] }), _jsx(TableCell, { className: "text-sm", children: getNetworkLabel(tx.networkId) }), _jsx(TableCell, { className: "text-sm text-muted-foreground", children: (() => {
                                                                    const ts = getEffectiveTimestamp(tx);
                                                                    return ts ? formatTimestamp(ts) : "-";
                                                                })() })] }, tx.id ?? tx.transactionHash));
                                                }) })] }) })] })), _jsxs("div", { className: "flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { className: "text-sm text-muted-foreground", children: [rangeLabel, " | Page ", currentPage, !isEventsView ? ` of ${totalPages}` : ""] }), _jsxs("div", { className: "flex flex-wrap items-center gap-2 sm:justify-end", children: [_jsx(Select, { value: String(rowsPerPage), onChange: (e) => {
                                                const next = Number(e.target.value || rowsPerPage);
                                                setRowsPerPage(next);
                                                setPage(1);
                                            }, className: "h-8 w-[110px] py-0 text-xs", children: [10, 20, 50, 100].map((n) => (_jsxs("option", { value: String(n), children: [n, " / page"] }, n))) }), _jsxs(Button, { variant: "outline", size: "sm", onClick: handleFirstPage, disabled: !canGoPrev, children: [_jsx(ChevronsLeft, { className: "h-4 w-4" }), "First"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: handlePrevPage, disabled: !canGoPrev, children: [_jsx(ChevronLeft, { className: "h-4 w-4" }), "Prev"] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: handleNextPage, disabled: !canGoNext, children: ["Next", _jsx(ChevronRight, { className: "h-4 w-4" })] }), _jsxs(Button, { variant: "outline", size: "sm", onClick: handleLastPage, disabled: !canGoLast, children: ["Last", _jsx(ChevronsRight, { className: "h-4 w-4" })] })] })] })] })] }) }));
}
