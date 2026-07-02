<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\CustomerSignature;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CustomerController extends Controller
{
    public function index()
    {
        return Customer::with('signatures')->orderByDesc('created_at')->get()
            ->map(fn (Customer $c) => $this->present($c));
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);
        $signatures = $data['signatures'];
        unset($data['signatures']);

        $customer = DB::transaction(function () use ($data, $signatures) {
            $customer = Customer::create($data);
            $customer->signatures()->createMany(
                array_map(fn (string $s) => ['signature' => $s], $signatures)
            );

            return $customer;
        });

        return response()->json($this->present($customer->load('signatures')), 201);
    }

    public function show(Customer $customer)
    {
        return $this->present($customer->load('signatures'));
    }

    public function update(Request $request, Customer $customer)
    {
        $data = $this->validated($request);
        $signatures = $data['signatures'];
        unset($data['signatures']);

        DB::transaction(function () use ($customer, $data, $signatures) {
            $customer->update($data);
            $customer->signatures()->delete();
            $customer->signatures()->createMany(
                array_map(fn (string $s) => ['signature' => $s], $signatures)
            );
        });

        return $this->present($customer->fresh('signatures'));
    }

    /** フロントには signatures を関連レコードではなく文字列配列として渡す。 */
    private function present(Customer $customer): array
    {
        $data = $customer->toArray();
        $data['signatures'] = $customer->signatures->pluck('signature')->values()->all();

        return $data;
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        // 取込突合のため signature は大文字へ正規化・重複除去。unique 判定を正規化後の値で行うため validate より前に merge する。
        // 配列以外の入力は正規化せずそのまま validate へ渡し、array ルールで 422 にする。
        $signatures = $request->input('signatures', []);
        if (is_array($signatures)) {
            $signatures = array_values(array_unique(array_map(
                fn ($s) => strtoupper((string) $s),
                $signatures
            )));
            $request->merge(['signatures' => $signatures]);
        }

        return $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'signatures' => ['required', 'array', 'min:1'],
            'signatures.*' => [
                'string', 'max:50', 'regex:/^[A-Za-z0-9]+$/',
                function ($attribute, $value, $fail) use ($request) {
                    $exists = CustomerSignature::where('signature', $value)
                        ->when($request->route('customer'), fn ($q, $c) => $q->where('customer_id', '!=', $c->id))
                        ->exists();
                    if ($exists) {
                        $fail("識別子 {$value} は既に他の取引先で使用されています。");
                    }
                },
            ],
            'customer_department' => ['nullable', 'string', 'max:255'],
            'customer_person' => ['nullable', 'string', 'max:255'],
            'customer_zip' => ['nullable', 'string', 'max:20'],
            'customer_pref' => ['nullable', 'string', 'max:50'],
            'customer_city' => ['nullable', 'string', 'max:255'],
            'customer_address1' => ['nullable', 'string', 'max:255'],
            'customer_address2' => ['nullable', 'string', 'max:255'],
            'customer_tel' => ['nullable', 'string', 'max:50'],
        ]);
    }
}
