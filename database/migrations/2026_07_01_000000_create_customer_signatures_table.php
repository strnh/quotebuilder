<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('customer_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('customer_id')->constrained()->cascadeOnDelete();
            $table->string('signature')->unique();
            $table->timestamps();
        });

        DB::table('customers')
            ->select(['id', 'customer_signature', 'created_at', 'updated_at'])
            ->chunkById(500, function ($customers) {
                foreach ($customers as $customer) {
                    if (($customer->customer_signature ?? '') === '') {
                        continue;
                    }

                    DB::table('customer_signatures')->insert([
                        'customer_id' => $customer->id,
                        'signature' => $customer->customer_signature,
                        'created_at' => $customer->created_at,
                        'updated_at' => $customer->updated_at,
                    ]);
                }
            });

        Schema::table('customers', function (Blueprint $table) {
            $table->dropUnique(['customer_signature']);
            $table->dropColumn('customer_signature');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('customers', function (Blueprint $table) {
            $table->string('customer_signature')->nullable()->after('customer_name');
        });

        DB::table('customer_signatures')->chunkById(500, function ($signatures) {
            foreach ($signatures as $row) {
                DB::table('customers')->where('id', $row->customer_id)
                    ->whereNull('customer_signature')
                    ->update(['customer_signature' => $row->signature]);
            }
        });

        Schema::table('customers', function (Blueprint $table) {
            $table->string('customer_signature')->nullable(false)->unique()->change();
        });

        Schema::dropIfExists('customer_signatures');
    }
};
