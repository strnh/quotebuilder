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
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->string('quote_number')->nullable();
            $table->string('subject')->nullable();
            $table->string('status')->default('draft'); // draft|sent|accepted|rejected
            $table->date('created_date')->nullable();    // 見積日
            $table->date('valid_until')->nullable();      // 有効期限
            $table->string('valid_period')->nullable();   // 見積有効期限
            $table->string('delivery_location')->nullable();
            $table->string('delivery_date')->nullable();
            $table->string('payment_terms')->nullable();
            $table->unsignedInteger('tax_rate')->default(10);
            $table->text('notes')->nullable();

            // 発行者スナップショット
            $table->foreignId('sender_profile_id')->nullable();
            $table->string('sender_company')->nullable();
            $table->string('sender_zip')->nullable();
            $table->string('sender_pref')->nullable();
            $table->string('sender_city')->nullable();
            $table->string('sender_address1')->nullable();
            $table->string('sender_address2')->nullable();
            $table->string('sender_person')->nullable();
            $table->string('sender_tel')->nullable();
            $table->string('sender_fax')->nullable();
            $table->longText('sender_logo_url')->nullable();

            // 取引先スナップショット
            $table->foreignId('customer_id')->nullable();
            $table->string('customer_name')->nullable();
            $table->string('customer_department')->nullable();
            $table->string('customer_person')->nullable();
            $table->string('customer_zip')->nullable();
            $table->string('customer_pref')->nullable();
            $table->string('customer_city')->nullable();
            $table->string('customer_address1')->nullable();
            $table->string('customer_address2')->nullable();
            $table->string('customer_tel')->nullable();

            // 明細・金額
            $table->json('items')->nullable();
            $table->bigInteger('total_amount')->default(0);
            $table->bigInteger('tax_amount')->default(0);

            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('quotes');
    }
};
