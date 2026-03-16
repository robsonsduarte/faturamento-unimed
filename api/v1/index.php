<?php

//Production settings
$isProduction = (getenv('APP_ENV') === 'production' || !getenv('APP_ENV'));
if ($isProduction) {
    ini_set('xdebug.mode', 'off');
    ini_set('display_errors', '0');
    error_reporting(0);
    ini_set('log_errors', '1');
    ini_set('error_log', __DIR__ . '/../../logs/php_errors.log');
}

if (!defined('API_PATH')) {
    define('API_PATH', __DIR__);
}

spl_autoload_register(function ($class) {
    $prefix = 'API\\';
    $base_dir = API_PATH . '/';
    
    $len = strlen($prefix);
    if (strncmp($prefix, $class, $len) !== 0) {
        return;
    }
    
    $relative_class = substr($class, $len);
    
    $file = $base_dir . str_replace('\\', '/', $relative_class) . '.php';
    
    if (file_exists($file)) {
        require $file;
    }
});

use API\Config\Config;
use API\Helpers\Response;

try {
    Config::init();
    
    require_once API_PATH . '/routes.php';
    
} catch (Exception $e) {
    Response::internalError($e);
}
