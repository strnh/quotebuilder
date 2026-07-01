import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Plus, Pencil, Trash2, Users, Search, X } from 'lucide-react';
import { Customer } from '../data/store';
import type { ApiError } from '../data/adapters/api';
import { PREFECTURES } from '../lib/format';
import {
  Button, Card, Input, Select, Field, Modal, EmptyState, useToast,
} from '../components/ui';
import PageHeader from '../components/PageHeader';
import type { Customer as TCustomer, ID } from '../types';

type CustomerForm = Omit<TCustomer, 'id'>;

const EMPTY: CustomerForm = {
  customer_name: '', signatures: [], customer_department: '', customer_person: '',
  customer_zip: '', customer_pref: '', customer_city: '',
  customer_address1: '', customer_address2: '', customer_tel: '',
};

const SIGNATURE_RE = /^[A-Za-z0-9]+$/;

export default function Customers() {
  const toast = useToast();
  const [rows, setRows] = useState<TCustomer[]>([]);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<TCustomer | Record<string, never> | null>(null);
  const [form, setForm] = useState<CustomerForm>(EMPTY);
  const [deleteId, setDeleteId] = useState<ID | null>(null);
  const [sigInput, setSigInput] = useState('');

  const load = async () => setRows(await Customer.list('-created_date'));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setSigInput(''); setEditing({}); };
  const openEdit = (row: TCustomer) => { setForm({ ...EMPTY, ...row }); setSigInput(''); setEditing(row); };
  const set = <K extends keyof CustomerForm>(k: K, v: CustomerForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const editingId = editing && 'id' in editing ? (editing as TCustomer).id : undefined;

  const addSignature = () => {
    const v = sigInput.trim().toUpperCase();
    if (!v) return;
    if (!SIGNATURE_RE.test(v)) { toast('取引先識別子は英数字で入力してください', 'error'); return; }
    if (form.signatures.includes(v)) { toast('すでに追加されています', 'error'); return; }
    set('signatures', [...form.signatures, v]);
    setSigInput('');
  };
  const removeSignature = (v: string) => set('signatures', form.signatures.filter((s) => s !== v));
  const onSigKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSignature(); }
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim()) { toast('会社名・組織名を入力してください', 'error'); return; }

    // 「追加」を押し忘れて未確定のまま保存された入力値も識別子として確定させる
    const pending = sigInput.trim().toUpperCase();
    let signatures = form.signatures;
    if (pending) {
      if (!SIGNATURE_RE.test(pending)) { toast('取引先識別子は英数字で入力してください', 'error'); return; }
      if (!signatures.includes(pending)) signatures = [...signatures, pending];
    }
    if (signatures.length === 0) { toast('取引先識別子を1つ以上追加してください', 'error'); return; }

    try {
      if (editingId) {
        await Customer.update(editingId, { ...form, signatures });
        toast('更新しました');
      } else {
        await Customer.create({ ...form, signatures });
        toast('登録しました');
      }
      setEditing(null);
      setSigInput('');
      load();
    } catch (err) {
      const apiErr = err as ApiError;
      const firstError = Object.values(apiErr.errors ?? {})[0]?.[0];
      toast(firstError ?? apiErr.message ?? '保存に失敗しました', 'error');
    }
  };

  const remove = async () => {
    if (deleteId == null) return;
    await Customer.delete(deleteId);
    setDeleteId(null);
    toast('削除しました');
    load();
  };

  const filtered = rows.filter((r) =>
    !query || r.customer_name?.includes(query) || r.customer_person?.includes(query)
    || r.signatures?.some((s) => s.toUpperCase().includes(query.toUpperCase()))
  );

  return (
    <div>
      <PageHeader
        title="取引先マスタ"
        description="見積送付先の取引先を管理します"
        actions={<Button onClick={openNew}><Plus size={16} />新規追加</Button>}
      />

      <div className="mb-4 relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <Input className="pl-9" placeholder="取引先名で検索" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState icon={Users} title={rows.length === 0 ? '取引先が登録されていません' : '該当する取引先がありません'} /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((row) => (
            <Card key={row.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-neutral-800">{row.customer_name}</h3>
                    {row.signatures?.map((s) => (
                      <span key={s} className="shrink-0 rounded bg-primary-50 px-1.5 py-0.5 font-mono text-[11px] text-primary-700">
                        {s}
                      </span>
                    ))}
                  </div>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {[row.customer_department, row.customer_person && `${row.customer_person} 様`].filter(Boolean).join(' / ')}
                  </p>
                  <p className="mt-2 text-xs text-neutral-500">
                    {[row.customer_pref, row.customer_city, row.customer_address1].filter(Boolean).join('')}
                  </p>
                  {row.customer_tel && <p className="mt-0.5 text-xs text-neutral-500">TEL: {row.customer_tel}</p>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(row)}><Pencil size={14} /></Button>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleteId(row.id)}><Trash2 size={14} /></Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* 編集/新規モーダル */}
      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editingId ? '取引先を編集' : '取引先を新規登録'}
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>キャンセル</Button>
            <Button onClick={save}>保存</Button>
          </>
        }
      >
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="会社名・組織名" required>
              <Input value={form.customer_name} onChange={(e) => set('customer_name', e.target.value)} placeholder="株式会社〇〇" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="取引先識別子" required hint="英数字。取込ファイル名 H-[識別子][日付].xlsx の照合に使います（複数登録可・例: CMK, WEI）">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {form.signatures.map((s) => (
                  <span
                    key={s}
                    className="flex items-center gap-1 rounded bg-primary-50 px-2 py-1 font-mono text-xs text-primary-700"
                  >
                    {s}
                    <button
                      type="button"
                      onClick={() => removeSignature(s)}
                      className="text-primary-400 hover:text-primary-700"
                      aria-label={`${s} を削除`}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={sigInput}
                  onChange={(e) => setSigInput(e.target.value.toUpperCase())}
                  onKeyDown={onSigKeyDown}
                  placeholder="CMK"
                />
                <Button type="button" variant="secondary" onClick={addSignature}>追加</Button>
              </div>
            </Field>
          </div>
          <Field label="部署名">
            <Input value={form.customer_department} onChange={(e) => set('customer_department', e.target.value)} placeholder="営業部" />
          </Field>
          <Field label="担当者名">
            <Input value={form.customer_person} onChange={(e) => set('customer_person', e.target.value)} placeholder="田中 花子" />
          </Field>
          <Field label="郵便番号">
            <Input value={form.customer_zip} onChange={(e) => set('customer_zip', e.target.value)} placeholder="100-0000" />
          </Field>
          <Field label="都道府県">
            <Select value={form.customer_pref} onChange={(e) => set('customer_pref', e.target.value)}>
              <option value="">選択</option>
              {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="市区町村">
            <Input value={form.customer_city} onChange={(e) => set('customer_city', e.target.value)} placeholder="渋谷区〇〇" />
          </Field>
          <Field label="番地">
            <Input value={form.customer_address1} onChange={(e) => set('customer_address1', e.target.value)} placeholder="1-2-3" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="建物名・部屋番号">
              <Input value={form.customer_address2} onChange={(e) => set('customer_address2', e.target.value)} />
            </Field>
          </div>
          <Field label="電話番号">
            <Input value={form.customer_tel} onChange={(e) => set('customer_tel', e.target.value)} placeholder="03-0000-0000" />
          </Field>
        </form>
      </Modal>

      {/* 削除確認 */}
      <Modal
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        title="取引先を削除しますか？"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>キャンセル</Button>
            <Button variant="danger" onClick={remove}>削除</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-600">この操作は取り消せません。</p>
      </Modal>
    </div>
  );
}
