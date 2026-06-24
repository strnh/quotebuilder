<?php

use Illuminate\Support\Facades\Route;

// SPA entrypoint: every non-asset route renders the React app.
Route::get('/{any?}', function () {
    return view('app');
})->where('any', '.*');
