// ZenSales ドメイン型定義

export type ID = string | number;

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected';

export interface LineItem {
  name: string;
  spec: string;
  quantity: number;
  unit: string;
  standard_price: number;
  unit_price: number;
  total: number;
}

export interface Customer {
  id: ID;
  customer_name: string;
  signatures: string[];
  customer_department?: string;
  customer_person?: string;
  customer_zip?: string;
  customer_pref?: string;
  customer_city?: string;
  customer_address1?: string;
  customer_address2?: string;
  customer_tel?: string;
  created_date?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SenderProfile {
  id: ID;
  sender_company: string;
  sender_zip?: string;
  sender_pref?: string;
  sender_city?: string;
  sender_address1?: string;
  sender_address2?: string;
  sender_person?: string;
  sender_tel?: string;
  sender_fax?: string;
  sender_logo_url?: string;
  is_default: boolean;
  created_date?: string;
  created_at?: string;
  updated_at?: string;
}

// 発行者スナップショット（Quote に埋め込む）
export interface SenderSnapshot {
  sender_company: string;
  sender_zip: string;
  sender_pref: string;
  sender_city: string;
  sender_address1: string;
  sender_address2: string;
  sender_person: string;
  sender_tel: string;
  sender_fax: string;
  sender_logo_url: string;
}

// 取引先スナップショット（Quote に埋め込む）
export interface CustomerSnapshot {
  customer_name: string;
  customer_department: string;
  customer_person: string;
  customer_zip: string;
  customer_pref: string;
  customer_city: string;
  customer_address1: string;
  customer_address2: string;
  customer_tel: string;
}

export interface Quote extends SenderSnapshot, CustomerSnapshot {
  id: ID;
  quote_number: string;
  subject: string;
  status: QuoteStatus;
  created_date: string;
  valid_until: string;
  valid_period: string;
  delivery_location: string;
  delivery_date: string;
  payment_terms: string;
  tax_rate: number;
  notes: string;
  sender_profile_id: ID | '';
  customer_id: ID | '';
  items: LineItem[];
  total_amount?: number;
  tax_amount?: number;
  created_at?: string;
  updated_at?: string;
}

// 取込結果（1 ファイル単位）。成功と失敗を判別可能なユニオンで表し、
// 「quote_id も error も無い」中間状態を型レベルで排除する。
export interface ImportSuccess {
  filename: string;
  quote_id: ID;
  customer_id: ID | null;
  customer_matched: boolean;
  warnings: string[];
}
export interface ImportFailure {
  filename: string;
  error: string;
}
export type ImportResult = ImportSuccess | ImportFailure;

// 取込レスポンス（POST /api/quotes/import）
export interface ImportResponse {
  created: number;
  results: ImportResult[];
}

// エンティティ共通の CRUD アダプターインターフェース
export interface EntityAdapter<T extends { id: ID }> {
  list(sort?: string): Promise<T[]>;
  get(id: ID): Promise<T | null>;
  create(data: Partial<T>): Promise<T>;
  update(id: ID, data: Partial<T>): Promise<T | null>;
  delete(id: ID): Promise<boolean>;
}

// バックアップ・リストア
export interface BackupPayload {
  version: number;
  exported_at: string;
  sender_profiles: SenderProfile[];
  customers: Customer[];
  customer_signatures: { id: ID; customer_id: ID; signature: string }[];
  quotes: Quote[];
}

export interface RestoreResult {
  inserted: number;
  skipped: number;
  updated: number;
  errors: string[];
}

// 認証セッション
export interface AuthUser {
  id: string;
  email: string;
  full_name: string;
}
