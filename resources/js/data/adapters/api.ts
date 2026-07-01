// REST API アダプター（Laravel + SQLite バックエンド）。
// /api/{customers,sender-profiles,quotes} の apiResource を呼ぶ。
import type { BackupPayload, Customer as TCustomer, EntityAdapter, ID, ImportResponse, Quote as TQuote, RestoreResult, SenderProfile as TSenderProfile } from '../../types';

export interface ApiError extends Error {
  status?: number;
  errors?: Record<string, string[]>;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return true as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message || `リクエストに失敗しました (${res.status})`;
    const err = new Error(message) as ApiError;
    err.status = res.status;
    err.errors = data?.errors;
    throw err;
  }
  return data as T;
}

function clientSort<T extends Record<string, unknown>>(rows: T[], sort?: string): T[] {
  if (!sort) return rows;
  const desc = sort.startsWith('-');
  const field = desc ? sort.slice(1) : sort;
  return [...rows].sort((a, b) => {
    const av = (a[field] ?? '') as string | number;
    const bv = (b[field] ?? '') as string | number;
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

function makeEntity<T extends { id: ID }>(path: string): EntityAdapter<T> {
  const base = `/api/${path}`;
  return {
    async list(sort?: string) {
      const rows = await request<T[]>('GET', base);
      return clientSort(rows as Array<T & Record<string, unknown>>, sort);
    },
    get: (id: ID) => request<T | null>('GET', `${base}/${id}`),
    create: (data: Partial<T>) => request<T>('POST', base, data),
    update: (id: ID, data: Partial<T>) => request<T | null>('PUT', `${base}/${id}`, data),
    delete: (id: ID) => request<boolean>('DELETE', `${base}/${id}`),
  };
}

export const Quote: EntityAdapter<TQuote> = makeEntity<TQuote>('quotes');
export const Customer: EntityAdapter<TCustomer> = makeEntity<TCustomer>('customers');
export const SenderProfile: EntityAdapter<TSenderProfile> = makeEntity<TSenderProfile>('sender-profiles');

// 御見積書ファイル（複数可）を multipart/form-data で取り込む。
// FormData は request() を通さない: JSON 化や手動 Content-Type 付与は
// multipart の boundary を壊すため、ブラウザに任せて素の fetch を使う。
export async function importQuotes(files: File[]): Promise<ImportResponse> {
  const form = new FormData();
  for (const file of files) form.append('files[]', file);

  const res = await fetch('/api/quotes/import', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message || `取込に失敗しました (${res.status})`;
    const err = new Error(message) as ApiError;
    err.status = res.status;
    err.errors = data?.errors;
    throw err;
  }
  return data as ImportResponse;
}

// バックアップ: 3テーブルを JSON で返す（ファイル化はフロントが担う）
export function downloadBackup(): Promise<BackupPayload> {
  return request<BackupPayload>('GET', '/api/backup/download');
}

// リストア: multipart で JSON ファイルと mode を送信する
export async function restoreBackup(file: File, mode: 'skip' | 'overwrite'): Promise<RestoreResult> {
  const form = new FormData();
  form.append('file', file);
  form.append('mode', mode);

  const res = await fetch('/api/backup/restore', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = data?.message || `リストアに失敗しました (${res.status})`;
    const err = new Error(message) as ApiError;
    err.status = res.status;
    err.errors = data?.errors;
    throw err;
  }
  return data as RestoreResult;
}

// API モードではサーバー（DemoSeeder）がデータを投入するため no-op
export function seedIfEmpty(): void {}
