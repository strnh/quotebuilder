import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import { Quote, Customer, SenderProfile, nextQuoteNumber } from '../data/store';
import { quoteTotals, EMPTY_LINE_ITEM } from '../lib/calc';
import { yen, todayISO, STATUS_OPTIONS } from '../lib/format';
import { Button, Card, Input, Select, Textarea, Field, useToast } from '../components/ui';
import PageHeader from '../components/PageHeader';
import type {
  Customer as TCustomer, LineItem, Quote as TQuote, SenderProfile as TSenderProfile,
} from '../types';

const SENDER_KEYS = ['sender_company', 'sender_zip', 'sender_pref', 'sender_city', 'sender_address1', 'sender_address2', 'sender_person', 'sender_tel', 'sender_fax', 'sender_logo_url'] as const;
const CUSTOMER_KEYS = ['customer_name', 'customer_department', 'customer_person', 'customer_zip', 'customer_pref', 'customer_city', 'customer_address1', 'customer_address2', 'customer_tel'] as const;

type QuoteForm = Omit<TQuote, 'id'> & { id?: TQuote['id'] };

function blankQuote(): QuoteForm {
  return {
    quote_number: '', subject: '', status: 'draft',
    created_date: todayISO(), valid_until: '', valid_period: 'お見積り日から１０日以内',
    delivery_location: 'ご指定場所', delivery_date: '', payment_terms: '',
    tax_rate: 10, notes: '',
    ...(Object.fromEntries(SENDER_KEYS.map((k) => [k, ''])) as Record<(typeof SENDER_KEYS)[number], string>),
    ...(Object.fromEntries(CUSTOMER_KEYS.map((k) => [k, ''])) as Record<(typeof CUSTOMER_KEYS)[number], string>),
    sender_profile_id: '', customer_id: '',
    items: [{ ...EMPTY_LINE_ITEM }],
  };
}

export default function QuoteForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const toast = useToast();

  const [quote, setQuote] = useState<QuoteForm>(blankQuote);
  const [senders, setSenders] = useState<TSenderProfile[]>([]);
  const [customers, setCustomers] = useState<TCustomer[]>([]);
  const [loaded, setLoaded] = useState(!isEdit);

  useEffect(() => {
    (async () => {
      const [sp, cs] = await Promise.all([SenderProfile.list(), Customer.list('customer_name')]);
      setSenders(sp);
      setCustomers(cs);

      if (isEdit && id) {
        const q = await Quote.get(id);
        if (q) setQuote({ ...blankQuote(), ...q, items: q.items?.length ? q.items : [{ ...EMPTY_LINE_ITEM }] });
        setLoaded(true);
      } else {
        const num = await nextQuoteNumber();
        const def = sp.find((s) => s.is_default) || sp[0];
        setQuote((prev) => ({
          ...prev,
          quote_number: num,
          ...(def ? applySender(def) : {}),
          sender_profile_id: def?.id ?? '',
        }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const set = <K extends keyof QuoteForm>(k: K, v: QuoteForm[K]) =>
    setQuote((q) => ({ ...q, [k]: v }));

  function applySender(sp: TSenderProfile): Partial<QuoteForm> {
    return Object.fromEntries(SENDER_KEYS.map((k) => [k, sp[k] ?? ''])) as Partial<QuoteForm>;
  }
  function applyCustomer(c: TCustomer): Partial<QuoteForm> {
    return Object.fromEntries(CUSTOMER_KEYS.map((k) => [k, c[k] ?? ''])) as Partial<QuoteForm>;
  }

  const onSelectSender = (sid: string) => {
    const sp = senders.find((s) => String(s.id) === sid);
    setQuote((q) => ({ ...q, sender_profile_id: sid, ...(sp ? applySender(sp) : {}) }));
  };
  const onSelectCustomer = (cid: string) => {
    const c = customers.find((x) => String(x.id) === cid);
    setQuote((q) => ({ ...q, customer_id: cid, ...(c ? applyCustomer(c) : {}) }));
  };

  // 品目
  const updateItem = (idx: number, key: keyof LineItem, value: string) => {
    setQuote((q) => {
      const items = q.items.map((it, i) => {
        if (i !== idx) return it;
        const next = { ...it, [key]: value } as LineItem;
        if (key === 'quantity' || key === 'unit_price') {
          next.total = Number(next.quantity || 0) * Number(next.unit_price || 0);
        }
        return next;
      });
      return { ...q, items };
    });
  };
  const addItem = () => setQuote((q) => ({ ...q, items: [...q.items, { ...EMPTY_LINE_ITEM }] }));
  const removeItem = (idx: number) => setQuote((q) => ({ ...q, items: q.items.filter((_, i) => i !== idx) }));

  const totals = useMemo(() => quoteTotals(quote), [quote]);

  const save = async () => {
    if (!quote.customer_name) { toast('取引先を選択してください', 'error'); return; }
    const payload = { ...quote, total_amount: totals.total, tax_amount: totals.tax };
    if (isEdit && id) {
      await Quote.update(id, payload);
      toast('見積書を更新しました');
      navigate(`/quotes/${id}`);
    } else {
      const created = await Quote.create(payload);
      toast('見積書を作成しました');
      navigate(`/quotes/${created.id}`);
    }
  };

  if (!loaded) return <div className="py-20 text-center text-sm text-neutral-400">読み込み中...</div>;

  const num = (v: number | string): number | string => (v === 0 || v ? v : '');

  return (
    <div>
      <PageHeader
        title={isEdit ? '見積書編集' : '見積書作成'}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(-1)}><ArrowLeft size={16} />戻る</Button>
            <Button onClick={save}>保存</Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* 発行者 / 取引先 */}
          <Card className="p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Field label="発行者">
                  <Select value={String(quote.sender_profile_id)} onChange={(e) => onSelectSender(e.target.value)}>
                    <option value="">発行者を選択</option>
                    {senders.map((s) => <option key={s.id} value={s.id}>{s.sender_company}</option>)}
                  </Select>
                </Field>
                {senders.length === 0 && (
                  <p className="mt-1 text-xs text-warning">
                    ※ 発行者が未登録です。<Link to="/sender-profiles" className="underline">基本情報マスタ</Link> から登録してください。
                  </p>
                )}
              </div>
              <div>
                <Field label="取引先" required>
                  <Select value={String(quote.customer_id)} onChange={(e) => onSelectCustomer(e.target.value)}>
                    <option value="">取引先を選択</option>
                    {customers.map((c) => <option key={c.id} value={c.id}>{c.customer_name}</option>)}
                  </Select>
                </Field>
                {customers.length === 0 && (
                  <p className="mt-1 text-xs text-warning">
                    ※ 取引先が未登録です。<Link to="/customers" className="underline">取引先マスタ</Link> から登録してください。
                  </p>
                )}
              </div>
            </div>
          </Card>

          {/* 見積情報 */}
          <Card className="p-5">
            <h2 className="mb-4 text-sm font-bold text-neutral-700">見積情報</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="見積番号"><Input value={quote.quote_number} onChange={(e) => set('quote_number', e.target.value)} /></Field>
              <Field label="ステータス">
                <Select value={quote.status} onChange={(e) => set('status', e.target.value as TQuote['status'])}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </Field>
              <Field label="見積日"><Input type="date" value={quote.created_date} onChange={(e) => set('created_date', e.target.value)} /></Field>
              <Field label="有効期限"><Input type="date" value={quote.valid_until} onChange={(e) => set('valid_until', e.target.value)} /></Field>
              <div className="sm:col-span-2">
                <Field label="件名"><Input value={quote.subject} onChange={(e) => set('subject', e.target.value)} placeholder="件名を入力" /></Field>
              </div>
              <Field label="納入場所"><Input value={quote.delivery_location} onChange={(e) => set('delivery_location', e.target.value)} /></Field>
              <Field label="納期"><Input value={quote.delivery_date} onChange={(e) => set('delivery_date', e.target.value)} placeholder="例: 2025/03/31" /></Field>
              <Field label="御支払条件"><Input value={quote.payment_terms} onChange={(e) => set('payment_terms', e.target.value)} placeholder="例: 月末締め翌月末払い" /></Field>
              <Field label="見積有効期限"><Input value={quote.valid_period} onChange={(e) => set('valid_period', e.target.value)} /></Field>
            </div>
          </Card>

          {/* 品目 */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-neutral-700">品目</h2>
              <Button size="sm" variant="secondary" onClick={addItem}><Plus size={14} />品目を追加</Button>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-12 gap-2 border-b border-neutral-100 pb-2 text-xs font-medium text-neutral-500">
                  <div className="col-span-3">品名</div>
                  <div className="col-span-2">仕様</div>
                  <div className="col-span-1">数量</div>
                  <div className="col-span-1">単位</div>
                  <div className="col-span-2">標準価格</div>
                  <div className="col-span-2">納入単価</div>
                  <div className="col-span-1 text-right">金額</div>
                </div>
                {quote.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 items-center gap-2 border-b border-neutral-50 py-2">
                    <div className="col-span-3"><Input value={it.name} onChange={(e) => updateItem(idx, 'name', e.target.value)} /></div>
                    <div className="col-span-2"><Input value={it.spec} onChange={(e) => updateItem(idx, 'spec', e.target.value)} /></div>
                    <div className="col-span-1"><Input type="number" value={num(it.quantity)} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} /></div>
                    <div className="col-span-1"><Input value={it.unit} onChange={(e) => updateItem(idx, 'unit', e.target.value)} placeholder="個" /></div>
                    <div className="col-span-2"><Input type="number" value={num(it.standard_price)} onChange={(e) => updateItem(idx, 'standard_price', e.target.value)} /></div>
                    <div className="col-span-2"><Input type="number" value={num(it.unit_price)} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} /></div>
                    <div className="col-span-1 flex items-center justify-end gap-1 text-right text-xs">
                      <span className="text-neutral-700">{yen(it.total)}</span>
                      {quote.items.length > 1 && (
                        <button onClick={() => removeItem(idx)} className="text-neutral-300 hover:text-danger"><Trash2 size={14} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>

          {/* 備考 */}
          <Card className="p-5">
            <Field label="備考">
              <Textarea value={quote.notes} onChange={(e) => set('notes', e.target.value)} placeholder="備考・特記事項" />
            </Field>
          </Card>
        </div>

        {/* 金額サマリー */}
        <div>
          <Card className="sticky top-8 p-5">
            <h2 className="mb-4 text-sm font-bold text-neutral-700">金額サマリー</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-neutral-500">小計</dt><dd className="font-medium">{yen(totals.subtotal)}</dd></div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-2 text-neutral-500">
                  消費税
                  <span className="inline-flex items-center gap-1">
                    <Input type="number" value={num(quote.tax_rate)} onChange={(e) => set('tax_rate', Number(e.target.value))} className="w-16 px-2 py-1 text-right" />%
                  </span>
                </dt>
                <dd className="font-medium">{yen(totals.tax)}</dd>
              </div>
              <div className="mt-3 flex justify-between border-t border-neutral-100 pt-3 text-base">
                <dt className="font-bold text-neutral-700">合計</dt>
                <dd className="font-bold text-primary-700">{yen(totals.total)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
