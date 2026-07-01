<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Customer extends Model
{
    protected $guarded = ['id'];

    public function signatures(): HasMany
    {
        return $this->hasMany(CustomerSignature::class);
    }
}
