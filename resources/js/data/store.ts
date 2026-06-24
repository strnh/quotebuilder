// データアクセス層。アダプターを切り替えて使う。
//   - 'api'   : Laravel + SQLite バックエンド（既定）
//   - 'local' : localStorage 完結（オフライン/デモ/e2e テスト用）
// 切替: localStorage.setItem('zensales:adapter', 'local')
import * as apiAdapter from './adapters/api';
import * as localAdapter from './adapters/local';
import type { Customer as TCustomer, EntityAdapter, Quote as TQuote, SenderProfile as TSenderProfile } from '../types';

type Adapter = {
  Quote: EntityAdapter<TQuote>;
  Customer: EntityAdapter<TCustomer>;
  SenderProfile: EntityAdapter<TSenderProfile>;
  seedIfEmpty: () => void;
};

function pick(): Adapter {
  try {
    return localStorage.getItem('zensales:adapter') === 'local' ? localAdapter : apiAdapter;
  } catch {
    return apiAdapter;
  }
}

const adapter = pick();

export const Quote = adapter.Quote;
export const Customer = adapter.Customer;
export const SenderProfile = adapter.SenderProfile;
export const seedIfEmpty = adapter.seedIfEmpty;

// 見積番号の自動採番: Q-YYYYMM-### (当月連番)
export async function nextQuoteNumber(): Promise<string> {
  const rows = await Quote.list();
  const d = new Date();
  const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const prefix = `Q-${ym}-`;
  const seq = rows
    .map((r) => r.quote_number)
    .filter((n): n is string => typeof n === 'string' && n.startsWith(prefix))
    .map((n) => parseInt(n.slice(prefix.length), 10) || 0);
  const next = (seq.length ? Math.max(...seq) : 0) + 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
}
