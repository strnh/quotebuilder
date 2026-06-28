<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class BackupImport extends Command
{
    protected $signature = 'backup:import {file : バックアップJSONファイルのパス} {--mode=skip : 競合時の動作 (skip|overwrite)}';

    protected $description = 'JSONバックアップファイルから基本情報・顧客マスター・見積データをリストアします';

    public function handle(): int
    {
        $file = $this->argument('file');
        $mode = $this->option('mode');

        if (! in_array($mode, ['skip', 'overwrite'])) {
            $this->error('--mode は skip または overwrite を指定してください。');
            return self::FAILURE;
        }

        if (! file_exists($file)) {
            $this->error("ファイルが見つかりません: {$file}");
            return self::FAILURE;
        }

        $data = json_decode(file_get_contents($file), true);

        if (json_last_error() !== JSON_ERROR_NONE || ! is_array($data) || ! isset($data['version'])) {
            $this->error('有効なバックアップファイルではありません。');
            return self::FAILURE;
        }

        if ($data['version'] !== 1) {
            $this->error("サポートされていないバージョンです (version={$data['version']})。");
            return self::FAILURE;
        }

        $summary = ['inserted' => 0, 'skipped' => 0, 'updated' => 0, 'errors' => []];

        DB::transaction(function () use ($data, $mode, &$summary) {
            $this->restoreRows('sender_profiles', $data['sender_profiles'] ?? [], $mode, $summary);
            $this->restoreRows('customers', $data['customers'] ?? [], $mode, $summary);
            $this->restoreRows('quotes', $data['quotes'] ?? [], $mode, $summary, function (array $row): array {
                if (isset($row['items']) && is_array($row['items'])) {
                    $row['items'] = json_encode($row['items'], JSON_UNESCAPED_UNICODE);
                }
                return $row;
            });
        });

        $this->table(['挿入', 'スキップ', '更新', 'エラー'], [
            [$summary['inserted'], $summary['skipped'], $summary['updated'], count($summary['errors'])],
        ]);

        foreach ($summary['errors'] as $err) {
            $this->warn($err);
        }

        return self::SUCCESS;
    }

    private function restoreRows(string $table, array $rows, string $mode, array &$summary, ?callable $prepare = null): void
    {
        foreach ($rows as $row) {
            if ($prepare !== null) {
                $row = $prepare($row);
            }

            $exists = DB::table($table)->where('id', $row['id'])->exists();

            if ($exists && $mode === 'skip') {
                $summary['skipped']++;
                continue;
            }

            try {
                if ($exists) {
                    DB::table($table)->where('id', $row['id'])->update(
                        array_merge($row, ['updated_at' => now()->toDateTimeString()])
                    );
                    $summary['updated']++;
                } else {
                    DB::table($table)->insert($row);
                    $summary['inserted']++;
                }
            } catch (QueryException $e) {
                $isUnique = str_contains($e->getMessage(), 'UNIQUE') || str_contains((string) $e->getCode(), '23');
                if ($isUnique && $mode === 'skip') {
                    $summary['skipped']++;
                } elseif ($isUnique) {
                    $summary['errors'][] = "{$table}[id={$row['id']}]: 別レコードの UNIQUE 制約と衝突しました";
                } else {
                    throw $e;
                }
            }
        }
    }
}
