<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Quote;
use Database\Seeders\DemoSeeder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class QuoteApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_quotes_index_returns_seeded_data(): void
    {
        $this->seed(DemoSeeder::class);

        $res = $this->getJson('/api/quotes');
        $res->assertOk()->assertJsonCount(3);
    }

    public function test_store_quote_recalculates_totals_server_side(): void
    {
        // フロントが誤った total を送っても、サーバー側で再計算される
        $payload = [
            'quote_number' => 'Q-TEST-001',
            'customer_name' => 'テスト取引先',
            'status' => 'draft',
            'tax_rate' => 10,
            'items' => [
                ['name' => '商品A', 'quantity' => 3, 'unit_price' => 1000, 'total' => 99999],
                ['name' => '商品B', 'quantity' => 2, 'unit_price' => 500, 'total' => 0],
            ],
        ];

        $res = $this->postJson('/api/quotes', $payload);

        // 小計 = 3*1000 + 2*500 = 4000, 税 = 400, 合計 = 4400
        $res->assertCreated()
            ->assertJsonPath('total_amount', 4400)
            ->assertJsonPath('tax_amount', 400)
            ->assertJsonPath('items.0.total', 3000);

        $this->assertDatabaseHas('quotes', ['quote_number' => 'Q-TEST-001', 'total_amount' => 4400]);
    }

    public function test_quote_requires_valid_status(): void
    {
        $this->postJson('/api/quotes', ['status' => 'invalid'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('status');
    }

    public function test_update_and_delete_quote(): void
    {
        $quote = Quote::create(['quote_number' => 'Q-1', 'status' => 'draft', 'items' => []]);

        $this->putJson("/api/quotes/{$quote->id}", [
            'status' => 'accepted',
            'subject' => '更新後',
            'items' => [['name' => 'X', 'quantity' => 1, 'unit_price' => 100]],
        ])->assertOk()->assertJsonPath('status', 'accepted')->assertJsonPath('total_amount', 110);

        $this->deleteJson("/api/quotes/{$quote->id}")->assertNoContent();
        $this->assertDatabaseMissing('quotes', ['id' => $quote->id]);
    }

    public function test_store_rejects_duplicate_quote_number(): void
    {
        Quote::create(['quote_number' => 'Q-DUP-001', 'items' => []]);

        // 既存と重複する見積番号は 500 ではなく 422（validate と同形式）で弾く
        $this->postJson('/api/quotes', ['quote_number' => 'Q-DUP-001'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('quote_number');

        $this->assertSame(1, Quote::where('quote_number', 'Q-DUP-001')->count());
    }

    public function test_allows_multiple_quotes_without_quote_number(): void
    {
        // nullable: 番号なし下書きは UNIQUE 制約の対象外で複数作成できる
        $this->postJson('/api/quotes', ['subject' => '番号なし1'])->assertCreated();
        $this->postJson('/api/quotes', ['subject' => '番号なし2'])->assertCreated();

        $this->assertSame(2, Quote::whereNull('quote_number')->count());
    }

    public function test_update_keeping_own_quote_number_is_allowed(): void
    {
        // 自分自身の番号は ignore されるため、番号を変えない更新は衝突しない
        $quote = Quote::create(['quote_number' => 'Q-KEEP-001', 'status' => 'draft', 'items' => []]);

        $this->putJson("/api/quotes/{$quote->id}", [
            'quote_number' => 'Q-KEEP-001',
            'status' => 'sent',
        ])->assertOk()->assertJsonPath('status', 'sent');
    }

    public function test_update_to_another_existing_quote_number_is_rejected(): void
    {
        Quote::create(['quote_number' => 'Q-A', 'items' => []]);
        $quote = Quote::create(['quote_number' => 'Q-B', 'items' => []]);

        $this->putJson("/api/quotes/{$quote->id}", ['quote_number' => 'Q-A'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('quote_number');
    }

    public function test_quote_number_unique_constraint_is_enforced_at_db_level(): void
    {
        // バリデーションをすり抜けた並行 insert への最終防壁（取込の race backstop）
        Quote::create(['quote_number' => 'Q-RACE', 'items' => []]);

        $this->expectException(UniqueConstraintViolationException::class);
        Quote::create(['quote_number' => 'Q-RACE', 'items' => []]);
    }

    public function test_customer_requires_name(): void
    {
        $this->postJson('/api/customers', [])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['customer_name', 'signatures']);

        $this->postJson('/api/customers', ['customer_name' => '株式会社テスト', 'signatures' => ['TESTCO']])
            ->assertCreated()
            ->assertJsonPath('customer_name', '株式会社テスト')
            ->assertJsonPath('signatures.0', 'TESTCO');
    }

    public function test_customer_signature_is_normalized_and_unique(): void
    {
        $existing = Customer::create(['customer_name' => '既存社']);
        $existing->signatures()->create(['signature' => 'CMK']);

        // 小文字入力でも大文字へ正規化して保存
        $this->postJson('/api/customers', ['customer_name' => '新規社', 'signatures' => ['abc']])
            ->assertCreated()
            ->assertJsonPath('signatures.0', 'ABC');

        // 大小違いでも既存と衝突するため 422（500 にならない）
        $this->postJson('/api/customers', ['customer_name' => '重複社', 'signatures' => ['cmk']])
            ->assertStatus(422)
            ->assertJsonValidationErrors('signatures.0');
    }

    public function test_customer_can_have_multiple_signatures(): void
    {
        $res = $this->postJson('/api/customers', ['customer_name' => '株式会社ワイイングス', 'signatures' => ['WEI', 'WEIENG']])
            ->assertCreated();

        $this->assertSame(['WEI', 'WEIENG'], $res->json('signatures'));
    }
}
