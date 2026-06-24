<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Quote extends Model
{
    protected $guarded = ['id'];

    protected $casts = [
        'items' => 'array',
        'created_date' => 'date:Y-m-d',
        'valid_until' => 'date:Y-m-d',
        'tax_rate' => 'integer',
        'total_amount' => 'integer',
        'tax_amount' => 'integer',
    ];
}
