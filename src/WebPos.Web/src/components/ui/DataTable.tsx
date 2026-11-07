import React, { useState } from 'react';
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type ColumnDef, type SortingState, type VisibilityState,
} from '@tanstack/react-table';
import {
  ArrowDown, ArrowUp, ArrowUpDown, Columns, Download,
  FileSpreadsheet, Search, AlertCircle, Inbox,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { t } from '../../i18n';
import { Button } from './Button';

export interface DataTableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData>[];
  searchPlaceholder?: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyAction?: React.ReactNode;
  exportFileName?: string;
  toolbarExtras?: React.ReactNode;
  onRowClick?: (row: TData) => void;
  pageSize?: number;
}

export function DataTable<TData>({
  data,
  columns,
  searchPlaceholder,
  isLoading = false,
  error = null,
  onRetry,
  emptyAction,
  exportFileName = 'webpos-export',
  toolbarExtras,
  onRowClick,
  pageSize = 15,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter, columnVisibility },
    initialState: { pagination: { pageSize } },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const handleExportCsv = () => {
    const visibleCols = table.getVisibleLeafColumns();
    const headerRow = visibleCols
      .map((col) => {
        const hdr = col.columnDef.header;
        return typeof hdr === 'string' ? `"${hdr}"` : `"${col.id}"`;
      })
      .join(';');
    const rows = table.getFilteredRowModel().rows.map((row) =>
      visibleCols
        .map((col) => {
          const val = row.getValue(col.id);
          const str = val === null || val === undefined ? '' : String(val);
          return `"${str.replace(/"/g, '""')}"`;
        })
        .join(';')
    );
    const blob = new Blob([`\uFEFF${[headerRow, ...rows].join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${exportFileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/40 bg-card p-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive mb-2" />
        <p className="text-sm font-semibold text-foreground">{t('common.errorTitle')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="mt-4">
            {t('common.retry')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder={searchPlaceholder ?? t('common.search')}
            className="flex h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {toolbarExtras}
          <div className="relative">
            <Button variant="outline" size="sm" onClick={() => setShowColumnMenu((p) => !p)}>
              <Columns className="h-3.5 w-3.5" />
              <span>{t('common.columns')}</span>
            </Button>
            {showColumnMenu && (
              <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-md border border-border bg-popover p-2 shadow-md">
                {table.getAllLeafColumns().map((column) => {
                  const hdr = column.columnDef.header;
                  return (
                    <label
                      key={column.id}
                      className="flex items-center gap-2 rounded-sm px-2 py-1 text-xs text-popover-foreground hover:bg-accent cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={column.getIsVisible()}
                        onChange={column.getToggleVisibilityHandler()}
                        className="rounded border-input"
                      />
                      <span className="truncate">{typeof hdr === 'string' ? hdr : column.id}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-3.5 w-3.5" />
            <span>{t('common.exportCsv')}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span>{t('common.exportExcel')}</span>
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
        <table className="w-full border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-muted/80 backdrop-blur-xs border-b border-border text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={cn(
                        'px-3 py-2.5 font-semibold whitespace-nowrap select-none',
                        canSort && 'cursor-pointer hover:text-foreground'
                      )}
                    >
                      <div className="inline-flex items-center gap-1">
                        {!header.isPlaceholder && flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span className="text-muted-foreground">
                            {sorted === 'asc' ? <ArrowUp className="h-3 w-3" /> : sorted === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  {table.getVisibleLeafColumns().map((col) => (
                    <td key={col.id} className="px-3 py-2.5">
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={table.getVisibleLeafColumns().length || 1} className="px-4 py-10 text-center">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <Inbox className="h-7 w-7 text-muted-foreground" />
                    <p className="text-xs font-semibold text-foreground">{t('common.noResults')}</p>
                    <p className="text-xs text-muted-foreground">{t('common.noResultsDesc')}</p>
                    {emptyAction && <div className="mt-2">{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn('transition-colors hover:bg-muted/50', onRowClick && 'cursor-pointer')}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 align-middle text-foreground">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{t('common.totalRecords', { count: table.getFilteredRowModel().rows.length })}</span>
        <div className="flex items-center gap-2">
          <span>
            {t('common.pageOf', {
              page: table.getState().pagination.pageIndex + 1,
              total: Math.max(1, table.getPageCount()),
            })}
          </span>
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            {t('common.previous')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            {t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
