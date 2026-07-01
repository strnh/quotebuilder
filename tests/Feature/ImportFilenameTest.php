<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Support\ImportFilename;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ImportFilenameTest extends TestCase
{
    use RefreshDatabase;

    public function test_parses_signature_date_and_sequence(): void
    {
        $this->assertSame(
            ['signature' => 'CMK', 'date' => '2026-06-24', 'sequence' => '01', 'ext' => 'xlsx'],
            ImportFilename::parse('H-CMK2026062401.xlsx'),
        );
    }

    public function test_parses_pdf_and_ods_extensions(): void
    {
        $this->assertSame('pdf', ImportFilename::parse('H-CMK2026062401.pdf')['ext']);
        $this->assertSame('ods', ImportFilename::parse('H-CMK2026062401.ods')['ext']);
    }

    public function test_parses_without_sequence(): void
    {
        $parsed = ImportFilename::parse('H-CMK20260624.xlsx');
        $this->assertSame('CMK', $parsed['signature']);
        $this->assertSame('2026-06-24', $parsed['date']);
        $this->assertNull($parsed['sequence']);
    }

    public function test_strips_directory_path(): void
    {
        $this->assertSame('CMK', ImportFilename::parse('/var/uploads/H-CMK2026062401.pdf')['signature']);
    }

    #[DataProvider('invalidNames')]
    public function test_invalid_filenames_return_null(string $filename): void
    {
        $this->assertNull(ImportFilename::parse($filename));
    }

    public static function invalidNames(): array
    {
        return [
            'プレフィックスなし' => ['foo.xlsx'],
            '日付桁不足' => ['H-CMK202606.xlsx'],
            '未対応拡張子' => ['H-CMK2026062401.docx'],
            '不正な日付' => ['H-CMK2026130101.xlsx'],
            '識別子なし' => ['H-2026062401.xlsx'],
        ];
    }

    public function test_matches_customer_by_signature(): void
    {
        $customer = Customer::create(['customer_name' => '株式会社カマキ']);
        $customer->signatures()->create(['signature' => 'CMK']);

        $this->assertSame($customer->id, ImportFilename::matchCustomer('H-CMK2026062401.pdf')->id);
        // ファイル名の大小混在でも解決
        $this->assertSame($customer->id, ImportFilename::matchCustomer('H-cmk2026062401.pdf')->id);
        // 未登録識別子は null
        $this->assertNull(ImportFilename::matchCustomer('H-XXX2026062401.pdf'));
    }

    public function test_matches_customer_by_any_of_multiple_signatures(): void
    {
        $customer = Customer::create(['customer_name' => '株式会社ワイイングス']);
        $customer->signatures()->createMany([
            ['signature' => 'WEI'],
            ['signature' => 'WEIENG'],
        ]);

        $this->assertSame($customer->id, ImportFilename::matchCustomer('H-WEI2026062401.pdf')->id);
        $this->assertSame($customer->id, ImportFilename::matchCustomer('H-WEIENG2026062401.pdf')->id);
    }
}
