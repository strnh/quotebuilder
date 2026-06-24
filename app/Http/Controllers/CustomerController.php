<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class CustomerController extends Controller
{
    public function index()
    {
        return Customer::orderByDesc('created_at')->get();
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        return response()->json(Customer::create($data), 201);
    }

    public function show(Customer $customer)
    {
        return $customer;
    }

    public function update(Request $request, Customer $customer)
    {
        $customer->update($this->validated($request));

        return $customer;
    }

    public function destroy(Customer $customer)
    {
        $customer->delete();

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        // 取込突合のため signature は大文字へ正規化。unique 判定を正規化後の値で行うため validate より前に merge する。
        $request->merge(['customer_signature' => strtoupper((string) $request->input('customer_signature'))]);

        return $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_signature' => [
                'required', 'string', 'max:50', 'regex:/^[A-Za-z0-9]+$/',
                Rule::unique('customers', 'customer_signature')->ignore($request->route('customer')),
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
