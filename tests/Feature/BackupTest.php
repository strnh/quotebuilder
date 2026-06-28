<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Quote;
use App\Models\SenderProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class BackupTest extends TestCase
{
    use RefreshDatabase;

    // ---------- download ----------

    public function test_download_returns_correct_structure(): void
    {
        SenderProfile::create(['sender_company' => '株式会社テスト']);
        Customer::create(['customer_name' => 'テスト商事', 'customer_signature' => 'TEST']);
        Quote::create(['quote_number' => 'Q-001', 'items' => [['name' => '商品A']]]);

        $res = $this->getJson('/api/backup/download');

        $res->assertOk()
            ->assertJsonStructure(['version', 'exported_at', 'sender_profiles', 'customers', 'quotes'])
            ->assertJsonPath('version', 1)
            ->assertJsonCount(1, 'sender_profiles')
            ->assertJsonCount(1, 'customers')
            ->assertJsonCount(1, 'quotes')
            ->assertJsonPath('quotes.0.items.0.name', '商品A');
    }

    public function test_download_empty_db_returns_empty_arrays(): void
    {
        $res = $this->getJson('/api/backup/download');

        $res->assertOk()
            ->assertJsonPath('sender_profiles', [])
            ->assertJsonPath('customers', [])
            ->assertJsonPath('quotes', []);
    }

    // ---------- restore: skip モード ----------

    public function test_restore_skip_inserts_new_records(): void
    {
        $payload = $this->makeBackup(
            senderProfiles: [['id' => 1, 'sender_company' => '株式会社A', 'is_default' => false, 'created_at' => now(), 'updated_at' => now()]],
            customers: [['id' => 1, 'customer_name' => 'テスト商事', 'customer_signature' => 'TEST', 'created_at' => now(), 'updated_at' => now()]],
            quotes: [['id' => 1, 'quote_number' => 'Q-001', 'status' => 'draft', 'items' => [], 'total_amount' => 0, 'tax_amount' => 0, 'tax_rate' => 10, 'created_at' => now(), 'updated_at' => now()]],
        );

        $res = $this->postRestore($payload);

        $res->assertOk()->assertJsonPath('inserted', 3)->assertJsonPath('skipped', 0)->assertJsonPath('updated', 0);
        $this->assertDatabaseHas('sender_profiles', ['sender_company' => '株式会社A']);
        $this->assertDatabaseHas('customers', ['customer_signature' => 'TEST']);
        $this->assertDatabaseHas('quotes', ['quote_number' => 'Q-001']);
    }

    public function test_restore_skip_does_not_overwrite_existing_record(): void
    {
        $sp = SenderProfile::create(['sender_company' => '元の会社名']);

        $payload = $this->makeBackup(
            senderProfiles: [['id' => $sp->id, 'sender_company' => '上書きしたい名前', 'is_default' => false, 'created_at' => now(), 'updated_at' => now()]],
        );

        $res = $this->postRestore($payload);

        $res->assertOk()->assertJsonPath('skipped', 1)->assertJsonPath('inserted', 0);
        $this->assertDatabaseHas('sender_profiles', ['sender_company' => '元の会社名']);
    }

    // ---------- restore: overwrite モード ----------

    public function test_restore_overwrite_updates_existing_record(): void
    {
        $sp = SenderProfile::create(['sender_company' => '元の会社名']);

        $payload = $this->makeBackup(
            senderProfiles: [['id' => $sp->id, 'sender_company' => '上書き後の名前', 'is_default' => false, 'created_at' => now(), 'updated_at' => now()]],
        );

        $res = $this->postMultipart('/api/backup/restore', $payload, 'overwrite');

        $res->assertOk()->assertJsonPath('updated', 1)->assertJsonPath('inserted', 0);
        $this->assertDatabaseHas('sender_profiles', ['sender_company' => '上書き後の名前']);
    }

    // ---------- バリデーション ----------

    public function test_restore_rejects_missing_file(): void
    {
        $this->postJson('/api/backup/restore', ['mode' => 'skip'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    public function test_restore_rejects_invalid_mode(): void
    {
        $payload = $this->makeBackup();
        $this->postRestore($payload, 'invalid')
            ->assertStatus(422)
            ->assertJsonValidationErrors('mode');
    }

    public function test_restore_rejects_invalid_json(): void
    {
        $file = UploadedFile::fake()->createWithContent('backup.json', 'not-json');

        $this->call('POST', '/api/backup/restore', ['mode' => 'skip'], [], ['file' => $file], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    public function test_restore_rejects_unsupported_version(): void
    {
        $payload = json_encode(['version' => 99, 'sender_profiles' => [], 'customers' => [], 'quotes' => []]);
        $file = UploadedFile::fake()->createWithContent('backup.json', $payload);

        $this->call('POST', '/api/backup/restore', ['mode' => 'skip'], [], ['file' => $file], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    // ---------- artisan ----------

    public function test_artisan_export_outputs_valid_json(): void
    {
        SenderProfile::create(['sender_company' => 'CLI テスト社']);

        $this->artisan('backup:export')->assertSuccessful();
    }

    public function test_artisan_export_writes_to_file(): void
    {
        $path = sys_get_temp_dir().'/backup-test-'.uniqid().'.json';
        $this->artisan("backup:export --output={$path}")->assertSuccessful();

        $data = json_decode(file_get_contents($path), true);
        $this->assertSame(1, $data['version']);

        unlink($path);
    }

    public function test_artisan_import_inserts_records(): void
    {
        $path = sys_get_temp_dir().'/backup-import-'.uniqid().'.json';
        file_put_contents($path, $this->makeBackup(
            customers: [['id' => 1, 'customer_name' => 'CLI 商事', 'customer_signature' => 'CLI', 'created_at' => now(), 'updated_at' => now()]],
        ));

        $this->artisan("backup:import {$path}")->assertSuccessful();
        $this->assertDatabaseHas('customers', ['customer_signature' => 'CLI']);

        unlink($path);
    }

    // ---------- ヘルパー ----------

    private function makeBackup(array $senderProfiles = [], array $customers = [], array $quotes = []): string
    {
        return json_encode([
            'version' => 1,
            'exported_at' => now()->toIso8601String(),
            'sender_profiles' => $senderProfiles,
            'customers' => $customers,
            'quotes' => $quotes,
        ]);
    }

    /** multipart/form-data で /api/backup/restore を呼ぶ */
    private function postRestore(string $payload, string $mode = 'skip'): \Illuminate\Testing\TestResponse
    {
        $file = UploadedFile::fake()->createWithContent('backup.json', $payload);
        return $this->call('POST', '/api/backup/restore', ['mode' => $mode], [], ['file' => $file], ['Accept' => 'application/json']);
    }

    private function postMultipart(string $url, string $payload, string $mode): \Illuminate\Testing\TestResponse
    {
        $file = UploadedFile::fake()->createWithContent('backup.json', $payload);
        return $this->call('POST', $url, ['mode' => $mode], [], ['file' => $file], ['Accept' => 'application/json']);
    }
}
