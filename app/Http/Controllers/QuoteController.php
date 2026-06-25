<?php

namespace App\Http\Controllers;

use App\Models\Quote;
use App\Support\QuotePricing;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class QuoteController extends Controller
{
    public function index()
    {
        return Quote::orderByDesc('created_date')->orderByDesc('id')->get();
    }

    public function store(Request $request)
    {
        $data = QuotePricing::apply($this->validated($request));

        return response()->json(Quote::create($data), 201);
    }

    public function show(Quote $quote)
    {
        return $quote;
    }

    public function update(Request $request, Quote $quote)
    {
        $quote->update(QuotePricing::apply($this->validated($request)));

        return $quote->fresh();
    }

    public function destroy(Quote $quote)
    {
        $quote->delete();

        return response()->noContent();
    }

    private function validated(Request $request): array
    {
        return $request->validate([
            // quote_number は DB の UNIQUE 制約と対になる重複ガード（Issue #3）。
            // nullable のため未設定（null）は対象外＝複数の番号なし下書きは従来どおり作成可能。
            'quote_number' => [
                'nullable', 'string', 'max:100',
                Rule::unique('quotes', 'quote_number')->ignore($request->route('quote')),
            ],
            'subject' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'in:draft,sent,accepted,rejected'],
            'created_date' => ['nullable', 'date'],
            'valid_until' => ['nullable', 'date'],
            'valid_period' => ['nullable', 'string', 'max:255'],
            'delivery_location' => ['nullable', 'string', 'max:255'],
            'delivery_date' => ['nullable', 'string', 'max:255'],
            'payment_terms' => ['nullable', 'string', 'max:255'],
            'tax_rate' => ['nullable', 'integer', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string'],

            'sender_profile_id' => ['nullable'],
            'sender_company' => ['nullable', 'string', 'max:255'],
            'sender_zip' => ['nullable', 'string', 'max:20'],
            'sender_pref' => ['nullable', 'string', 'max:50'],
            'sender_city' => ['nullable', 'string', 'max:255'],
            'sender_address1' => ['nullable', 'string', 'max:255'],
            'sender_address2' => ['nullable', 'string', 'max:255'],
            'sender_person' => ['nullable', 'string', 'max:255'],
            'sender_tel' => ['nullable', 'string', 'max:50'],
            'sender_fax' => ['nullable', 'string', 'max:50'],
            'sender_logo_url' => ['nullable', 'string'],

            'customer_id' => ['nullable'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_department' => ['nullable', 'string', 'max:255'],
            'customer_person' => ['nullable', 'string', 'max:255'],
            'customer_zip' => ['nullable', 'string', 'max:20'],
            'customer_pref' => ['nullable', 'string', 'max:50'],
            'customer_city' => ['nullable', 'string', 'max:255'],
            'customer_address1' => ['nullable', 'string', 'max:255'],
            'customer_address2' => ['nullable', 'string', 'max:255'],
            'customer_tel' => ['nullable', 'string', 'max:50'],

            'items' => ['nullable', 'array'],
            'items.*.name' => ['nullable', 'string', 'max:255'],
            'items.*.spec' => ['nullable', 'string', 'max:255'],
            'items.*.quantity' => ['nullable', 'numeric'],
            'items.*.unit' => ['nullable', 'string', 'max:50'],
            'items.*.standard_price' => ['nullable', 'numeric'],
            'items.*.unit_price' => ['nullable', 'numeric'],
            'items.*.total' => ['nullable', 'numeric'],
        ]);
    }
}
