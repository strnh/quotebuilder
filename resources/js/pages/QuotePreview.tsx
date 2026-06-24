import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { Quote } from '../data/store';
import { quoteTotals } from '../lib/calc';
import { yen, number, jpDate, fullAddress } from '../lib/format';
import { Button, Card, Modal, EmptyState, useToast } from '../components/ui';
import type { Quote as TQuote } from '../types';

const MIN_ROWS = 8;

export default function QuotePreview() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [quote, setQuote] = useState<TQuote | null | undefined>(undefined); // undefined=loading, null=notfound
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (id) Quote.get(id).then((q) => setQuote(q ?? null));
  }, [id]);

  if (quote === undefined) return <div className="py-20 text-center text-sm text-neutral-400">読み込み中...</div>;
  if (quote === null) {
    return (
      <Card>
        <EmptyState title="見積書が見つかりません">
          <Button onClick={() => navigate('/')}><ArrowLeft size={16} />一覧に戻る</Button>
        </EmptyState>
      </Card>
    );
  }

  const { subtotal, taxRate, tax, total } = quoteTotals(quote);
  const items = quote.items || [];
  const blankRows = Math.max(0, MIN_ROWS - items.length);

  const remove = async () => {
    if (!id) return;
    await Quote.delete(id);
    toast('見積書を削除しました');
    navigate('/');
  };

  return (
    <div>
      {/* アクションバー */}
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-2">
        <Button variant="secondary" onClick={() => navigate('/')}><ArrowLeft size={16} />一覧に戻る</Button>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(`/quotes/${id}/edit`)}><Pencil size={16} />編集</Button>
          <Button variant="outlineDanger" onClick={() => setConfirmDelete(true)}><Trash2 size={16} />削除</Button>
          <Button onClick={() => window.print()}><Printer size={16} />印刷 / PDF保存</Button>
        </div>
      </div>

      {/* 見積書本体 */}
      <div className="print-area mx-auto max-w-[800px] bg-white p-10 shadow-md print:max-w-none print:p-0 print:shadow-none">
        <h1 className="text-center text-2xl font-bold tracking-[0.4em] text-neutral-800">御　見　積　書</h1>

        <div className="mt-8 flex items-start justify-between gap-8">
          {/* 取引先 */}
          <div className="flex-1">
            <div className="border-b-2 border-neutral-800 pb-1 text-lg font-bold">
              {quote.customer_name} <span className="text-base">御中</span>
            </div>
            {quote.customer_department && <div className="mt-1 text-sm text-neutral-600">{quote.customer_department}</div>}
            {quote.customer_person && <div className="text-sm text-neutral-600">{quote.customer_person} 様</div>}
            <p className="mt-5 text-sm text-neutral-600">下記のとおり御見積り/精算申し上げます。</p>
          </div>

          {/* 発行者 */}
          <div className="w-64 text-sm">
            <div className="mb-2 text-right text-xs text-neutral-500">見積日: {jpDate(quote.created_date)}</div>
            <div className="mb-1 text-right text-xs text-neutral-500 font-mono">{quote.quote_number}</div>
            <div className="rounded-[8px] bg-neutral-50 p-3">
              {quote.sender_logo_url && <img src={quote.sender_logo_url} alt="" className="mb-2 h-10 object-contain" />}
              <div className="font-bold text-neutral-800">{quote.sender_company}</div>
              <div className="mt-1 text-xs leading-relaxed text-neutral-600">
                {fullAddress({ zip: quote.sender_zip, pref: quote.sender_pref, city: quote.sender_city, address1: quote.sender_address1, address2: quote.sender_address2 })}
              </div>
              {quote.sender_tel && <div className="text-xs text-neutral-600">TEL: {quote.sender_tel}</div>}
              {quote.sender_fax && <div className="text-xs text-neutral-600">FAX: {quote.sender_fax}</div>}
              {quote.sender_person && <div className="mt-1 text-xs text-neutral-600">担当： {quote.sender_person}</div>}
            </div>
          </div>
        </div>

        {/* 合計金額バナー */}
        <div className="mt-6 flex items-baseline gap-3 border-y-2 border-neutral-800 py-3">
          <span className="text-sm font-bold text-neutral-700">合計金額：</span>
          <span className="text-2xl font-bold text-neutral-900">{yen(total)}</span>
          <span className="text-xs text-neutral-500">－（消費税含む）</span>
        </div>

        {/* メタ情報 */}
        <table className="mt-5 w-full text-sm">
          <tbody>
            <MetaRow label="件　　名" value={quote.subject} />
            <MetaRow label="納　入場所" value={quote.delivery_location} />
            <MetaRow label="納　　期" value={quote.delivery_date} />
            <MetaRow label="御支払条件" value={quote.payment_terms} />
            <MetaRow label="見積有効期限" value={quote.valid_period} />
          </tbody>
        </table>

        {/* 明細テーブル */}
        <table className="mt-6 w-full border-collapse text-sm">
          <thead>
            <tr className="bg-primary-50 text-xs text-primary-800">
              <th className="border border-neutral-300 px-2 py-2 text-left">商　品　名</th>
              <th className="border border-neutral-300 px-2 py-2 text-left">仕　様</th>
              <th className="border border-neutral-300 px-2 py-2 text-right w-16">数量</th>
              <th className="border border-neutral-300 px-2 py-2 text-center w-14">単位</th>
              <th className="border border-neutral-300 px-2 py-2 text-right w-24">標準価格</th>
              <th className="border border-neutral-300 px-2 py-2 text-right w-24">納入価格</th>
              <th className="border border-neutral-300 px-2 py-2 text-right w-28">金額</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td className="border border-neutral-300 px-2 py-1.5">{it.name}</td>
                <td className="border border-neutral-300 px-2 py-1.5 text-neutral-500">{it.spec}</td>
                <td className="border border-neutral-300 px-2 py-1.5 text-right">{number(it.quantity)}</td>
                <td className="border border-neutral-300 px-2 py-1.5 text-center">{it.unit}</td>
                <td className="border border-neutral-300 px-2 py-1.5 text-right text-neutral-400">{it.standard_price ? number(it.standard_price) : ''}</td>
                <td className="border border-neutral-300 px-2 py-1.5 text-right">{number(it.unit_price)}</td>
                <td className="border border-neutral-300 px-2 py-1.5 text-right font-medium">{number(it.total)}</td>
              </tr>
            ))}
            {blankRows > 0 && (
              <tr>
                <td className="border border-neutral-300 px-2 py-1.5 text-center text-xs text-neutral-300" colSpan={7}>以下余白</td>
              </tr>
            )}
            {Array.from({ length: Math.max(0, blankRows - 1) }).map((_, i) => (
              <tr key={`b${i}`}>
                {Array.from({ length: 7 }).map((__, j) => <td key={j} className="border border-neutral-300 px-2 py-1.5">&nbsp;</td>)}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={5} className="border-0"></td>
              <td className="border border-neutral-300 px-2 py-1.5 text-right text-neutral-600">小計</td>
              <td className="border border-neutral-300 px-2 py-1.5 text-right">{number(subtotal)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="border-0"></td>
              <td className="border border-neutral-300 px-2 py-1.5 text-right text-neutral-600">消費税({taxRate}%)</td>
              <td className="border border-neutral-300 px-2 py-1.5 text-right">{number(tax)}</td>
            </tr>
            <tr>
              <td colSpan={5} className="border-0"></td>
              <td className="border border-neutral-300 bg-primary-50 px-2 py-2 text-right font-bold text-primary-800">合計</td>
              <td className="border border-neutral-300 bg-primary-50 px-2 py-2 text-right font-bold text-primary-800">{yen(total)}</td>
            </tr>
          </tfoot>
        </table>

        {/* 備考 */}
        {quote.notes && (
          <div className="mt-6 text-sm">
            <div className="font-medium text-neutral-700">備考：</div>
            <p className="mt-1 whitespace-pre-wrap text-neutral-600">{quote.notes}</p>
          </div>
        )}
      </div>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="見積書を削除しますか？"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>キャンセル</Button>
            <Button variant="danger" onClick={remove}>削除</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">この操作は取り消せません。</p>
      </Modal>
    </div>
  );
}

function MetaRow({ label, value }: { label: ReactNode; value?: string }) {
  if (!value) return null;
  return (
    <tr className="border-b border-neutral-100">
      <td className="w-32 py-1.5 pr-4 align-top text-neutral-500">{label}</td>
      <td className="py-1.5 text-neutral-800">{value}</td>
    </tr>
  );
}
