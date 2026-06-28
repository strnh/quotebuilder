<?php

use App\Http\Controllers\BackupController;
use App\Http\Controllers\CustomerController;
use App\Http\Controllers\ImportController;
use App\Http\Controllers\QuoteController;
use App\Http\Controllers\SenderProfileController;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

// v1: 認証はフロント側モック（メール/パスワードのみ）。API は同一オリジンの SPA からのみ利用。
Route::apiResource('customers', CustomerController::class);
Route::apiResource('sender-profiles', SenderProfileController::class);
Route::apiResource('quotes', QuoteController::class);

// 御見積書ファイル（xlsx/ods）取込: ファイル名で取引先突合し Quote を生成
Route::post('quotes/import', [ImportController::class, 'store']);

// バックアップ・リストア
Route::get('backup/download', [BackupController::class, 'download']);
Route::post('backup/restore', [BackupController::class, 'restore']);

// テスト/デモ用: DB をデモデータに初期化（local 環境のみ）
Route::post('test/reset', function () {
    abort_unless(app()->environment('local', 'testing'), 403);
    Artisan::call('migrate:fresh', ['--seed' => true, '--force' => true]);

    return response()->json(['ok' => true]);
});
