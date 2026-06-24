<?php

namespace App\Support;

use Illuminate\Support\Collection;

/**
 * 見積金額をサーバー側で再計算する単一の真実。フロント／取込いずれの経路でも
 * 明細 total・小計・消費税・合計をここで確定させ、入力された金額は信用しない。
 */
class QuotePricing
{
    /**
     * @param  array  $data  quote データ（items, tax_rate を含む）
     * @return array tax_amount / total_amount と再計算済み items を埋めた配列
     */
    public static function apply(array $data): array
    {
        $items = collect($data['items'] ?? [])->map(function ($it) {
            $qty = (int) ($it['quantity'] ?? 0);
            $unitPrice = (int) ($it['unit_price'] ?? 0);
            $it['total'] = $qty * $unitPrice;

            return $it;
        });

        $subtotal = $items->sum('total');
        $taxRate = (int) ($data['tax_rate'] ?? 10);
        $tax = (int) floor($subtotal * $taxRate / 100);

        $data['items'] = $items->values()->all();
        $data['tax_amount'] = $tax;
        $data['total_amount'] = $subtotal + $tax;

        return $data;
    }

    /** 明細から小計（税抜）を求める。検算・警告判定用。 */
    public static function subtotal(Collection|array $items): int
    {
        return collect($items)->sum(function ($it) {
            return (int) ($it['quantity'] ?? 0) * (int) ($it['unit_price'] ?? 0);
        });
    }
}
