<?php

namespace Database\Seeders;

use App\Models\Customer;
use App\Models\Quote;
use App\Models\SenderProfile;
use Illuminate\Database\Seeder;

class DemoSeeder extends Seeder
{
    /**
     * デモ/開発/テスト用のダミーデータを投入する。
     *
     * ここで作る取引先（取込サンプルと突合する「株式会社カマキ」(CMK) 等）や
     * サンプル見積はすべてデモ用であり、production には投入しない想定。
     * production の通常デプロイは `php artisan migrate --force`（--seed なし）で
     * seeder を走らせないが、誤って `db:seed` された場合に備え、ここでも
     * production 環境では安全に skip してデモデータが本番に混入しないようにする。
     */
    public function run(): void
    {
        if (app()->environment('production')) {
            $this->command?->warn('DemoSeeder はデモ用のため production では実行しません。');

            return;
        }

        $sender = SenderProfile::create([
            'sender_company' => '株式会社ゼンセールス',
            'sender_zip' => '150-0002',
            'sender_pref' => '東京都',
            'sender_city' => '渋谷区',
            'sender_address1' => '渋谷2-1-1',
            'sender_address2' => 'ゼンビル 8F',
            'sender_person' => '山田 太郎',
            'sender_tel' => '03-1234-5678',
            'sender_fax' => '03-1234-5679',
            'sender_logo_url' => '',
            'is_default' => true,
        ]);

        $c1 = Customer::create([
            'customer_name' => '株式会社アルファ商事',
            'customer_department' => '購買部',
            'customer_person' => '田中 花子',
            'customer_zip' => '100-0005',
            'customer_pref' => '東京都',
            'customer_city' => '千代田区',
            'customer_address1' => '丸の内1-1-1',
            'customer_tel' => '03-9876-5432',
        ]);
        $c1->signatures()->create(['signature' => 'ALPHA']);

        $c2 = Customer::create([
            'customer_name' => 'ベータ工業株式会社',
            'customer_department' => '資材課',
            'customer_person' => '佐藤 一郎',
            'customer_zip' => '220-0011',
            'customer_pref' => '神奈川県',
            'customer_city' => '横浜市西区',
            'customer_address1' => 'みなとみらい3-2-1',
            'customer_tel' => '045-111-2222',
        ]);
        $c2->signatures()->create(['signature' => 'BETA']);

        // 取込サンプル artifacts/H-CMK2026062401.{xlsx,pdf} と突合できる取引先
        $c3 = Customer::create([
            'customer_name' => '株式会社カマキ',
            'customer_department' => '調達部',
            'customer_person' => '鈴木 次郎',
            'customer_zip' => '530-0001',
            'customer_pref' => '大阪府',
            'customer_city' => '大阪市北区',
            'customer_address1' => '梅田1-1-1',
            'customer_tel' => '06-1234-5678',
        ]);
        $c3->signatures()->create(['signature' => 'CMK']);

        $senderSnap = collect($sender->toArray())
            ->only([
                'sender_company', 'sender_zip', 'sender_pref', 'sender_city',
                'sender_address1', 'sender_address2', 'sender_person', 'sender_tel',
                'sender_fax', 'sender_logo_url',
            ])->all();

        $customerSnap = fn (Customer $c) => collect($c->toArray())
            ->only([
                'customer_name', 'customer_department', 'customer_person', 'customer_zip',
                'customer_pref', 'customer_city', 'customer_address1', 'customer_address2', 'customer_tel',
            ])->all();

        $mkItems = fn (array $rows) => array_map(
            fn ($r) => array_merge($r, ['total' => $r['quantity'] * $r['unit_price']]),
            $rows
        );

        $year = now()->year;

        $this->createQuote(array_merge($senderSnap, $customerSnap($c1), [
            'sender_profile_id' => $sender->id,
            'customer_id' => $c1->id,
            'quote_number' => "Q-{$year}06-001",
            'subject' => 'Webシステム開発一式',
            'status' => 'accepted',
            'created_date' => "{$year}-06-02",
            'valid_until' => "{$year}-06-30",
            'valid_period' => 'お見積り日から１０日以内',
            'delivery_location' => 'ご指定場所',
            'delivery_date' => "{$year}/09/30",
            'payment_terms' => '月末締め翌月末払い',
            'tax_rate' => 10,
            'notes' => 'ご不明な点はお気軽にお問い合わせください。',
            'items' => $mkItems([
                ['name' => '要件定義', 'spec' => '一式', 'quantity' => 1, 'unit' => '式', 'standard_price' => 600000, 'unit_price' => 500000],
                ['name' => '設計・開発', 'spec' => 'フロント/バック', 'quantity' => 1, 'unit' => '式', 'standard_price' => 1500000, 'unit_price' => 1300000],
                ['name' => '保守サポート', 'spec' => '12ヶ月', 'quantity' => 12, 'unit' => 'ヶ月', 'standard_price' => 50000, 'unit_price' => 40000],
            ]),
        ]));

        $this->createQuote(array_merge($senderSnap, $customerSnap($c2), [
            'sender_profile_id' => $sender->id,
            'customer_id' => $c2->id,
            'quote_number' => "Q-{$year}06-002",
            'subject' => '事務用品定期納入',
            'status' => 'sent',
            'created_date' => "{$year}-06-15",
            'valid_until' => "{$year}-07-15",
            'valid_period' => 'お見積り日から１０日以内',
            'delivery_location' => 'ご指定場所',
            'delivery_date' => "{$year}/07/01",
            'payment_terms' => '月末締め翌月末払い',
            'tax_rate' => 10,
            'items' => $mkItems([
                ['name' => 'コピー用紙', 'spec' => 'A4 500枚', 'quantity' => 50, 'unit' => '冊', 'standard_price' => 500, 'unit_price' => 420],
                ['name' => 'トナーカートリッジ', 'spec' => '純正', 'quantity' => 10, 'unit' => '本', 'standard_price' => 12000, 'unit_price' => 9800],
            ]),
        ]));

        $this->createQuote(array_merge($senderSnap, $customerSnap($c1), [
            'sender_profile_id' => $sender->id,
            'customer_id' => $c1->id,
            'quote_number' => "Q-{$year}06-003",
            'subject' => '展示会ブース設営',
            'status' => 'draft',
            'created_date' => "{$year}-06-20",
            'valid_period' => 'お見積り日から１０日以内',
            'delivery_location' => 'ご指定場所',
            'tax_rate' => 10,
            'items' => $mkItems([
                ['name' => 'ブース設計', 'spec' => '3x3 区画', 'quantity' => 1, 'unit' => '式', 'standard_price' => 300000, 'unit_price' => 280000],
            ]),
        ]));
    }

    private function createQuote(array $data): void
    {
        $subtotal = collect($data['items'])->sum('total');
        $tax = (int) floor($subtotal * ($data['tax_rate'] ?? 10) / 100);
        $data['tax_amount'] = $tax;
        $data['total_amount'] = $subtotal + $tax;
        Quote::create($data);
    }
}
