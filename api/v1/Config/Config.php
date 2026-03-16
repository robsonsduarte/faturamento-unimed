<?php
namespace API\Config;

class Config
{
    const API_VERSION = '1.0.0';
    const ENVIRONMENT = 'development';
    const DEBUG_MODE = true;
    const TIMEZONE = 'America/Bahia';
    
    const DAY_MAP = [
        1 => 'segunda',
        2 => 'terça',
        3 => 'quarta',
        4 => 'quinta',
        5 => 'sexta',
        6 => 'sabado',
        7 => 'domingo'
    ];
    
    const ALLOWED_ORIGINS = [
        'https://n8n.robsonduarte.com.br',
        'https://consultoriopro.com.br',
        'http://localhost:5678'
    ];
    
    const ALLOWED_HEADERS = [
        'Content-Type',
        'X-API-Key',
        'Authorization',
        'X-Requested-With'
    ];
    
    const ALLOWED_METHODS = [
        'GET',
        'POST',
        'PUT',
        'DELETE',
        'OPTIONS'
    ];
    
    const REQUEST_TIMEOUT = 30;
    const MAX_BODY_SIZE = 5;
    const RATE_LIMIT_ENABLED = true;
    const RATE_LIMIT_PER_MINUTE = 60;
    const CACHE_ENABLED = false;
    const CACHE_TTL = 300;
    const LOG_ENABLED = true;
    const LOG_REQUESTS = true;
    const LOG_ERRORS = true;
    const LOG_DIR = '../logs';
    const DATE_FORMAT = 'Y-m-d';
    const TIME_FORMAT = 'H:i';
    const DATETIME_FORMAT = 'Y-m-d H:i:s';
    
    const ERROR_CODES = [
        'INVALID_API_KEY' => 'API Key inválida ou expirada',
        'MISSING_API_KEY' => 'API Key não fornecida',
        'UNAUTHORIZED' => 'Acesso não autorizado',
        'VALIDATION_ERROR' => 'Erro de validação dos dados',
        'INVALID_PARAMETERS' => 'Parâmetros inválidos',
        'MISSING_REQUIRED_FIELD' => 'Campo obrigatório não fornecido',
        'RESOURCE_NOT_FOUND' => 'Recurso não encontrado',
        'COMPANY_NOT_FOUND' => 'Empresa não encontrada',
        'USER_NOT_FOUND' => 'Usuário não encontrado',
        'SCHEDULE_NOT_FOUND' => 'Horário não encontrado',
        'OPERATION_FAILED' => 'Falha ao executar operação',
        'DATABASE_ERROR' => 'Erro ao acessar banco de dados',
        'SYNC_FAILED' => 'Falha na sincronização',
        'RATE_LIMIT_EXCEEDED' => 'Limite de requisições excedido',
        'INTERNAL_ERROR' => 'Erro interno do servidor',
        'METHOD_NOT_ALLOWED' => 'Método HTTP não permitido',
        'INVALID_JSON' => 'JSON inválido no corpo da requisição'
    ];
    
    const DEFAULT_PAGE_SIZE = 50;
    const MAX_PAGE_SIZE = 100;
    
    public static function init()
    {
        date_default_timezone_set(self::TIMEZONE);
        
        if (self::DEBUG_MODE) {
            error_reporting(E_ALL);
            ini_set('display_errors', 1);
        } else {
            error_reporting(0);
            ini_set('display_errors', 0);
        }
        
        set_time_limit(self::REQUEST_TIMEOUT);
        
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('X-XSS-Protection: 1; mode=block');
        
        self::configureCORS();
    }
    
    private static function configureCORS()
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        
        if (in_array($origin, self::ALLOWED_ORIGINS)) {
            header("Access-Control-Allow-Origin: {$origin}");
        }
        
        header('Access-Control-Allow-Methods: ' . implode(', ', self::ALLOWED_METHODS));
        header('Access-Control-Allow-Headers: ' . implode(', ', self::ALLOWED_HEADERS));
        header('Access-Control-Max-Age: 86400');
        
        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            http_response_code(200);
            exit;
        }
    }
    
    public static function getErrorMessage($code)
    {
        return self::ERROR_CODES[$code] ?? 'Erro desconhecido';
    }
    
    public static function isDebugMode()
    {
        return self::DEBUG_MODE;
    }
    
    public static function isProduction()
    {
        return self::ENVIRONMENT === 'production';
    }
}
