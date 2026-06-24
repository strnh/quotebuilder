import { useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, CheckCircle2, AlertTriangle, XCircle, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { importQuotes } from '../data/store';
import { Button, Card, Badge, EmptyState, useToast } from '../components/ui';
import PageHeader from '../components/PageHeader';
import type { ImportResult } from '../types';

const ACCEPT = '.xlsx,.ods';

function fileKey(f: File): string {
  return `${f.name}:${f.size}:${f.lastModified}`;
}

export default function Import() {
  const navigate = useNavigate();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<ImportResult[] | null>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming || incoming.length === 0) return;
    setFiles((prev) => {
      const seen = new Set(prev.map(fileKey));
      const merged = [...prev];
      for (const f of Array.from(incoming)) {
        if (!seen.has(fileKey(f))) merged.push(f);
      }
      return merged;
    });
  }

  function onPick(e: ChangeEvent<HTMLInputElement>) {
    addFiles(e.target.files);
    e.target.value = ''; // 同じファイルを連続選択できるようリセット
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function removeFile(key: string) {
    setFiles((prev) => prev.filter((f) => fileKey(f) !== key));
  }

  async function runImport() {
    if (files.length === 0) return;
    setImporting(true);
    setResults(null);
    try {
      const res = await importQuotes(files);
      setResults(res.results);
      setFiles([]);
      const failed = res.results.length - res.created;
      toast(
        `${res.created} 件を取り込みました${failed > 0 ? `（${failed} 件は失敗）` : ''}`,
        failed > 0 ? 'info' : 'success'
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : '取込に失敗しました', 'error');
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="見積書取込"
        description="御見積書ファイル（xlsx / ods）をアップロードして見積書を一括生成します。"
      />

      {/* ドロップゾーン */}
      <Card className="mb-6 p-6">
        <div
          role="button"
          tabIndex={0}
          aria-label="ファイルを選択、またはドラッグ&ドロップで追加"
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={clsx(
            'flex cursor-pointer flex-col items-center justify-center rounded-[16px] border-2 border-dashed px-6 py-10 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
            dragging ? 'border-primary bg-primary-50' : 'border-neutral-200 hover:border-primary/50 hover:bg-neutral-50'
          )}
        >
          <Upload size={32} className="mb-3 text-neutral-400" />
          <p className="text-sm font-medium text-neutral-700">クリックまたはドラッグ&ドロップでファイルを追加</p>
          <p className="mt-1 text-xs text-neutral-400">対応形式: xlsx / ods（複数選択可）</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            multiple
            onChange={onPick}
            className="hidden"
            data-testid="import-input"
          />
        </div>

        {/* 選択済みファイル */}
        {files.length > 0 && (
          <ul className="mt-4 space-y-2">
            {files.map((f) => (
              <li key={fileKey(f)} className="flex items-center gap-3 rounded-[12px] bg-neutral-50 px-3 py-2">
                <FileText size={16} className="shrink-0 text-neutral-400" />
                <span className="flex-1 truncate text-sm text-neutral-700">{f.name}</span>
                <span className="text-xs text-neutral-400">{Math.ceil(f.size / 1024)} KB</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(fileKey(f)); }}
                  className="text-neutral-400 hover:text-danger"
                  aria-label={`${f.name} を削除`}
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm text-neutral-500">{files.length} 件のファイル</span>
          <Button onClick={runImport} disabled={files.length === 0 || importing}>
            <Upload size={16} />
            {importing ? '取込中...' : '取込実行'}
          </Button>
        </div>
      </Card>

      {/* 取込結果 */}
      {results && (
        <Card className="p-6">
          <h2 className="mb-4 text-base font-bold text-neutral-800">取込結果</h2>
          {results.length === 0 ? (
            <EmptyState icon={FileText} title="結果がありません" />
          ) : (
            <ul className="space-y-3">
              {results.map((r, i) => {
                // 失敗結果（error を持つ）
                if ('error' in r) {
                  return (
                    <li key={`${r.filename}:${i}`} className="rounded-[16px] border border-danger/30 bg-danger/5 px-4 py-3">
                      <div className="flex items-start gap-3">
                        <XCircle size={18} className="mt-0.5 shrink-0 text-danger" />
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-sm text-neutral-700">{r.filename}</span>
                          <p className="mt-1 text-sm text-danger">{r.error}</p>
                        </div>
                      </div>
                    </li>
                  );
                }

                // 成功結果（quote_id を持つ）
                return (
                  <li key={`${r.filename}:${i}`} className="rounded-[16px] border border-neutral-200 bg-white px-4 py-3">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm text-neutral-700">{r.filename}</span>
                          {r.customer_matched
                            ? <Badge className="bg-success/10 text-success">取引先突合</Badge>
                            : <Badge className="bg-warning/10 text-warning">取引先未突合</Badge>}
                        </div>

                        {r.warnings.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {r.warnings.map((w, wi) => (
                              <li key={wi} className="flex items-start gap-1.5 text-xs text-warning">
                                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <Button variant="secondary" size="sm" onClick={() => navigate(`/quotes/${r.quote_id}`)}>
                        見積を開く
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
