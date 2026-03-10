import { jsx as _jsx } from "react/jsx-runtime";
import * as React from "react";
import { cn } from "../../utils.js";
/**
 * Table container with horizontal scrolling and vertical overflow visibility.
 *
 * @remarks
 * Purpose:
 * - Wraps a table to allow horizontal scrolling while keeping tooltips/popovers visible above/below rows.
 *
 * When to use:
 * - Use for tabular data that may overflow horizontally.
 *
 * When not to use:
 * - Do not use for layout-only grids; use flex or CSS grid instead.
 *
 * Parameters:
 * - `className`: Optional table class names (string, appended).
 * - `props`: Native table attributes (nullable where React allows).
 * - `ref`: Forwarded to the underlying <table> element.
 *
 * Return semantics:
 * - Renders a scroll container + table; returns a React element.
 *
 * Errors/failure modes:
 * - None (does not throw).
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Container uses `overflow-x-auto` and `overflow-y-visible`.
 * - Children are valid table sections/rows.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Safe to render in SSR; interactive behavior requires client event handlers.
 *
 * @example
 * <Table><TableHeader>...</TableHeader><TableBody>...</TableBody></Table>
 */
const Table = React.forwardRef(({ className, ...props }, ref) => (_jsx("div", { className: "relative w-full overflow-x-auto overflow-y-visible", children: _jsx("table", { ref: ref, className: cn("w-full caption-bottom text-sm", className), ...props }) })));
Table.displayName = "Table";
/**
 * Table header section wrapper.
 *
 * @remarks
 * Purpose:
 * - Provide consistent styling for table headers.
 *
 * When to use:
 * - Use as the <thead> container inside {@link Table}.
 *
 * When not to use:
 * - Do not use outside a table structure.
 *
 * Parameters:
 * - `props`: React HTML table section attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <thead> element.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Applies border styling to header rows.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Safe to render in SSR.
 */
const TableHeader = React.forwardRef(({ className, ...props }, ref) => (_jsx("thead", { ref: ref, className: cn("[&_tr]:border-b", className), ...props })));
TableHeader.displayName = "TableHeader";
/**
 * Table body section wrapper.
 *
 * @remarks
 * Purpose:
 * - Provide consistent styling for table body rows.
 *
 * When to use:
 * - Use as the <tbody> container inside {@link Table}.
 *
 * When not to use:
 * - Do not use outside a table structure.
 *
 * Parameters:
 * - `props`: React HTML table section attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <tbody> element.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Removes border on the last row.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Safe to render in SSR.
 */
const TableBody = React.forwardRef(({ className, ...props }, ref) => (_jsx("tbody", { ref: ref, className: cn("[&_tr:last-child]:border-0", className), ...props })));
TableBody.displayName = "TableBody";
/**
 * Table footer section wrapper.
 *
 * @remarks
 * Purpose:
 * - Provide consistent styling for footer rows.
 *
 * When to use:
 * - Use as the <tfoot> container inside {@link Table}.
 *
 * When not to use:
 * - Do not use outside a table structure.
 *
 * Parameters:
 * - `props`: React HTML table section attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <tfoot> element.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Applies muted background styling and border rules.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Safe to render in SSR.
 */
const TableFooter = React.forwardRef(({ className, ...props }, ref) => (_jsx("tfoot", { ref: ref, className: cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className), ...props })));
TableFooter.displayName = "TableFooter";
/**
 * Table row component with hover styling.
 *
 * @remarks
 * Purpose:
 * - Provide consistent row borders and hover states.
 *
 * When to use:
 * - Use inside {@link TableBody} or {@link TableHeader}.
 *
 * When not to use:
 * - Do not use outside a table structure.
 *
 * Parameters:
 * - `props`: React HTML table row attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <tr> element.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Adds hover state styling for row highlighting.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Safe to render in SSR.
 */
const TableRow = React.forwardRef(({ className, ...props }, ref) => (_jsx("tr", { ref: ref, className: cn("border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted", className), ...props })));
TableRow.displayName = "TableRow";
/**
 * Table header cell component.
 *
 * @remarks
 * Purpose:
 * - Provide consistent typography and spacing for header cells.
 *
 * When to use:
 * - Use inside {@link TableHeader} rows.
 *
 * When not to use:
 * - Do not use for body cells; use {@link TableCell}.
 *
 * Parameters:
 * - `props`: React table header cell attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <th> element.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Uses muted text styling and consistent padding.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Safe to render in SSR.
 */
const TableHead = React.forwardRef(({ className, ...props }, ref) => (_jsx("th", { ref: ref, className: cn("h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className), ...props })));
TableHead.displayName = "TableHead";
/**
 * Table body cell component.
 *
 * @remarks
 * Purpose:
 * - Provide consistent spacing for data cells.
 *
 * When to use:
 * - Use inside {@link TableBody} rows.
 *
 * When not to use:
 * - Do not use for header cells; use {@link TableHead}.
 *
 * Parameters:
 * - `props`: React table data cell attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <td> element.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Provides consistent padding and alignment.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Safe to render in SSR.
 */
const TableCell = React.forwardRef(({ className, ...props }, ref) => (_jsx("td", { ref: ref, className: cn("p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]", className), ...props })));
TableCell.displayName = "TableCell";
/**
 * Table caption component for supplementary context.
 *
 * @remarks
 * Purpose:
 * - Provide explanatory or summary text for a table.
 *
 * When to use:
 * - Use below the table to describe its contents or data range.
 *
 * When not to use:
 * - Do not use for primary titles; use a heading above the table.
 *
 * Parameters:
 * - `props`: React table caption attributes. Nullable: per React types.
 * - `ref`: Forwards to the underlying <caption> element.
 *
 * Return semantics:
 * - Returns a React element.
 *
 * Errors/failure modes:
 * - None.
 *
 * Side effects:
 * - None.
 *
 * Invariants/assumptions:
 * - Uses muted text styling and spacing.
 *
 * Data/auth references:
 * - None.
 *
 * Runtime constraints:
 * - Safe to render in SSR.
 */
const TableCaption = React.forwardRef(({ className, ...props }, ref) => (_jsx("caption", { ref: ref, className: cn("mt-4 text-sm text-muted-foreground", className), ...props })));
TableCaption.displayName = "TableCaption";
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption, };
