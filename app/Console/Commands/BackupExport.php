<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Models\CustomerSignature;
use App\Models\Quote;
use App\Models\SenderProfile;
use Illuminate\Console\Command;

class BackupExport extends Command
{
    protected $signature = 'backup:export {--output= : 出力先ファイルパス（省略時は stdout）}';

    protected $description = '基本情報・顧客マスター・見積データをJSONファイルにエクスポートします';

    public function handle(): int
    {
        $payload = json_encode([
            'version' => 1,
            'exported_at' => now()->toIso8601String(),
            'sender_profiles' => SenderProfile::all()->toArray(),
            'customers' => Customer::all()->toArray(),
            'customer_signatures' => CustomerSignature::all()->toArray(),
            'quotes' => Quote::all()->toArray(),
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        $output = $this->option('output');

        if ($output) {
            file_put_contents($output, $payload);
            $this->info("エクスポート完了: {$output}");
        } else {
            $this->line($payload);
        }

        return self::SUCCESS;
    }
}
