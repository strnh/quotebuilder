import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText } from 'lucide-react';
import clsx from 'clsx';
import { Quote } from '../data/store';
import { quoteTotals } from '../lib/calc';
import { yen, jpDate, STATUS_OPTIONS, STATUS_LABEL, STATUS_STYLE } from '../lib/format';
import { Button, Card, Input, Badge, EmptyState } from '../components/ui';
import PageHeader from '../components/PageHeader';
import type { Quote as TQuote, QuoteStatus } from '../types';

type TabValue = 'all' | QuoteStatus;
const TABS: { value: TabValue; label: string }[] = [{ value: 'all', label: 'すべて' }, ...STATUS_OPTIONS];

export default function QuoteList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<TQuote[]>([]);
  const [tab, setTab] = useState<TabValue>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    Quote.list('-created_date').then(setRows);
  }, []);

  const counts = TABS.reduce<Record<string, number>>((acc, t) => {
    acc[t.value] = t.value === 'all' ? rows.length : rows.filter((r) => r.status === t.value).length;
    return acc;
  }, {});

  const filtered = rows
    .filter((r) => tab === 'all' || r.status === tab)
    .filter((r) => !query || r.customer_name?.includes(query) || r.quote_number?.includes(query) || r.subject?.includes(query));

  return (
    <div>
      <PageHeader
        title="見積書一覧"
        actions={<Button onClick={() => navigate('/quotes/new')}><Plus size={16} />新規作成</Button>}
      />

      {/* タブ */}
      <div className="mb-4 flex flex-wrap gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={clsx(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === t.value
                ? 'border-primary text-primary-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-700'
            )}
          >
            {t.label} <span className="text-neutral-400">{counts[t.value]}</span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <Input className="pl-9" placeholder="顧客名・見積番号で検索..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <span className="text-sm text-neutral-500">{filtered.length}件の見積書</span>
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={FileText} title="見積書がありません">
          <Button onClick={() => navigate('/quotes/new')}><Plus size={16} />新規作成</Button>
        </EmptyState></Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
                <th className="px-5 py-3 font-medium">見積番号</th>
                <th className="px-5 py-3 font-medium">取引先 / 件名</th>
                <th className="px-5 py-3 font-medium">見積日</th>
                <th className="px-5 py-3 font-medium text-right">金額</th>
                <th className="px-5 py-3 font-medium">ステータス</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const { total } = quoteTotals(row);
                return (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/quotes/${row.id}`)}
                    className="cursor-pointer border-b border-neutral-50 last:border-0 hover:bg-neutral-50"
                  >
                    <td className="px-5 py-3 font-mono text-xs text-neutral-600">{row.quote_number}</td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-neutral-800">{row.customer_name || '—'}</div>
                      <div className="text-xs text-neutral-400">{row.subject || ''}</div>
                    </td>
                    <td className="px-5 py-3 text-neutral-500">{jpDate(row.created_date)}</td>
                    <td className="px-5 py-3 text-right font-medium text-neutral-800">{yen(total)}</td>
                    <td className="px-5 py-3">
                      <Badge className={STATUS_STYLE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
