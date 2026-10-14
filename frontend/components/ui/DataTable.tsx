'use client';

import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';
import { NARROW, useMediaQuery } from '@/lib/hooks/useMediaQuery';

/**
 * A table on wide screens; below 768 px every row becomes a card (H-07): the title and the badge on top, the body in
 * the middle, the secondary data below and the action at the end. Each column says where it goes on the card.
 */
export function DataTable<Row>({ caption, columns, rows, rowKey, framed = true, className }: DataTableProps<Row>) {
  const narrow = useMediaQuery(NARROW);

  if (narrow) return <CardList columns={columns} rowKey={rowKey} rows={rows} className={className} label={caption} />;

  return (
    <div className={cn(framed && 'rounded-card bg-surface shadow-rest', 'overflow-x-auto', className)}>
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className={cn(framed ? 'bg-surface-sunk/60' : 'border-b border-line')}>
            {columns.map((column) => (
              <th className={cn('text-label whitespace-nowrap px-4 py-3 first:pl-5 last:pr-5', column.align === 'end' && 'text-right', column.headerClassName)} key={column.key} scope="col">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr className="border-t border-line transition-colors first:border-t-0 hover:bg-primary-soft/40" key={rowKey(row)}>
              {columns.map((column) => (
                <td className={cn('px-4 py-3.5 align-middle first:pl-5 last:pr-5', column.align === 'end' && 'text-right', column.className)} key={column.key}>
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardList<Row>({ columns, rows, rowKey, className, label }: Omit<DataTableProps<Row>, 'caption' | 'framed'> & { label: string }) {
  const place = (row: Row, slot: MobileSlot) =>
    columns.filter((column) => (column.mobile ?? 'meta') === slot).map((column) => <span key={column.key}>{column.cell(row)}</span>);

  return (
    <ul aria-label={label} className={cn('flex flex-col gap-3', className)}>
      {rows.map((row) => (
        <li className="rounded-card bg-surface p-4 shadow-rest" key={rowKey(row)}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 font-mono text-[13px] font-medium text-primary-text">{place(row, 'title')}</div>
            <div className="shrink-0">{place(row, 'badge')}</div>
          </div>
          <div className="mt-1.5 text-[15px] font-semibold text-ink">{place(row, 'body')}</div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-ink-3">{place(row, 'meta')}</div>
          {columns.some((column) => column.mobile === 'action') ? <div className="mt-3 flex flex-wrap gap-2">{place(row, 'action')}</div> : null}
        </li>
      ))}
    </ul>
  );
}

type MobileSlot = 'title' | 'badge' | 'body' | 'meta' | 'action' | 'hidden';

export interface Column<Row> {
  key: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  /** Where the column goes on the narrow-screen card; `meta` when omitted. */
  mobile?: MobileSlot;
  align?: 'start' | 'end';
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<Row> {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string | number;
  /** Framed lists stand alone; unframed tables live inside a card. */
  framed?: boolean;
  className?: string;
}
