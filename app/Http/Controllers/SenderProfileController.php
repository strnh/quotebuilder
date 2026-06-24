<?php

namespace App\Http\Controllers;

use App\Models\SenderProfile;
use Illuminate\Http\Request;

class SenderProfileController extends Controller
{
    public function index()
    {
        return SenderProfile::orderByDesc('is_default')->orderByDesc('created_at')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        // 最初の1件は自動的にデフォルト
        if (SenderProfile::count() === 0) {
            $data['is_default'] = true;
        }
        $profile = SenderProfile::create($data);
        $this->ensureSingleDefault($profile);

        return response()->json($profile->fresh(), 201);
    }

    public function show(SenderProfile $senderProfile)
    {
        return $senderProfile;
    }

    public function update(Request $request, SenderProfile $senderProfile)
    {
        $senderProfile->update($this->validated($request));
        $this->ensureSingleDefault($senderProfile);

        return $senderProfile->fresh();
    }

    public function destroy(SenderProfile $senderProfile)
    {
        $wasDefault = $senderProfile->is_default;
        $senderProfile->delete();
        // デフォルトを消したら残りの先頭をデフォルトに昇格
        if ($wasDefault) {
            $next = SenderProfile::orderByDesc('created_at')->first();
            $next?->update(['is_default' => true]);
        }

        return response()->noContent();
    }

    // is_default が true の場合、他をすべて false にする
    private function ensureSingleDefault(SenderProfile $profile): void
    {
        if ($profile->is_default) {
            SenderProfile::where('id', '!=', $profile->id)->update(['is_default' => false]);
        }
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            'sender_company' => ['required', 'string', 'max:255'],
            'sender_zip' => ['nullable', 'string', 'max:20'],
            'sender_pref' => ['nullable', 'string', 'max:50'],
            'sender_city' => ['nullable', 'string', 'max:255'],
            'sender_address1' => ['nullable', 'string', 'max:255'],
            'sender_address2' => ['nullable', 'string', 'max:255'],
            'sender_person' => ['nullable', 'string', 'max:255'],
            'sender_tel' => ['nullable', 'string', 'max:50'],
            'sender_fax' => ['nullable', 'string', 'max:50'],
            'sender_logo_url' => ['nullable', 'string'],
            'is_default' => ['nullable', 'boolean'],
        ]);
    }
}
