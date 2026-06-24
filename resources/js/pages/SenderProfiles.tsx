import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Plus, Pencil, Trash2, Building2, Star } from 'lucide-react';
import { SenderProfile } from '../data/store';
import { PREFECTURES } from '../lib/format';
import {
  Button, Card, Input, Select, Field, Modal, Badge, EmptyState, useToast,
} from '../components/ui';
import PageHeader from '../components/PageHeader';
import type { ID, SenderProfile as TSenderProfile } from '../types';

type SenderForm = Omit<TSenderProfile, 'id'>;

const EMPTY: SenderForm = {
  sender_company: '', sender_zip: '', sender_pref: '', sender_city: '',
  sender_address1: '', sender_address2: '', sender_person: '',
  sender_tel: '', sender_fax: '', sender_logo_url: '', is_default: false,
};

export default function SenderProfiles() {
  const toast = useToast();
  const [rows, setRows] = useState<TSenderProfile[]>([]);
  const [editing, setEditing] = useState<TSenderProfile | Record<string, never> | null>(null);
  const [form, setForm] = useState<SenderForm>(EMPTY);
  const [deleteId, setDeleteId] = useState<ID | null>(null);
  const [uploading, setUploading] = useState(false);

  const load = async () => setRows(await SenderProfile.list('-created_date'));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY); setEditing({}); };
  const openEdit = (row: TSenderProfile) => { setForm({ ...EMPTY, ...row }); setEditing(row); };
  const set = <K extends keyof SenderForm>(k: K, v: SenderForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const editingId = editing && 'id' in editing ? (editing as TSenderProfile).id : undefined;

  const onLogo = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => { set('sender_logo_url', String(reader.result)); setUploading(false); };
    reader.readAsDataURL(file);
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.sender_company.trim()) { toast('組織名称を入力してください', 'error'); return; }
    if (editingId) {
      await SenderProfile.update(editingId, form);
      toast('更新しました');
    } else {
      const all = await SenderProfile.list();
      await SenderProfile.create({ ...form, is_default: all.length === 0 ? true : form.is_default });
      toast('登録しました');
    }
    setEditing(null);
    load();
  };

  const setDefault = async (row: TSenderProfile) => {
    const all = await SenderProfile.list();
    for (const r of all) await SenderProfile.update(r.id, { is_default: r.id === row.id });
    toast('デフォルトを設定しました');
    load();
  };

  const remove = async () => {
    if (deleteId == null) return;
    await SenderProfile.delete(deleteId);
    setDeleteId(null);
    toast('削除しました');
    load();
  };

  return (
    <div>
      <PageHeader
        title="基本情報マスタ"
        description="見積書の発行者情報を管理します"
        actions={<Button onClick={openNew}><Plus size={16} />新規追加</Button>}
      />

      {rows.length === 0 ? (
        <Card><EmptyState icon={Building2} title="発行者情報が登録されていません" /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.id} className="p-5">
              <div className="flex items-start justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  {row.sender_logo_url ? (
                    <img src={row.sender_logo_url} alt="" className="h-10 w-10 rounded-[8px] object-contain ring-1 ring-neutral-100" />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-primary-50 text-primary-600"><Building2 size={18} /></div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-neutral-800">{row.sender_company}</h3>
                      {row.is_default && <Badge className="bg-primary-50 text-primary-700">デフォルト</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">
                      {[row.sender_pref, row.sender_city, row.sender_address1].filter(Boolean).join('')}
                    </p>
                    {row.sender_tel && <p className="mt-0.5 text-xs text-neutral-500">TEL: {row.sender_tel} {row.sender_fax && `/ FAX: ${row.sender_fax}`}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(row)}><Pencil size={14} /></Button>
                  <Button size="sm" variant="ghost" className="text-danger" onClick={() => setDeleteId(row.id)}><Trash2 size={14} /></Button>
                </div>
              </div>
              {!row.is_default && (
                <Button size="sm" variant="secondary" className="mt-3" onClick={() => setDefault(row)}>
                  <Star size={13} />デフォルトに設定
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editingId ? '基本情報を編集' : '基本情報を新規登録'}
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
            <Field label="組織名称" required>
              <Input value={form.sender_company} onChange={(e) => set('sender_company', e.target.value)} placeholder="株式会社〇〇" />
            </Field>
          </div>
          <Field label="郵便番号">
            <Input value={form.sender_zip} onChange={(e) => set('sender_zip', e.target.value)} placeholder="150-0000" />
          </Field>
          <Field label="都道府県">
            <Select value={form.sender_pref} onChange={(e) => set('sender_pref', e.target.value)}>
              <option value="">選択</option>
              {PREFECTURES.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="市区町村">
            <Input value={form.sender_city} onChange={(e) => set('sender_city', e.target.value)} placeholder="横浜市神奈川区" />
          </Field>
          <Field label="番地">
            <Input value={form.sender_address1} onChange={(e) => set('sender_address1', e.target.value)} placeholder="1-2-3" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="建物名・部屋番号">
              <Input value={form.sender_address2} onChange={(e) => set('sender_address2', e.target.value)} />
            </Field>
          </div>
          <Field label="担当者名">
            <Input value={form.sender_person} onChange={(e) => set('sender_person', e.target.value)} placeholder="山田 太郎" />
          </Field>
          <div />
          <Field label="電話番号">
            <Input value={form.sender_tel} onChange={(e) => set('sender_tel', e.target.value)} placeholder="03-0000-0000" />
          </Field>
          <Field label="FAX番号">
            <Input value={form.sender_fax} onChange={(e) => set('sender_fax', e.target.value)} placeholder="03-0000-0001" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="ロゴ画像（jpg / png / gif）">
              <div className="flex items-center gap-3">
                {form.sender_logo_url && <img src={form.sender_logo_url} alt="" className="h-12 w-12 rounded-[8px] object-contain ring-1 ring-neutral-100" />}
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-2 rounded-[16px] border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50">
                    {uploading ? 'アップロード中...' : '画像を選択'}
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/gif" className="hidden" onChange={onLogo} />
                </label>
              </div>
            </Field>
          </div>
        </form>
      </Modal>

      <Modal
        open={deleteId != null}
        onClose={() => setDeleteId(null)}
        title="発行者情報を削除しますか？"
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
