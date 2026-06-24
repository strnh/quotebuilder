<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Quote;
use App\Models\SenderProfile;
use App\Support\QuoteSheetParser;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class QuoteImportTest extends TestCase
{
    use RefreshDatabase;

    private const FIXTURE = __DIR__.'/../Fixtures/H-CMK2026062401.xlsx';

    private function upload(string $clientName = 'H-CMK2026062401.xlsx'): UploadedFile
    {
        // fake() は空ファイルになり PhpSpreadsheet が読めないため、実体を test:true で渡す
        return new UploadedFile(self::FIXTURE, $clientName, null, null, true);
    }

    public function test_parser_extracts_sheet_fields(): void
    {
        $parsed = QuoteSheetParser::parse(self::FIXTURE);

        $this->assertSame('UPS 一式', $parsed['subject']);
        $this->assertSame('ご指定場所', $parsed['delivery_location']);
        $this->assertSame('お見積り日から30日以内', $parsed['valid_period']);
        $this->assertSame('中央鍍金工業協同組合', $parsed['customer_hint']);
        $this->assertSame(10, $parsed['tax_rate']);
        $this->assertSame(36894, $parsed['sheet_total']);

        $this->assertCount(2, $parsed['items']);
        $this->assertSame('BR550S-JP E', $parsed['items'][0]['name']);
        $this->assertSame('500VA UPS', $parsed['items'][0]['spec']);
        $this->assertSame(1, $parsed['items'][0]['quantity']);
        $this->assertSame(27040, $parsed['items'][0]['unit_price']);
        $this->assertSame('設置作業', $parsed['items'][1]['name']);
        $this->assertSame(6500, $parsed['items'][1]['unit_price']);
    }

    public function test_imports_xlsx_and_matches_customer(): void
    {
        $this->seed(DemoSeeder::class);
        $cmk = Customer::where('customer_signature', 'CMK')->firstOrFail();

        $res = $this->postJson('/api/quotes/import', ['files' => [$this->upload()]]);

        $res->assertCreated()
            ->assertJsonPath('created', 1)
            ->assertJsonPath('results.0.customer_matched', true)
            ->assertJsonPath('results.0.customer_id', $cmk->id)
            ->assertJsonPath('results.0.warnings', []);

        $quoteId = $res->json('results.0.quote_id');
        $quote = Quote::findOrFail($quoteId);

        // 取引先スナップショットは突合レコード由来、件名はシート由来、見積日はファイル名由来
        $this->assertSame('株式会社カマキ', $quote->customer_name);
        $this->assertSame('UPS 一式', $quote->subject);
        $this->assertSame('2026-06-24', $quote->created_date->format('Y-m-d'));
        $this->assertSame('H-CMK2026062401', $quote->quote_number);
        $this->assertSame('draft', $quote->status);

        // 金額はサーバー側再計算: 小計 33540, 税 3354, 合計 36894（シート I38 と一致）
        $this->assertSame(33540 + 3354, $quote->total_amount);
        $this->assertSame(3354, $quote->tax_amount);
        $this->assertSame(27040, $quote->items[0]['total']);
    }

    public function test_unmatched_customer_creates_draft_with_warning(): void
    {
        SenderProfile::create(['sender_company' => '自社', 'is_default' => true]);
        // CMK 取引先を作らずに取込 → 突合失敗
        $res = $this->postJson('/api/quotes/import', ['files' => [$this->upload()]]);

        $res->assertCreated()
            ->assertJsonPath('created', 1)
            ->assertJsonPath('results.0.customer_matched', false)
            ->assertJsonPath('results.0.customer_id', null);

        $this->assertNotEmpty($res->json('results.0.warnings'));

        $quote = Quote::findOrFail($res->json('results.0.quote_id'));
        $this->assertNull($quote->customer_id);
        // フォールバックでシートの宛名を customer_name に採用
        $this->assertSame('中央鍍金工業協同組合', $quote->customer_name);
    }

    public function test_invalid_filename_is_reported_without_creating_quote(): void
    {
        SenderProfile::create(['sender_company' => '自社', 'is_default' => true]);

        $res = $this->postJson('/api/quotes/import', ['files' => [$this->upload('invalid.xlsx')]]);

        $res->assertCreated()
            ->assertJsonPath('created', 0);
        $this->assertArrayHasKey('error', $res->json('results.0'));
        $this->assertSame(0, Quote::count());
    }

    public function test_pdf_extension_is_rejected_as_unsupported(): void
    {
        SenderProfile::create(['sender_company' => '自社', 'is_default' => true]);

        $res = $this->postJson('/api/quotes/import', ['files' => [$this->upload('H-CMK2026062401.pdf')]]);

        $res->assertCreated()->assertJsonPath('created', 0);
        $this->assertStringContainsString('未対応', $res->json('results.0.error'));
    }

    public function test_requires_files(): void
    {
        $this->postJson('/api/quotes/import', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors('files');
    }
}
