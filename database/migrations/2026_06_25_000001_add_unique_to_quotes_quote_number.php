<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * quote_number に UNIQUE 制約を追加し、重複した見積番号の生成を DB レベルで防ぐ。
     * 取込の事前チェックをすり抜ける並行リクエストへの最終防壁（Issue #3）。
     * nullable は維持: UNIQUE インデックスは複数 NULL を許容するため、quote_number 未設定の
     * 手動作成（QuoteController）は従来どおり複数行を作れる。
     */
    public function up(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->unique('quote_number');
        });
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropUnique(['quote_number']);
        });
    }
};
