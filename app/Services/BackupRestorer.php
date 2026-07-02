<?php

namespace App\Services;

use Illuminate\Database\QueryException;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BackupRestorer
{
    /** エクスポート形式のバージョン。2 で customers から customer_signatures を分離した。 */
    public const VERSION = 2;

    /** 復元を受け付けるバージョン。1 は customers[].customer_signature を含む旧形式。 */
    public const SUPPORTED_VERSIONS = [1, 2];

    /**
     * @return array{inserted: int, skipped: int, updated: int, errors: array<int, string>}
     */
    public function restore(array $data, string $mode): array
    {
        $this->validateRows($data);
        $data = $this->normalizeLegacyCustomerSignatures($data);
        $summary = ['inserted' => 0, 'skipped' => 0, 'updated' => 0, 'errors' => []];

        DB::transaction(function () use ($data, $mode, &$summary) {
            $this->restoreRows('sender_profiles', $data['sender_profiles'] ?? [], $mode, $summary);
            $restoredCustomerIds = $this->restoreRows('customers', $data['customers'] ?? [], $mode, $summary);

            $signatureRows = [];
            foreach ($data['customer_signatures'] ?? [] as $row) {
                if (in_array($row['customer_id'] ?? null, $restoredCustomerIds, true)) {
                    $signatureRows[] = $row;
                } else {
                    // skip された親や存在しない親の識別子を、同じIDの別顧客へ紐付けない。
                    $summary['skipped']++;
                }
            }
            $this->restoreRows('customer_signatures', $signatureRows, $mode, $summary, function (array $row): array {
                // 取込突合（ImportFilename は strtoupper で比較）と UNIQUE 判定を正規化後の値で行う。
                $row['signature'] = self::normalizeSignature($row['signature']);

                return $row;
            });

            $this->restoreRows('quotes', $data['quotes'] ?? [], $mode, $summary, function (array $row): array {
                if (isset($row['items']) && is_array($row['items'])) {
                    $row['items'] = json_encode($row['items'], JSON_UNESCAPED_UNICODE);
                }

                return $row;
            });
        });

        return $summary;
    }

    /**
     * テーブルダンプとして最低限必要な行形式・主キー・NOT NULL カラムを検証する。
     * ここで弾かないと DB の制約違反（500）になるカラムのみを対象とする。
     */
    private function validateRows(array $data): void
    {
        $requiredColumns = [
            'sender_profiles' => ['sender_company'],
            'customers' => ['customer_name'],
            'customer_signatures' => ['customer_id', 'signature'],
            'quotes' => [],
        ];

        foreach ($requiredColumns as $table => $columns) {
            if (! array_key_exists($table, $data)) {
                continue;
            }

            if (! is_array($data[$table])) {
                throw ValidationException::withMessages([
                    'file' => ["{$table} は配列である必要があります。"],
                ]);
            }

            foreach ($data[$table] as $index => $row) {
                if (! is_array($row) || ! array_key_exists('id', $row)) {
                    throw ValidationException::withMessages([
                        'file' => ["{$table}.{$index} は id を持つオブジェクトである必要があります。"],
                    ]);
                }

                if ($row['id'] !== null && ! is_scalar($row['id'])) {
                    throw ValidationException::withMessages([
                        'file' => ["{$table}.{$index} の id が不正です。"],
                    ]);
                }

                foreach ($columns as $column) {
                    // 配列などの非スカラ値は DB 例外（500）になる前に 422 で拒否する。
                    if (! is_scalar($row[$column] ?? null) || $row[$column] === '') {
                        throw ValidationException::withMessages([
                            'file' => ["{$table}.{$index} に {$column}（スカラ値）が必要です。"],
                        ]);
                    }
                }
            }
        }
    }

    /**
     * 旧 version 1 の customers[].customer_signature を新しい子テーブル形式へ変換する。
     */
    private function normalizeLegacyCustomerSignatures(array $data): array
    {
        $customers = $data['customers'] ?? [];
        $signatures = $data['customer_signatures'] ?? [];

        foreach ($customers as &$customer) {
            if (! array_key_exists('customer_signature', $customer)) {
                continue;
            }

            $signature = self::normalizeSignature($customer['customer_signature']);
            unset($customer['customer_signature']);

            if ($signature !== '') {
                $signatures[] = [
                    'customer_id' => $customer['id'],
                    'signature' => $signature,
                    'created_at' => $customer['created_at'] ?? null,
                    'updated_at' => $customer['updated_at'] ?? null,
                ];
            }
        }
        unset($customer);

        $data['customers'] = $customers;
        $data['customer_signatures'] = $signatures;

        return $data;
    }

    /** 取引先識別子の正規化（CustomerController の登録時と同じ規約）。 */
    public static function normalizeSignature(mixed $signature): string
    {
        return is_scalar($signature) ? strtoupper(trim((string) $signature)) : '';
    }

    /**
     * @return array<int, int|string> 挿入または更新されたバックアップ側ID
     */
    private function restoreRows(string $table, array $rows, string $mode, array &$summary, ?callable $prepare = null): array
    {
        $restoredIds = [];

        // 行ごとの exists() で 2N クエリにならないよう、対象IDの存在判定を先にまとめて取得する。
        $ids = array_values(array_filter(array_column($rows, 'id'), fn ($id) => $id !== null));
        $existingIds = [];
        foreach (array_chunk($ids, 500) as $chunk) {
            foreach (DB::table($table)->whereIn('id', $chunk)->pluck('id') as $existingId) {
                $existingIds[(string) $existingId] = true;
            }
        }

        foreach ($rows as $row) {
            if ($prepare !== null) {
                $row = $prepare($row);
            }

            $id = $row['id'] ?? null;
            $exists = $id !== null && isset($existingIds[(string) $id]);

            if ($exists && $mode === 'skip') {
                $summary['skipped']++;

                continue;
            }

            try {
                if ($exists) {
                    DB::table($table)->where('id', $id)->update(Arr::except($row, ['id']));
                    $summary['updated']++;
                } else {
                    DB::table($table)->insert($row);
                    $summary['inserted']++;
                }

                if ($id !== null) {
                    $restoredIds[] = $id;
                    // 同じファイル内に同一IDが再出現した場合も既存扱いにする。
                    $existingIds[(string) $id] = true;
                }
            } catch (QueryException $e) {
                $message = strtolower($e->getMessage());
                $isUnique = str_contains($message, 'unique constraint')
                    || str_contains($message, 'duplicate entry')
                    || str_contains($message, 'duplicate key');
                if ($isUnique && $mode === 'skip') {
                    $summary['skipped']++;
                } elseif ($isUnique) {
                    $summary['errors'][] = "{$table}[id=".($id ?? 'new').']: 別レコードの UNIQUE 制約と衝突しました';
                } else {
                    throw $e;
                }
            }
        }

        return $restoredIds;
    }
}
