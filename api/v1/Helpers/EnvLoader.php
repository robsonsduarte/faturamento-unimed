<?php
namespace API\Helpers;

class EnvLoader
{
    private static $loaded = false;
    private static $vars = [];
    
    public static function load($filePath = null)
    {
        if (self::$loaded) {
            return;
        }
        
        if ($filePath === null) {
            $filePath = dirname(__DIR__) . '/.env';
        }
        
        if (!file_exists($filePath)) {
            throw new \Exception(".env file not found: {$filePath}");
        }
        
        $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        
        foreach ($lines as $line) {
            // Ignorar comentários
            if (strpos(trim($line), '#') === 0) {
                continue;
            }
            
            // Processar linha KEY=VALUE
            if (strpos($line, '=') !== false) {
                list($key, $value) = explode('=', $line, 2);
                
                $key = trim($key);
                $value = trim($value);
                
                // Remover aspas se existirem
                $value = trim($value, '"\'');
                
                // Armazenar
                self::$vars[$key] = $value;
                
                // Definir como variável de ambiente
                putenv("{$key}={$value}");
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
        
        self::$loaded = true;
    }
    
    public static function get($key, $default = null)
    {
        if (!self::$loaded) {
            self::load();
        }
        
        return self::$vars[$key] ?? getenv($key) ?: $default;
    }
    
    public static function getInt($key, $default = 0)
    {
        return (int) self::get($key, $default);
    }
    
    public static function getBool($key, $default = false)
    {
        $value = self::get($key, $default);
        
        if (is_bool($value)) {
            return $value;
        }
        
        return in_array(strtolower($value), ['true', '1', 'yes', 'on']);
    }
    
    public static function getArray($key, $default = [])
    {
        $value = self::get($key);
        
        if (empty($value)) {
            return $default;
        }
        
        // Se for separado por vírgula
        if (strpos($value, ',') !== false) {
            return array_map('trim', explode(',', $value));
        }
        
        return [$value];
    }
}
