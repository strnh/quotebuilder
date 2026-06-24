// 日本語フォーマットユーティリティ
import type { QuoteStatus } from '../types';

export const PREFECTURES: string[] = [
  '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
  '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
  '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
  '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
];

export interface StatusOption {
  value: QuoteStatus;
  label: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'draft', label: '下書き' },
  { value: 'sent', label: '送付済' },
  { value: 'accepted', label: '受注' },
  { value: 'rejected', label: '失注' },
];

export const STATUS_LABEL: Record<QuoteStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label])
) as Record<QuoteStatus, string>;

export const STATUS_STYLE: Record<QuoteStatus, string> = {
  draft: 'bg-neutral-100 text-neutral-600',
  sent: 'bg-info/10 text-info',
  accepted: 'bg-success/10 text-success',
  rejected: 'bg-danger/10 text-danger',
};

export function yen(n: number | string | null | undefined): string {
  const v = Number(n || 0);
  return '¥' + v.toLocaleString('ja-JP');
}

export function number(n: number | string | null | undefined): string {
  return Number(n || 0).toLocaleString('ja-JP');
}

// "2026-06-24" や Date -> "2026年06月24日"
export function jpDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (isNaN(d.getTime())) return String(value);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}年${m}月${day}日`;
}

// today as yyyy-MM-dd
export function todayISO(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

interface AddressParts {
  zip?: string;
  pref?: string;
  city?: string;
  address1?: string;
  address2?: string;
}

export function fullAddress({ zip, pref, city, address1, address2 }: AddressParts): string {
  const parts: string[] = [];
  if (zip) parts.push('〒' + zip);
  const line = [pref, city, address1, address2].filter(Boolean).join('');
  if (line) parts.push(line);
  return parts.join(' ');
}
