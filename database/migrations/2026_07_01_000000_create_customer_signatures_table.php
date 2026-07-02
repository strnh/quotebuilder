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
        // 正規化（大文字化）でケース違いの識別子が衝突すると UNIQUE 制約で移行が停止するため、
        // テーブル作成より前に検出し、原因が分かるメッセージで失敗させる（失敗時に残骸を残さない）。
        $duplicates = DB::table('customers')
            ->selectRaw('upper(trim(customer_signature)) as sig, count(*) as n')
            ->whereNotNull('customer_signature')
            ->where('customer_signature', '!=', '')
            ->groupBy('sig')
            ->having('n', '>', 1)
            ->pluck('sig');

        if ($duplicates->isNotEmpty()) {
            throw new RuntimeException(
                '大文字化すると重複する取引先識別子があるため移行できません。事前に解消してください: '.$duplicates->implode(', ')
            );
        }

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
                        // 取込突合（ImportFilename は strtoupper で比較）に合わせて正規化する。
                        'signature' => strtoupper(trim($customer->customer_signature)),
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
            // 列は nullable のまま UNIQUE インデックスのみ付与する（change() は列定義変更となり
            // 環境により doctrine/dbal 依存になるため使わない）。識別子未登録顧客の NULL も許容される。
            $table->unique('customer_signature');
        });

        Schema::dropIfExists('customer_signatures');
    }
};
