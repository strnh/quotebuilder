<?php

namespace App\Console\Commands;

use App\Services\BackupRestorer;
use Illuminate\Console\Command;
use Illuminate\Validation\ValidationException;

class BackupImport extends Command
{
    protected $signature = 'backup:import {file : バックアップJSONファイルのパス} {--mode=skip : 競合時の動作 (skip|overwrite)}';

    protected $description = 'JSONバックアップファイルから基本情報・顧客マスター・見積データをリストアします';

    public function handle(BackupRestorer $restorer): int
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

        if (! in_array($data['version'], BackupRestorer::SUPPORTED_VERSIONS, true)) {
            $this->error("サポートされていないバージョンです (version={$data['version']})。");

            return self::FAILURE;
        }

        try {
            $summary = $restorer->restore($data, $mode);
        } catch (ValidationException $e) {
            $this->error($e->errors()['file'][0] ?? 'バックアップファイルの形式が不正です。');

            return self::FAILURE;
        }

        $this->table(['挿入', 'スキップ', '更新', 'エラー'], [
            [$summary['inserted'], $summary['skipped'], $summary['updated'], count($summary['errors'])],
        ]);

        foreach ($summary['errors'] as $err) {
            $this->warn($err);
        }

        return self::SUCCESS;
    }
}
