<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Quote;
use App\Models\SenderProfile;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BackupController extends Controller
{
    public function download(): JsonResponse
    {
        return response()->json([
            'version' => 1,
            'exported_at' => now()->toIso8601String(),
            'sender_profiles' => SenderProfile::all()->toArray(),
            'customers' => Customer::all()->toArray(),
            'quotes' => Quote::all()->toArray(),
        ]);
    }

    public function restore(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'max:10240'],
            'mode' => ['required', 'in:skip,overwrite'],
        ]);

        $content = file_get_contents($request->file('file')->getRealPath());
        $data = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE || ! is_array($data) || ! isset($data['version'])) {
            throw ValidationException::withMessages(['file' => ['有効なバックアップファイルではありません。']]);
        }

        if ($data['version'] !== 1) {
            throw ValidationException::withMessages(['file' => ["サポートされていないバージョンです (version={$data['version']})。"]]);
        }

        $mode = $request->input('mode');
        $summary = ['inserted' => 0, 'skipped' => 0, 'updated' => 0, 'errors' => []];

        DB::transaction(function () use ($data, $mode, &$summary) {
            $this->restoreRows('sender_profiles', $data['sender_profiles'] ?? [], $mode, $summary);
            $this->restoreRows('customers', $data['customers'] ?? [], $mode, $summary);
            // quotes.items は JSON カラムなので DB::table insert 前にエンコードが必要
            $this->restoreRows('quotes', $data['quotes'] ?? [], $mode, $summary, function (array $row): array {
                if (isset($row['items']) && is_array($row['items'])) {
                    $row['items'] = json_encode($row['items'], JSON_UNESCAPED_UNICODE);
                }
                return $row;
            });
        });

        return response()->json($summary);
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
