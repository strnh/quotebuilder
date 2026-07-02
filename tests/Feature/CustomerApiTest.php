<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CustomerApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_store_normalizes_signatures_to_uppercase(): void
    {
        $this->postJson('/api/customers', [
            'customer_name' => 'テスト商事',
            'signatures' => ['abc', 'ABC', 'def'],
        ])->assertCreated()
            ->assertJsonPath('signatures', ['ABC', 'DEF']);

        $this->assertDatabaseHas('customer_signatures', ['signature' => 'ABC']);
        $this->assertDatabaseHas('customer_signatures', ['signature' => 'DEF']);
    }

    public function test_store_rejects_non_array_signatures(): void
    {
        // 文字列を配列へ暗黙変換せず、array ルールで 422 にする。
        $this->postJson('/api/customers', [
            'customer_name' => 'テスト商事',
            'signatures' => 'ABC',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('signatures');
    }
}
