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
        Schema::create('customers', function (Blueprint $table) {
            $table->id();
            $table->string('customer_name');
            $table->string('customer_signature')->unique(); // 取引先識別子（ファイル名 H-[識別子][日付] に使用 / 英数字）
            $table->string('customer_department')->nullable();
            $table->string('customer_person')->nullable();
            $table->string('customer_zip')->nullable();
            $table->string('customer_pref')->nullable();
            $table->string('customer_city')->nullable();
            $table->string('customer_address1')->nullable();
            $table->string('customer_address2')->nullable();
            $table->string('customer_tel')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customers');
    }
};
