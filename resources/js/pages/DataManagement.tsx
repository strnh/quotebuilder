import { useRef, useState } from 'react';
import { Download, Upload, Database } from 'lucide-react';
import { format } from 'date-fns';
import { Button, Card, Field, Modal, useToast } from '../components/ui';
import PageHeader from '../components/PageHeader';
import { downloadBackup, restoreBackup } from '../data/adapters/api';
import type { RestoreResult } from '../types';

type RestoreMode = 'skip' | 'overwrite';

export default function DataManagement() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [downloading, setDownloading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mode, setMode] = useState<RestoreMode>('skip');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<RestoreResult | null>(null);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const data = await downloadBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `quotebuilder-backup-${format(new Date(), 'yyyyMMdd-HHmmss')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('バックアップをダウンロードしました');
    } catch {
      toast('バックアップの取得に失敗しました', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null);
    setResult(null);
  };

  const handleRestoreClick = () => {
    if (!selectedFile) {
      toast('ファイルを選択してください', 'error');
      return;
    }
    setConfirmOpen(true);
  };

  const handleRestoreConfirm = async () => {
    if (!selectedFile) return;
    setConfirmOpen(false);
    setRestoring(true);
    try {
      const summary = await restoreBackup(selectedFile, mode);
      setResult(summary);
      if (summary.errors.length === 0) {
        toast(`リストア完了: ${summary.inserted}件挿入, ${summary.updated}件更新, ${summary.skipped}件スキップ`);
      } else {
        toast(`リストア完了（${summary.errors.length}件エラーあり）`, 'info');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'リストアに失敗しました', 'error');
    } finally {
      setRestoring(false);
      setSelectedFile(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div>
      <PageHeader
        title="データ管理"
        description="基本情報・顧客マスター・見積データのバックアップとリストア"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* バックアップ */}
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-primary-50 text-primary-600">
              <Download size={20} />
            </div>
            <div>
              <h2 className="font-bold text-neutral-800">バックアップ</h2>
              <p className="text-xs text-neutral-500">全データをJSONファイルに書き出します</p>
            </div>
          </div>
          <p className="mb-5 text-sm text-neutral-600">
            基本情報・顧客マスター・見積データをひとつのファイルにまとめてダウンロードします。
            機種変更や環境移行の前にバックアップしてください。
          </p>
          <Button onClick={handleDownload} disabled={downloading} className="w-full">
            <Download size={16} />
            {downloading ? 'ダウンロード中...' : 'バックアップをダウンロード'}
          </Button>
        </Card>

        {/* リストア */}
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-amber-50 text-amber-600">
              <Upload size={20} />
            </div>
            <div>
              <h2 className="font-bold text-neutral-800">リストア</h2>
              <p className="text-xs text-neutral-500">バックアップファイルからデータを復元します</p>
            </div>
          </div>

          <div className="mb-4 space-y-4">
            <Field label="バックアップファイル">
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="block w-full text-sm text-neutral-600 file:mr-3 file:cursor-pointer file:rounded-[12px] file:border file:border-neutral-200 file:bg-white file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-neutral-700 hover:file:bg-neutral-50"
              />
            </Field>

            <Field label="競合時の動作">
              <div className="mt-1 space-y-2">
                {(['skip', 'overwrite'] as RestoreMode[]).map((m) => (
                  <label key={m} className="flex cursor-pointer items-start gap-2">
                    <input
                      type="radio"
                      name="mode"
                      value={m}
                      checked={mode === m}
                      onChange={() => setMode(m)}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="text-sm">
                      {m === 'skip' ? (
                        <>
                          <span className="font-medium text-neutral-800">スキップ</span>
                          <span className="ml-1 text-neutral-500">（既存レコードは変更しない）</span>
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-neutral-800">上書き</span>
                          <span className="ml-1 text-neutral-500">（既存レコードをバックアップの内容で更新）</span>
                        </>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            </Field>
          </div>

          <Button
            variant="secondary"
            onClick={handleRestoreClick}
            disabled={restoring || !selectedFile}
            className="w-full"
          >
            <Upload size={16} />
            {restoring ? 'リストア中...' : 'リストアを実行'}
          </Button>

          {result && (
            <div className="mt-4 rounded-[12px] border border-neutral-100 bg-neutral-50 p-4">
              <p className="mb-2 text-xs font-semibold text-neutral-600">リストア結果</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: '挿入', value: result.inserted, color: 'text-success' },
                  { label: '更新', value: result.updated, color: 'text-info' },
                  { label: 'スキップ', value: result.skipped, color: 'text-neutral-500' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-[8px] bg-white p-2 shadow-sm">
                    <p className={`text-lg font-bold ${color}`}>{value}</p>
                    <p className="text-xs text-neutral-400">{label}</p>
                  </div>
                ))}
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  {result.errors.map((err, i) => (
                    <p key={i} className="text-xs text-danger">{err}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* 確認ダイアログ */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="リストアを実行しますか？"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOpen(false)}>キャンセル</Button>
            <Button variant="danger" onClick={handleRestoreConfirm}>実行</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm text-neutral-600">
          <div className="flex items-center gap-2 rounded-[12px] bg-amber-50 p-3 text-amber-800">
            <Database size={16} className="shrink-0" />
            <span>
              {mode === 'overwrite'
                ? 'IDが一致する既存レコードはバックアップの内容で上書きされます。'
                : '既存レコードはそのままで、新規レコードのみ追加されます。'}
            </span>
          </div>
          <p>ファイル: <span className="font-medium">{selectedFile?.name}</span></p>
        </div>
      </Modal>
    </div>
  );
}
