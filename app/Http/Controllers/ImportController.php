<?php

namespace App\Http\Controllers;

use App\Models\Customer;
use App\Models\Quote;
use App\Models\SenderProfile;
use App\Support\ImportFilename;
use App\Support\QuotePricing;
use App\Support\QuoteSheetParser;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Throwable;

class ImportController extends Controller
{
    /** 取込対応の表計算拡張子（pdf はレイアウト依存のため現状未対応）。 */
    private const SHEET_EXTS = ['xlsx', 'ods'];

    /** 1 リクエストで受け付ける最大ファイル数（バッチ誤用・過負荷ガード）。 */
    private const MAX_FILES = 20;

    /**
     * 内容ベースの MIME 許可リスト（拡張子偽装対策）。xlsx/ods は zip コンテナのため、
     * 環境により finfo が application/zip と判定するケースも許容する。
     * 値は実ファイルの getMimeType() 実測に合わせている。
     */
    private const ALLOWED_MIMES = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
        'application/vnd.oasis.opendocument.spreadsheet',                    // ods
        'application/zip',
    ];

    /**
     * 御見積書ファイル（複数可）を取り込み、ファイル名で取引先を突合して Quote を生成する。
     * 1 ファイル単位で結果を返し、1 件の失敗で全体を止めない。
     *
     * バリデーション方針: バッチ形状の問題（ファイル無し・多すぎ）はリクエストレベルで 422、
     * ファイル単位の内容問題（形式不正・重複番号）は per-file の結果配列で非破壊に返す。
     */
    public function store(Request $request)
    {
        $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:'.self::MAX_FILES],
            'files.*' => ['file', 'max:10240'],
        ], [
            'files.max' => '一度に取り込めるファイルは最大 '.self::MAX_FILES.' 件です。',
        ]);

        $sender = SenderProfile::where('is_default', true)->first()
            ?? SenderProfile::orderBy('id')->first();
        $senderSnap = self::senderSnapshot($sender);

        $results = [];
        foreach ($request->file('files') as $file) {
            $results[] = $this->importOne($file, $senderSnap, $sender?->id);
        }

        return response()->json([
            'created' => collect($results)->whereNotNull('quote_id')->count(),
            'results' => $results,
        ], 201);
    }

    /**
     * @param  array<string,mixed>  $senderSnap
     * @return array<string,mixed>
     */
    private function importOne(UploadedFile $file, array $senderSnap, mixed $senderId): array
    {
        $name = $file->getClientOriginalName();
        $parsed = ImportFilename::parse($name);

        if ($parsed === null) {
            return ['filename' => $name, 'error' => 'ファイル名が規則 H-[識別子][YYYYMMDD][連番].(xlsx|ods|pdf) に一致しません'];
        }

        if (! in_array($parsed['ext'], self::SHEET_EXTS, true)) {
            return ['filename' => $name, 'error' => "{$parsed['ext']} は未対応です（xlsx / ods のみ取込可能）"];
        }

        // 拡張子偽装対策: 内容ベースの MIME を許可リストと突合（パース前に弾いて明確なエラーに）。
        // getMimeType() は環境により null を返しうるため 'unknown' にフォールバックしメッセージを明確に保つ。
        $mime = $file->getMimeType() ?? 'unknown';
        if (! in_array($mime, self::ALLOWED_MIMES, true)) {
            return ['filename' => $name, 'error' => "ファイル形式が不正です（検出された種別: {$mime}）"];
        }

        // 重複ガード（事前チェック）: quote_number はファイル名（拡張子抜き）由来。既存と重複する
        // 取込は行を二重生成せずスキップしてエラー報告する（重複行の生成こそが破壊的なため）。
        // Quote::create が即 insert するため、同一バッチ内の重複もこの DB チェックで拾える。
        // 並行リクエストで本チェックをすり抜けた場合は、後段の UNIQUE 制約違反捕捉が最終防壁になる。
        $quoteNumber = pathinfo($name, PATHINFO_FILENAME);
        if (Quote::where('quote_number', $quoteNumber)->exists()) {
            return ['filename' => $name, 'error' => "見積番号 {$quoteNumber} は既に存在します（重複のためスキップ）"];
        }

        try {
            $sheet = QuoteSheetParser::parse($file->getRealPath());
        } catch (Throwable $e) {
            return ['filename' => $name, 'error' => 'シート解析に失敗しました: '.$e->getMessage()];
        }

        $warnings = [];
        $customer = ImportFilename::matchCustomer($name);

        if ($customer === null) {
            $warnings[] = "取引先未突合: 識別子 {$parsed['signature']} に一致する取引先がありません（下書きとして保存）";
        }

        $customerSnap = $customer
            ? self::customerSnapshot($customer)
            : ['customer_name' => $sheet['customer_hint']];

        $data = QuotePricing::apply(array_merge($senderSnap, $customerSnap, [
            'sender_profile_id' => $senderId,
            'customer_id' => $customer?->id,
            'quote_number' => $quoteNumber,
            'subject' => $sheet['subject'],
            'status' => 'draft',
            'created_date' => $parsed['date'],
            'valid_period' => $sheet['valid_period'],
            'delivery_location' => $sheet['delivery_location'],
            'tax_rate' => $sheet['tax_rate'],
            'notes' => $sheet['notes'],
            'items' => $sheet['items'],
        ]));

        // シート記載の合計と再計算値の食い違いはレイアウトずれの兆候 → 警告のみ（保存値は再計算優先）
        if ($sheet['sheet_total'] !== null && $sheet['sheet_total'] !== $data['total_amount']) {
            $warnings[] = "合計不一致: シート {$sheet['sheet_total']} / 再計算 {$data['total_amount']}";
        }

        try {
            $quote = Quote::create($data);
        } catch (UniqueConstraintViolationException $e) {
            // 事前チェックをすり抜けた並行リクエストの最終防壁: DB の UNIQUE 制約が重複を弾く。
            return ['filename' => $name, 'error' => "見積番号 {$quoteNumber} は既に存在します（重複のためスキップ）"];
        }

        return [
            'filename' => $name,
            'quote_id' => $quote->id,
            'customer_id' => $customer?->id,
            'customer_matched' => $customer !== null,
            'warnings' => $warnings,
        ];
    }

    /** @return array<string,mixed> */
    private static function senderSnapshot(?SenderProfile $sender): array
    {
        if ($sender === null) {
            return [];
        }

        return collect($sender->toArray())->only([
            'sender_company', 'sender_zip', 'sender_pref', 'sender_city',
            'sender_address1', 'sender_address2', 'sender_person', 'sender_tel',
            'sender_fax', 'sender_logo_url',
        ])->all();
    }

    /** @return array<string,mixed> */
    private static function customerSnapshot(Customer $customer): array
    {
        return collect($customer->toArray())->only([
            'customer_name', 'customer_department', 'customer_person', 'customer_zip',
            'customer_pref', 'customer_city', 'customer_address1', 'customer_address2', 'customer_tel',
        ])->all();
    }
}
