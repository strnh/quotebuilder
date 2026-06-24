// 見積もり計算ロジック（オリジナルと同一）
// subtotal = Σ item.total
// tax      = floor(subtotal * tax_rate / 100)
// total    = subtotal + tax
import type { LineItem, Quote } from '../types';

export function lineTotal(item: Pick<LineItem, 'quantity' | 'unit_price'>): number {
  return Number(item.quantity || 0) * Number(item.unit_price || 0);
}

export interface QuoteTotals {
  subtotal: number;
  taxRate: number;
  tax: number;
  total: number;
}

export function quoteTotals(quote: Pick<Quote, 'items' | 'tax_rate'> | null | undefined): QuoteTotals {
  const items = quote?.items || [];
  const subtotal = items.reduce((sum, it) => sum + Number(it.total || 0), 0);
  const taxRate = Number(quote?.tax_rate ?? 10);
  const tax = Math.floor((subtotal * taxRate) / 100);
  const total = subtotal + tax;
  return { subtotal, taxRate, tax, total };
}

export const EMPTY_LINE_ITEM: LineItem = {
  name: '',
  spec: '',
  quantity: 1,
  unit: '',
  standard_price: 0,
  unit_price: 0,
  total: 0,
};
