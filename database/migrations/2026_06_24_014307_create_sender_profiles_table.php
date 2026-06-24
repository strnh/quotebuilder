<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('sender_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('sender_company');
            $table->string('sender_zip')->nullable();
            $table->string('sender_pref')->nullable();
            $table->string('sender_city')->nullable();
            $table->string('sender_address1')->nullable();
            $table->string('sender_address2')->nullable();
            $table->string('sender_person')->nullable();
            $table->string('sender_tel')->nullable();
            $table->string('sender_fax')->nullable();
            $table->longText('sender_logo_url')->nullable();
            $table->boolean('is_default')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sender_profiles');
    }
};
