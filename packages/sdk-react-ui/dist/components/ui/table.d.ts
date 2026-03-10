import * as React from "react";
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
declare const Table: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLTableElement> & React.RefAttributes<HTMLTableElement>>;
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
declare const TableHeader: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLTableSectionElement> & React.RefAttributes<HTMLTableSectionElement>>;
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
declare const TableBody: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLTableSectionElement> & React.RefAttributes<HTMLTableSectionElement>>;
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
declare const TableFooter: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLTableSectionElement> & React.RefAttributes<HTMLTableSectionElement>>;
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
declare const TableRow: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLTableRowElement> & React.RefAttributes<HTMLTableRowElement>>;
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
declare const TableHead: React.ForwardRefExoticComponent<React.ThHTMLAttributes<HTMLTableCellElement> & React.RefAttributes<HTMLTableCellElement>>;
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
declare const TableCell: React.ForwardRefExoticComponent<React.TdHTMLAttributes<HTMLTableCellElement> & React.RefAttributes<HTMLTableCellElement>>;
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
declare const TableCaption: React.ForwardRefExoticComponent<React.HTMLAttributes<HTMLTableCaptionElement> & React.RefAttributes<HTMLTableCaptionElement>>;
export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption, };
