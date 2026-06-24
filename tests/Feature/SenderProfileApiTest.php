<?php

namespace Tests\Feature;

use App\Models\SenderProfile;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SenderProfileApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_first_profile_becomes_default(): void
    {
        $this->postJson('/api/sender-profiles', ['sender_company' => '一社目'])
            ->assertCreated()
            ->assertJsonPath('is_default', true);
    }

    public function test_setting_default_unsets_others(): void
    {
        $a = SenderProfile::create(['sender_company' => 'A', 'is_default' => true]);
        $b = SenderProfile::create(['sender_company' => 'B', 'is_default' => false]);

        $this->putJson("/api/sender-profiles/{$b->id}", [
            'sender_company' => 'B',
            'is_default' => true,
        ])->assertOk();

        $this->assertDatabaseHas('sender_profiles', ['id' => $b->id, 'is_default' => true]);
        $this->assertDatabaseHas('sender_profiles', ['id' => $a->id, 'is_default' => false]);
        $this->assertSame(1, SenderProfile::where('is_default', true)->count());
    }

    public function test_deleting_default_promotes_another(): void
    {
        $a = SenderProfile::create(['sender_company' => 'A', 'is_default' => true]);
        SenderProfile::create(['sender_company' => 'B', 'is_default' => false]);

        $this->deleteJson("/api/sender-profiles/{$a->id}")->assertNoContent();

        $this->assertSame(1, SenderProfile::where('is_default', true)->count());
    }
}
