<?php

namespace App\Services;

use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

class BackupRestorer
{
    /**
     * @return array{inserted: int, skipped: int, updated: int, errors: array<int, string>}
     */
    public function restore(array $data, string $mode): array
    {
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
            $this->restoreRows('customer_signatures', $signatureRows, $mode, $summary);

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

            $signature = $customer['customer_signature'];
            unset($customer['customer_signature']);

            if ($signature !== null && $signature !== '') {
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

    /**
     * @return array<int, int|string> 挿入または更新されたバックアップ側ID
     */
    private function restoreRows(string $table, array $rows, string $mode, array &$summary, ?callable $prepare = null): array
    {
        $restoredIds = [];

        foreach ($rows as $row) {
            if ($prepare !== null) {
                $row = $prepare($row);
            }

            $id = $row['id'] ?? null;
            $exists = $id !== null && DB::table($table)->where('id', $id)->exists();

            if ($exists && $mode === 'skip') {
                $summary['skipped']++;

                continue;
            }

            try {
                if ($exists) {
                    DB::table($table)->where('id', $id)->update(
                        array_merge($row, ['updated_at' => now()->toDateTimeString()])
                    );
                    $summary['updated']++;
                } else {
                    DB::table($table)->insert($row);
                    $summary['inserted']++;
                }

                if ($id !== null) {
                    $restoredIds[] = $id;
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
