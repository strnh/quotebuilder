<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Quote;
use App\Models\SenderProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class BackupTest extends TestCase
{
    use RefreshDatabase;

    // ---------- download ----------

    public function test_download_returns_correct_structure(): void
    {
        SenderProfile::create(['sender_company' => '株式会社テスト']);
        $customer = Customer::create(['customer_name' => 'テスト商事']);
        $customer->signatures()->create(['signature' => 'TEST']);
        Quote::create(['quote_number' => 'Q-001', 'items' => [['name' => '商品A']]]);

        $res = $this->getJson('/api/backup/download');

        $res->assertOk()
            ->assertJsonStructure(['version', 'exported_at', 'sender_profiles', 'customers', 'customer_signatures', 'quotes'])
            ->assertJsonPath('version', 1)
            ->assertJsonCount(1, 'sender_profiles')
            ->assertJsonCount(1, 'customers')
            ->assertJsonCount(1, 'customer_signatures')
            ->assertJsonCount(1, 'quotes')
            ->assertJsonPath('quotes.0.items.0.name', '商品A');
    }

    public function test_download_empty_db_returns_empty_arrays(): void
    {
        $res = $this->getJson('/api/backup/download');

        $res->assertOk()
            ->assertJsonPath('sender_profiles', [])
            ->assertJsonPath('customers', [])
            ->assertJsonPath('customer_signatures', [])
            ->assertJsonPath('quotes', []);
    }

    // ---------- restore: skip モード ----------

    public function test_restore_skip_inserts_new_records(): void
    {
        $payload = $this->makeBackup(
            senderProfiles: [['id' => 1, 'sender_company' => '株式会社A', 'is_default' => false, 'created_at' => now(), 'updated_at' => now()]],
            customers: [['id' => 1, 'customer_name' => 'テスト商事', 'created_at' => now(), 'updated_at' => now()]],
            customerSignatures: [['id' => 1, 'customer_id' => 1, 'signature' => 'TEST', 'created_at' => now(), 'updated_at' => now()]],
            quotes: [['id' => 1, 'quote_number' => 'Q-001', 'status' => 'draft', 'items' => [], 'total_amount' => 0, 'tax_amount' => 0, 'tax_rate' => 10, 'created_at' => now(), 'updated_at' => now()]],
        );

        $res = $this->postRestore($payload);

        $res->assertOk()->assertJsonPath('inserted', 4)->assertJsonPath('skipped', 0)->assertJsonPath('updated', 0);
        $this->assertDatabaseHas('sender_profiles', ['sender_company' => '株式会社A']);
        $this->assertDatabaseHas('customers', ['customer_name' => 'テスト商事']);
        $this->assertDatabaseHas('customer_signatures', ['signature' => 'TEST']);
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

    public function test_restore_accepts_legacy_version_one_customer_signature(): void
    {
        $payload = json_encode([
            'version' => 1,
            'customers' => [[
                'id' => 10,
                'customer_name' => '旧形式商事',
                'customer_signature' => 'LEGACY',
                'created_at' => now(),
                'updated_at' => now(),
            ]],
            'quotes' => [],
            'sender_profiles' => [],
        ]);

        $this->postRestore($payload)->assertOk()
            ->assertJsonPath('inserted', 2)
            ->assertJsonPath('errors', []);

        $this->assertDatabaseHas('customers', ['id' => 10, 'customer_name' => '旧形式商事']);
        $this->assertDatabaseHas('customer_signatures', ['customer_id' => 10, 'signature' => 'LEGACY']);
    }

    public function test_restore_skip_does_not_attach_signature_to_skipped_customer(): void
    {
        $existing = Customer::create(['customer_name' => '既存A社']);
        $payload = $this->makeBackup(
            customers: [['id' => $existing->id, 'customer_name' => 'バックアップB社', 'created_at' => now(), 'updated_at' => now()]],
            customerSignatures: [['id' => 99, 'customer_id' => $existing->id, 'signature' => 'BETA', 'created_at' => now(), 'updated_at' => now()]],
        );

        $this->postRestore($payload)->assertOk()
            ->assertJsonPath('inserted', 0)
            ->assertJsonPath('skipped', 2);

        $this->assertDatabaseMissing('customer_signatures', ['signature' => 'BETA']);
        $this->assertDatabaseHas('customers', ['id' => $existing->id, 'customer_name' => '既存A社']);
    }

    // ---------- restore: overwrite モード ----------

    public function test_restore_overwrite_updates_existing_record(): void
    {
        $sp = SenderProfile::create(['sender_company' => '元の会社名']);
        $snapshotTime = now()->subDays(3)->startOfSecond()->toDateTimeString();

        $payload = $this->makeBackup(
            senderProfiles: [['id' => $sp->id, 'sender_company' => '上書き後の名前', 'is_default' => false, 'created_at' => $snapshotTime, 'updated_at' => $snapshotTime]],
        );

        $res = $this->postMultipart('/api/backup/restore', $payload, 'overwrite');

        $res->assertOk()->assertJsonPath('updated', 1)->assertJsonPath('inserted', 0);
        $this->assertDatabaseHas('sender_profiles', [
            'id' => $sp->id,
            'sender_company' => '上書き後の名前',
            'created_at' => $snapshotTime,
            'updated_at' => $snapshotTime,
        ]);
    }

    public function test_restore_overwrite_updates_customer_and_its_signature(): void
    {
        $customer = Customer::create(['customer_name' => '更新前A社']);
        $signature = $customer->signatures()->create(['signature' => 'BEFORE']);
        $payload = $this->makeBackup(
            customers: [['id' => $customer->id, 'customer_name' => '更新後B社', 'created_at' => now(), 'updated_at' => now()]],
            customerSignatures: [['id' => $signature->id, 'customer_id' => $customer->id, 'signature' => 'AFTER', 'created_at' => now(), 'updated_at' => now()]],
        );

        $this->postMultipart('/api/backup/restore', $payload, 'overwrite')->assertOk()
            ->assertJsonPath('updated', 2)
            ->assertJsonPath('errors', []);

        $this->assertDatabaseHas('customers', ['id' => $customer->id, 'customer_name' => '更新後B社']);
        $this->assertDatabaseHas('customer_signatures', ['id' => $signature->id, 'signature' => 'AFTER']);
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

    public function test_restore_rejects_non_array_table_rows(): void
    {
        $payload = json_encode(['version' => 1, 'customers' => 'invalid']);

        $this->postRestore($payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    public function test_restore_rejects_row_without_id(): void
    {
        $payload = json_encode(['version' => 1, 'customers' => [['customer_name' => 'IDなし商事']]]);

        $this->postRestore($payload)
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
            customers: [['id' => 1, 'customer_name' => 'CLI 商事', 'created_at' => now(), 'updated_at' => now()]],
            customerSignatures: [['id' => 1, 'customer_id' => 1, 'signature' => 'CLI', 'created_at' => now(), 'updated_at' => now()]],
        ));

        $this->artisan("backup:import {$path}")->assertSuccessful();
        $this->assertDatabaseHas('customer_signatures', ['signature' => 'CLI']);

        unlink($path);
    }

    public function test_artisan_import_accepts_legacy_version_one_customer_signature(): void
    {
        $path = sys_get_temp_dir().'/backup-import-legacy-'.uniqid().'.json';
        file_put_contents($path, json_encode([
            'version' => 1,
            'customers' => [[
                'id' => 20,
                'customer_name' => 'CLI 旧形式商事',
                'customer_signature' => 'CLILEGACY',
                'created_at' => now(),
                'updated_at' => now(),
            ]],
        ]));

        $this->artisan("backup:import {$path}")->assertSuccessful();
        $this->assertDatabaseHas('customer_signatures', ['customer_id' => 20, 'signature' => 'CLILEGACY']);

        unlink($path);
    }

    public function test_artisan_import_skip_does_not_attach_signature_to_skipped_customer(): void
    {
        $existing = Customer::create(['customer_name' => 'CLI 既存A社']);
        $path = sys_get_temp_dir().'/backup-import-collision-'.uniqid().'.json';
        file_put_contents($path, $this->makeBackup(
            customers: [['id' => $existing->id, 'customer_name' => 'CLI バックアップB社', 'created_at' => now(), 'updated_at' => now()]],
            customerSignatures: [['id' => 199, 'customer_id' => $existing->id, 'signature' => 'CLIBETA', 'created_at' => now(), 'updated_at' => now()]],
        ));

        $this->artisan("backup:import {$path} --mode=skip")->assertSuccessful();
        $this->assertDatabaseMissing('customer_signatures', ['signature' => 'CLIBETA']);

        unlink($path);
    }

    public function test_artisan_import_rejects_row_without_id(): void
    {
        $path = sys_get_temp_dir().'/backup-import-invalid-'.uniqid().'.json';
        file_put_contents($path, json_encode([
            'version' => 1,
            'customers' => [['customer_name' => 'IDなし商事']],
        ]));

        $this->artisan("backup:import {$path}")
            ->assertFailed()
            ->expectsOutputToContain('id を持つオブジェクト');

        unlink($path);
    }

    // ---------- ヘルパー ----------

    private function makeBackup(array $senderProfiles = [], array $customers = [], array $customerSignatures = [], array $quotes = []): string
    {
        return json_encode([
            'version' => 1,
            'exported_at' => now()->toIso8601String(),
            'sender_profiles' => $senderProfiles,
            'customers' => $customers,
            'customer_signatures' => $customerSignatures,
            'quotes' => $quotes,
        ]);
    }

    /** multipart/form-data で /api/backup/restore を呼ぶ */
    private function postRestore(string $payload, string $mode = 'skip'): TestResponse
    {
        $file = UploadedFile::fake()->createWithContent('backup.json', $payload);

        return $this->call('POST', '/api/backup/restore', ['mode' => $mode], [], ['file' => $file], ['Accept' => 'application/json']);
    }

    private function postMultipart(string $url, string $payload, string $mode): TestResponse
    {
        $file = UploadedFile::fake()->createWithContent('backup.json', $payload);

        return $this->call('POST', $url, ['mode' => $mode], [], ['file' => $file], ['Accept' => 'application/json']);
    }
}
