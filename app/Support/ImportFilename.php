<?php

namespace App\Support;

use App\Models\Customer;
use App\Models\CustomerSignature;

/**
 * 取込ファイル名の規則 `H-[取引先識別子][日付(YYYYMMDD)][連番(任意2桁)].拡張子` を解釈し、
 * 取引先識別子（customer_signatures.signature、1取引先が複数登録可）で取引先マスタへ突合する。
 *
 * 例: H-CMK2026062401.xlsx → signature=CMK / date=2026-06-24 / sequence=01
 */
class ImportFilename
{
    /** 末尾の「日付8桁（＋連番2桁・任意）」をアンカー固定し、残りを識別子として分離する。 */
    private const PATTERN = '/^H-([A-Za-z0-9]+?)(\d{8})(\d{2})?\.(xlsx|ods|pdf)$/i';

    /**
     * @return array{signature:string,date:string,sequence:?string,ext:string}|null
     */
    public static function parse(string $filename): ?array
    {
        if (! preg_match(self::PATTERN, basename($filename), $m)) {
            return null;
        }

        $year = (int) substr($m[2], 0, 4);
        $month = (int) substr($m[2], 4, 2);
        $day = (int) substr($m[2], 6, 2);

        if (! checkdate($month, $day, $year)) {
            return null;
        }

        return [
            'signature' => strtoupper($m[1]),
            'date' => sprintf('%04d-%02d-%02d', $year, $month, $day),
            'sequence' => ($m[3] ?? '') !== '' ? $m[3] : null,
            'ext' => strtolower($m[4]),
        ];
    }

    /** ファイル名の取引先識別子で取引先マスタを引く。一致しなければ null。 */
    public static function matchCustomer(string $filename): ?Customer
    {
        $parsed = self::parse($filename);

        if ($parsed === null) {
            return null;
        }

        return CustomerSignature::where('signature', $parsed['signature'])->first()?->customer;
    }
}
