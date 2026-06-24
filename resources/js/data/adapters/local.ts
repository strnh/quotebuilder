// localStorage アダプター（オフライン/デモ/テスト用）。
// API を使わずブラウザ内で完結する。e2e はこのアダプターで分離性を確保する。
import type { Customer as TCustomer, EntityAdapter, ID, ImportResponse, ImportResult, LineItem, Quote as TQuote, SenderProfile as TSenderProfile } from '../../types';

const NS = 'quotes';

function read<T>(key: string): T[] {
  try {
    return (JSON.parse(localStorage.getItem(`${NS}:${key}`) ?? 'null') as T[]) ?? [];
  } catch {
    return [];
  }
}
function write<T>(key: string, rows: T[]): void {
  localStorage.setItem(`${NS}:${key}`, JSON.stringify(rows));
}
function uid(): string {
  return 'id_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}
function nowISO(): string {
  return new Date().toISOString();
}

function makeEntity<T extends { id: ID } & Record<string, unknown>>(key: string): EntityAdapter<T> {
  return {
    async list(sort?: string) {
      let rows = read<T>(key);
      if (sort) {
        const desc = sort.startsWith('-');
        const field = desc ? sort.slice(1) : sort;
        rows = [...rows].sort((a, b) => {
          const av = (a[field] ?? '') as string | number;
          const bv = (b[field] ?? '') as string | number;
          if (av < bv) return desc ? 1 : -1;
          if (av > bv) return desc ? -1 : 1;
          return 0;
        });
      }
      return rows;
    },
    async get(id: ID) {
      return read<T>(key).find((r) => String(r.id) === String(id)) ?? null;
    },
    async create(data: Partial<T>) {
      const rows = read<T>(key);
      const row = { id: uid(), created_date: (data.created_date as string) ?? nowISO(), ...data } as unknown as T;
      rows.push(row);
      write(key, rows);
      return row;
    },
    async update(id: ID, data: Partial<T>) {
      const rows = read<T>(key);
      const idx = rows.findIndex((r) => String(r.id) === String(id));
      if (idx === -1) return null;
      rows[idx] = { ...rows[idx], ...data };
      write(key, rows);
      return rows[idx];
    },
    async delete(id: ID) {
      write(key, read<T>(key).filter((r) => String(r.id) !== String(id)));
      return true;
    },
  };
}

export const Quote: EntityAdapter<TQuote> = makeEntity<TQuote & Record<string, unknown>>('quotes');
export const Customer: EntityAdapter<TCustomer> = makeEntity<TCustomer & Record<string, unknown>>('customers');
export const SenderProfile: EntityAdapter<TSenderProfile> = makeEntity<TSenderProfile & Record<string, unknown>>('sender_profiles');

// 基本情報マスタのデフォルト切替を local 側でも整合させる
const _spCreate = SenderProfile.create.bind(SenderProfile);
const _spUpdate = SenderProfile.update.bind(SenderProfile);
function singleDefault(row: TSenderProfile | null): void {
  if (!row?.is_default) return;
  const rows = read<TSenderProfile>('sender_profiles').map((r) => ({
    ...r,
    is_default: String(r.id) === String(row.id),
  }));
  write('sender_profiles', rows);
}
SenderProfile.create = async (data) => {
  const r = await _spCreate(data);
  singleDefault(r);
  return r;
};
SenderProfile.update = async (id, data) => {
  const r = await _spUpdate(id, data);
  singleDefault(r);
  return r;
};

// 取込のモック。シート解析はサーバー専用機能のため、local では実ファイルを
// 解析せず、ファイル名から下書き Quote を 1 件生成して API と同形状の結果を返す。
// （API モードでの取込結果プレビューと同じ UI を e2e/デモで検証できるようにする）
const SHEET_EXTS = ['xlsx', 'ods'];

export async function importQuotes(files: File[]): Promise<ImportResponse> {
  const results: ImportResult[] = [];
  for (const file of files) {
    const name = file.name;
    const ext = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
    if (!SHEET_EXTS.includes(ext)) {
      results.push({ filename: name, error: `${ext || '不明な拡張子'} は未対応です（xlsx / ods のみ取込可能）` });
      continue;
    }
    const quote = await Quote.create({
      quote_number: name.slice(0, name.lastIndexOf('.')),
      subject: '',
      status: 'draft',
      tax_rate: 10,
      items: [],
      customer_id: '',
    } as Partial<TQuote>);
    results.push({
      filename: name,
      quote_id: quote.id,
      customer_id: null,
      customer_matched: false,
      warnings: ['ローカルモードのモック取込: シート内容は解析されません（下書きとして保存）'],
    });
  }
  return { created: results.filter((r) => r.quote_id != null).length, results };
}

type SeedItem = Omit<LineItem, 'total'>;

export function seedIfEmpty(): void {
  if (localStorage.getItem(`${NS}:seeded`)) return;
  const year = new Date().getFullYear();

  const sender: TSenderProfile = {
    id: uid(), sender_company: '株式会社ゼンセールス', sender_zip: '150-0002', sender_pref: '東京都',
    sender_city: '渋谷区', sender_address1: '渋谷2-1-1', sender_address2: 'ゼンビル 8F',
    sender_person: '山田 太郎', sender_tel: '03-1234-5678', sender_fax: '03-1234-5679',
    sender_logo_url: '', is_default: true, created_date: nowISO(),
  };
  write('sender_profiles', [sender]);

  const customers: TCustomer[] = [
    { id: uid(), customer_name: '株式会社アルファ商事', customer_signature: 'ALPHA', customer_department: '購買部', customer_person: '田中 花子',
      customer_zip: '100-0005', customer_pref: '東京都', customer_city: '千代田区', customer_address1: '丸の内1-1-1',
      customer_address2: '', customer_tel: '03-9876-5432', created_date: nowISO() },
    { id: uid(), customer_name: 'ベータ工業株式会社', customer_signature: 'BETA', customer_department: '資材課', customer_person: '佐藤 一郎',
      customer_zip: '220-0011', customer_pref: '神奈川県', customer_city: '横浜市西区', customer_address1: 'みなとみらい3-2-1',
      customer_address2: '', customer_tel: '045-111-2222', created_date: nowISO() },
  ];
  write('customers', customers);

  const senderKeys = ['sender_company', 'sender_zip', 'sender_pref', 'sender_city', 'sender_address1', 'sender_address2', 'sender_person', 'sender_tel', 'sender_fax', 'sender_logo_url'] as const;
  const customerKeys = ['customer_name', 'customer_department', 'customer_person', 'customer_zip', 'customer_pref', 'customer_city', 'customer_address1', 'customer_address2', 'customer_tel'] as const;

  const senderSnap = Object.fromEntries(senderKeys.map((k) => [k, sender[k]]));
  const custSnap = (c: TCustomer) => Object.fromEntries(customerKeys.map((k) => [k, c[k]]));
  const mkItems = (rows: SeedItem[]): LineItem[] => rows.map((r) => ({ ...r, total: r.quantity * r.unit_price }));
  const withTotals = (q: Record<string, unknown> & { items: LineItem[]; tax_rate: number }) => {
    const subtotal = q.items.reduce((s, it) => s + it.total, 0);
    const tax = Math.floor((subtotal * q.tax_rate) / 100);
    return { ...q, tax_amount: tax, total_amount: subtotal + tax } as unknown as TQuote;
  };

  const quotes: TQuote[] = [
    withTotals({ id: uid(), quote_number: `Q-${year}06-001`, subject: 'Webシステム開発一式', status: 'accepted',
      created_date: `${year}-06-02`, valid_until: `${year}-06-30`, valid_period: 'お見積り日から１０日以内',
      delivery_location: 'ご指定場所', delivery_date: `${year}/09/30`, payment_terms: '月末締め翌月末払い',
      tax_rate: 10, notes: 'ご不明な点はお気軽にお問い合わせください。', ...senderSnap, ...custSnap(customers[0]),
      items: mkItems([
        { name: '要件定義', spec: '一式', quantity: 1, unit: '式', standard_price: 600000, unit_price: 500000 },
        { name: '設計・開発', spec: 'フロント/バック', quantity: 1, unit: '式', standard_price: 1500000, unit_price: 1300000 },
        { name: '保守サポート', spec: '12ヶ月', quantity: 12, unit: 'ヶ月', standard_price: 50000, unit_price: 40000 },
      ]) }),
    withTotals({ id: uid(), quote_number: `Q-${year}06-002`, subject: '事務用品定期納入', status: 'sent',
      created_date: `${year}-06-15`, valid_until: `${year}-07-15`, valid_period: 'お見積り日から１０日以内',
      delivery_location: 'ご指定場所', delivery_date: `${year}/07/01`, payment_terms: '月末締め翌月末払い',
      tax_rate: 10, notes: '', ...senderSnap, ...custSnap(customers[1]),
      items: mkItems([
        { name: 'コピー用紙', spec: 'A4 500枚', quantity: 50, unit: '冊', standard_price: 500, unit_price: 420 },
        { name: 'トナーカートリッジ', spec: '純正', quantity: 10, unit: '本', standard_price: 12000, unit_price: 9800 },
      ]) }),
    withTotals({ id: uid(), quote_number: `Q-${year}06-003`, subject: '展示会ブース設営', status: 'draft',
      created_date: `${year}-06-20`, valid_until: '', valid_period: 'お見積り日から１０日以内',
      delivery_location: 'ご指定場所', delivery_date: '', payment_terms: '', tax_rate: 10, notes: '',
      ...senderSnap, ...custSnap(customers[0]),
      items: mkItems([{ name: 'ブース設計', spec: '3x3 区画', quantity: 1, unit: '式', standard_price: 300000, unit_price: 280000 }]) }),
  ];
  write('quotes', quotes);
  localStorage.setItem(`${NS}:seeded`, '1');
}
