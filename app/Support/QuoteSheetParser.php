<?php

namespace App\Support;

use PhpOffice\PhpSpreadsheet\IOFactory;

/**
 * 御見積書テンプレート（xlsx/ods）を解析し、Quote 生成に必要なシート由来フィールドを取り出す。
 *
 * 取引先・発行者・見積番号・見積日はシートからは取らない（突合した取引先マスタ／既定 SenderProfile／
 * ファイル名から確定する）。ここで拾うのは件名・納入場所・見積有効期限・備考・明細・税率と、検算用の合計。
 *
 * セル位置はテンプレート固定だが、ラベル探索とヘッダ行検出でレイアウトの軽微なズレに耐える。
 */
class QuoteSheetParser
{
    /**
     * @return array{subject:string,customer_hint:string,delivery_location:string,valid_period:string,notes:string,tax_rate:int,items:array<int,array<string,mixed>>,sheet_total:?int}
     */
    public static function parse(string $path): array
    {
        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        $sheet = $reader->load($path)->getActiveSheet();

        // 列アルファベットをキーに 1 始まり行番号で全セルを取得
        $rows = $sheet->toArray(null, true, false, true);

        return [
            'subject' => self::labeledValue($rows, '件名'),
            'customer_hint' => self::customerHint($rows),
            'delivery_location' => self::labeledValue($rows, '納入場所'),
            'valid_period' => self::labeledValue($rows, '見積有効期限'),
            'notes' => self::notes($rows),
            'tax_rate' => self::taxRate($rows),
            'items' => self::items($rows),
            'sheet_total' => self::sheetTotal($rows),
        ];
    }

    /** B列上部の「〇〇 御中」から宛名を取り出す（突合失敗時の customer_name フォールバック）。 */
    private static function customerHint(array $rows): string
    {
        foreach ($rows as $row) {
            $b = (string) ($row['B'] ?? '');
            if (str_contains($b, '御中')) {
                return trim(preg_replace('/[\s\x{3000}]*御中[\s\x{3000}]*$/u', '', $b) ?? '');
            }
        }

        return '';
    }

    /** 空白（半角・全角）と末尾コロンを除いた比較用文字列。 */
    private static function norm(mixed $v): string
    {
        $s = preg_replace('/[\s\x{3000}]+/u', '', (string) $v) ?? '';

        return rtrim($s, '：:');
    }

    /** B列ラベルが $needle で始まる行を探し、C列の値を返す。 */
    private static function labeledValue(array $rows, string $needle): string
    {
        foreach ($rows as $row) {
            if (str_starts_with(self::norm($row['B'] ?? ''), $needle)) {
                return trim((string) ($row['C'] ?? ''));
            }
        }

        return '';
    }

    /** 「備考」行の次行 B列を備考本文として返す。 */
    private static function notes(array $rows): string
    {
        $rowNumbers = array_keys($rows);
        foreach ($rowNumbers as $i => $r) {
            if (str_starts_with(self::norm($rows[$r]['A'] ?? ''), '備考')) {
                $next = $rowNumbers[$i + 1] ?? null;

                return $next !== null ? trim((string) ($rows[$next]['B'] ?? '')) : '';
            }
        }

        return '';
    }

    /** 「消費税(NN%)」表記から税率を抽出。見つからなければ既定 10。 */
    private static function taxRate(array $rows): int
    {
        foreach ($rows as $row) {
            foreach ($row as $cell) {
                if (preg_match('/消費税.*?\((\d+)%\)/u', (string) $cell, $m)) {
                    return (int) $m[1];
                }
            }
        }

        return 10;
    }

    /** 合計（税込）セルの値。検算・警告用。見つからなければ null。 */
    private static function sheetTotal(array $rows): ?int
    {
        foreach ($rows as $row) {
            foreach ($row as $cell) {
                if (self::norm($cell) === '合計') {
                    return isset($row['I']) && $row['I'] !== '' ? (int) $row['I'] : null;
                }
            }
        }

        return null;
    }

    /**
     * 「№」ヘッダ行を検出し、以降の明細行を読む。空の商品名行か「以下余白」で打ち切る。
     *
     * @return array<int,array<string,mixed>>
     */
    private static function items(array $rows): array
    {
        $rowNumbers = array_keys($rows);

        $headerIdx = null;
        foreach ($rowNumbers as $i => $r) {
            if (self::norm($rows[$r]['A'] ?? '') === '№') {
                $headerIdx = $i;
                break;
            }
        }

        if ($headerIdx === null) {
            return [];
        }

        $items = [];
        foreach (array_slice($rowNumbers, $headerIdx + 1) as $r) {
            $row = $rows[$r];
            $name = trim((string) ($row['B'] ?? ''));

            if ($name === '' || self::norm($name) === '以下余白') {
                break;
            }

            $items[] = [
                'name' => $name,
                'spec' => trim((string) ($row['D'] ?? '')),
                'quantity' => (int) ($row['E'] ?? 0),
                'unit' => trim((string) ($row['F'] ?? '')),
                'standard_price' => (int) ($row['G'] ?? 0),
                'unit_price' => (int) ($row['H'] ?? 0),
            ];
        }

        return $items;
    }
}
