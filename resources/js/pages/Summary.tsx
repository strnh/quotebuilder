import { useEffect, useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Quote } from '../data/store';
import { quoteTotals } from '../lib/calc';
import { yen } from '../lib/format';
import { Card, Select } from '../components/ui';
import PageHeader from '../components/PageHeader';
import type { Quote as TQuote } from '../types';

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

interface MonthlyRow {
  month: string;
  件数: number;
  受注件数: number;
  見積金額: number;
  受注金額: number;
}

export default function Summary() {
  const [rows, setRows] = useState<TQuote[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  useEffect(() => { Quote.list().then(setRows); }, []);

  const years = useMemo(() => {
    const ys = new Set<number>([new Date().getFullYear()]);
    rows.forEach((r) => { const y = new Date(r.created_date).getFullYear(); if (!isNaN(y)) ys.add(y); });
    return [...ys].sort((a, b) => b - a);
  }, [rows]);

  const ofYear = rows.filter((r) => new Date(r.created_date).getFullYear() === Number(year));
  const totalOf = (r: TQuote) => quoteTotals(r).total;

  const accepted = ofYear.filter((r) => r.status === 'accepted');
  const rejected = ofYear.filter((r) => r.status === 'rejected');
  const quoteTotal = ofYear.reduce((s, r) => s + totalOf(r), 0);
  const acceptedTotal = accepted.reduce((s, r) => s + totalOf(r), 0);
  const decided = accepted.length + rejected.length;
  const winRate = decided ? Math.round((accepted.length / decided) * 100) : 0;

  const monthly: MonthlyRow[] = MONTHS.map((label, i) => {
    const inMonth = ofYear.filter((r) => new Date(r.created_date).getMonth() === i);
    const acc = inMonth.filter((r) => r.status === 'accepted');
    return {
      month: label,
      件数: inMonth.length,
      受注件数: acc.length,
      見積金額: inMonth.reduce((s, r) => s + totalOf(r), 0),
      受注金額: acc.reduce((s, r) => s + totalOf(r), 0),
    };
  });

  const kpis = [
    { label: '見積総額', value: yen(quoteTotal), sub: `${ofYear.length} 件`, color: 'text-neutral-800' },
    { label: '受注金額', value: yen(acceptedTotal), sub: `${accepted.length} 件`, color: 'text-success' },
    { label: '失注件数', value: `${rejected.length} 件`, sub: '', color: 'text-danger' },
    { label: '受注率', value: `${winRate}%`, sub: `${accepted.length}/${decided}`, color: 'text-primary-700' },
  ];

  return (
    <div>
      <PageHeader
        title="月末集計"
        description="年間売上の推移を確認"
        actions={
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32">
            {years.map((y) => <option key={y} value={y}>{y}年</option>)}
          </Select>
        }
      />

      {/* KPI */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-5">
            <p className="text-xs text-neutral-500">{k.label}</p>
            <p className={`mt-1 text-2xl font-bold ${k.color}`}>{k.value}</p>
            {k.sub && <p className="mt-0.5 text-xs text-neutral-400">{k.sub}</p>}
          </Card>
        ))}
      </div>

      {/* 月別推移 */}
      <Card className="mb-6 p-5">
        <h2 className="mb-4 text-sm font-bold text-neutral-700">月別推移</h2>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f2f2f2" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#868686' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 12, fill: '#868686' }} axisLine={false} tickLine={false}
                tickFormatter={(v: number) => `¥${(v / 1e4).toFixed(0)}万`}
              />
              <Tooltip formatter={(v) => yen(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #dedede', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="見積金額" fill="#a9d487" radius={[6, 6, 0, 0]} />
              <Bar dataKey="受注金額" fill="#659734" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 月別明細 */}
      <Card className="overflow-hidden">
        <div className="border-b border-neutral-100 px-5 py-4"><h2 className="text-sm font-bold text-neutral-700">月別明細</h2></div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-100 text-left text-xs text-neutral-500">
              <th className="px-5 py-3 font-medium">月</th>
              <th className="px-5 py-3 font-medium text-right">件数</th>
              <th className="px-5 py-3 font-medium text-right">受注件数</th>
              <th className="px-5 py-3 font-medium text-right">受注金額</th>
              <th className="px-5 py-3 font-medium text-right">見積金額</th>
            </tr>
          </thead>
          <tbody>
            {monthly.map((m) => (
              <tr key={m.month} className="border-b border-neutral-50 last:border-0">
                <td className="px-5 py-2.5 font-medium text-neutral-700">{m.month}</td>
                <td className="px-5 py-2.5 text-right text-neutral-600">{m.件数}</td>
                <td className="px-5 py-2.5 text-right text-neutral-600">{m.受注件数}</td>
                <td className="px-5 py-2.5 text-right text-success">{yen(m.受注金額)}</td>
                <td className="px-5 py-2.5 text-right text-neutral-800">{yen(m.見積金額)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
