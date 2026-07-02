<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerSignature;
use App\Models\Quote;
use App\Models\SenderProfile;
use App\Services\BackupRestorer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class BackupController extends Controller
{
    public function download(): JsonResponse
    {
        return response()->json([
            'version' => BackupRestorer::VERSION,
            'exported_at' => now()->toIso8601String(),
            'sender_profiles' => SenderProfile::all()->toArray(),
            'customers' => Customer::all()->toArray(),
            'customer_signatures' => CustomerSignature::all()->toArray(),
            'quotes' => Quote::all()->toArray(),
        ]);
    }

    public function restore(Request $request, BackupRestorer $restorer): JsonResponse
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

        if (! in_array($data['version'], BackupRestorer::SUPPORTED_VERSIONS, true)) {
            throw ValidationException::withMessages(['file' => ["サポートされていないバージョンです (version={$data['version']})。"]]);
        }

        return response()->json($restorer->restore($data, $request->input('mode')));
    }
}
