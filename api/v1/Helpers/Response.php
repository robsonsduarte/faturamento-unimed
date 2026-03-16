<?php
namespace API\Helpers;

use API\Config\Config;

class Response
{
    public static function success($data = null, $httpCode = 200, $meta = [])
    {
        $response = ['success' => true];
        
        if ($data !== null) {
            $response['data'] = $data;
        }
        
        if (!empty($meta)) {
            $response['meta'] = $meta;
        }
        
        self::send($response, $httpCode);
    }
    
    public static function error($code, $message = null, $httpCode = 400, $details = [])
    {
        $response = [
            'success' => false,
            'error' => [
                'code' => $code,
                'message' => $message ?? Config::getErrorMessage($code)
            ]
        ];
        
        if (!empty($details)) {
            $response['error']['details'] = $details;
        }
        
        if (Config::isDebugMode() && !empty($details['exception'])) {
            $response['error']['trace'] = $details['exception'];
        }
        
        self::send($response, $httpCode);
    }
    
    public static function validationError($errors)
    {
        self::error(
            'VALIDATION_ERROR',
            'Os dados fornecidos são inválidos',
            422,
            ['validation_errors' => $errors]
        );
    }
    
    public static function notFound($resource = 'Recurso')
    {
        self::error('RESOURCE_NOT_FOUND', "{$resource} não encontrado", 404);
    }
    
    public static function unauthorized($message = null)
    {
        self::error('UNAUTHORIZED', $message ?? 'Acesso não autorizado', 401);
    }
    
    public static function forbidden($message = null)
    {
        self::error('UNAUTHORIZED', $message ?? 'Você não tem permissão para acessar este recurso', 403);
    }
    
    public static function internalError($exception = null)
    {
        $details = [];
        
        if ($exception && Config::isDebugMode()) {
            $details = [
                'exception' => [
                    'message' => $exception->getMessage(),
                    'file' => $exception->getFile(),
                    'line' => $exception->getLine(),
                    'trace' => $exception->getTraceAsString()
                ]
            ];
        }
        
        self::error('INTERNAL_ERROR', 'Erro interno do servidor', 500, $details);
    }
    
    public static function methodNotAllowed($allowedMethods = [])
    {
        if (!empty($allowedMethods)) {
            header('Allow: ' . implode(', ', $allowedMethods));
        }
        
        self::error('METHOD_NOT_ALLOWED', 'Método HTTP não permitido', 405);
    }
    
    public static function rateLimitExceeded()
    {
        self::error('RATE_LIMIT_EXCEEDED', 'Você excedeu o limite de requisições. Tente novamente em alguns minutos.', 429);
    }
    
    public static function created($data = null, $meta = [])
    {
        self::success($data, 201, $meta);
    }
    
    public static function noContent()
    {
        http_response_code(204);
        exit;
    }
    
    public static function paginated($items, $total, $page = 1, $pageSize = 50)
    {
        $totalPages = ceil($total / $pageSize);
        
        $meta = [
            'pagination' => [
                'total' => $total,
                'count' => count($items),
                'per_page' => $pageSize,
                'current_page' => $page,
                'total_pages' => $totalPages,
                'has_next' => $page < $totalPages,
                'has_prev' => $page > 1
            ]
        ];
        
        self::success($items, 200, $meta);
    }
    
    private static function send($data, $httpCode = 200)
    {
        http_response_code($httpCode);
        header('Content-Type: application/json; charset=UTF-8');
        
        $data['timestamp'] = date('c');
        $data['api_version'] = Config::API_VERSION;
        
        echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        exit;
    }
    
    public static function getRequestBody()
    {
        $body = file_get_contents('php://input');
        
        if (empty($body)) {
            return null;
        }
        
        $decoded = json_decode($body, true);
        
        if (json_last_error() !== JSON_ERROR_NONE) {
            self::error('INVALID_JSON', 'JSON inválido no corpo da requisição', 400);
        }
        
        return $decoded;
    }
    
    public static function getQueryParam($key, $default = null)
    {
        return $_GET[$key] ?? $default;
    }
    
    public static function getQueryParams()
    {
        return $_GET;
    }
    
    public static function getHeader($name, $default = null)
    {
        $headerKey = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        return $_SERVER[$headerKey] ?? $default;
    }
    
    public static function getMethod()
    {
        return $_SERVER['REQUEST_METHOD'] ?? 'GET';
    }
    
    public static function getClientIP()
    {
        $headers = [
            'HTTP_CLIENT_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_FORWARDED',
            'HTTP_X_CLUSTER_CLIENT_IP',
            'HTTP_FORWARDED_FOR',
            'HTTP_FORWARDED',
            'REMOTE_ADDR'
        ];
        
        foreach ($headers as $header) {
            if (!empty($_SERVER[$header])) {
                $ip = $_SERVER[$header];
                
                if (strpos($ip, ',') !== false) {
                    $ips = explode(',', $ip);
                    $ip = trim($ips[0]);
                }
                
                if (filter_var($ip, FILTER_VALIDATE_IP)) {
                    return $ip;
                }
            }
        }
        
        return 'unknown';
    }
    
    public static function getUserAgent()
    {
        return $_SERVER['HTTP_USER_AGENT'] ?? 'unknown';
       
    }
        
    public function searchFullName(
    string $firstName,
    string $lastName,
    int $company,
    int $limit = 20
    ): array {
    
        // Normalização forte (acento, caixa, espaços)
        $normalize = function ($v) {
            $v = trim(mb_strtoupper($v, 'UTF-8'));
            return iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $v);
        };
    
        $firstNorm = $normalize($firstName);
        $lastNorm  = $normalize($lastName);
    
        // Protege LIKE contra caracteres especiais
        $firstLike = $firstNorm . '%';
        $lastLike  = $lastNorm  . '%';
    
        $sql = "
            SELECT 
                id,
                company,
                first_name,
                last_name,
                mobile,
                born_at
            FROM app_patient
            WHERE 
                company = :company
                AND UPPER(first_name) LIKE :first_name
                AND (
                    UPPER(last_name) LIKE :last_name
                    OR UPPER(last_name) LIKE CONCAT('% ', :last_name)
                    OR UPPER(last_name) LIKE CONCAT(:last_name, ' %')
                    OR UPPER(last_name) LIKE CONCAT('% ', :last_name, ' %')
                )
                AND COALESCE(NULLIF(LOWER(status), ''), 'active') = 'active'
            ORDER BY first_name ASC
            LIMIT :lim
        ";
    
        $db = \API\Config\Database::getInstance();
        $stmt = $db->getConnection()->prepare($sql);
    
        $stmt->bindValue(':company', $company, \PDO::PARAM_INT);
        $stmt->bindValue(':first_name', $firstLike, \PDO::PARAM_STR);
        $stmt->bindValue(':last_name',  $lastLike,  \PDO::PARAM_STR);
        $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
    
        $stmt->execute();
    
        $patients = $stmt->fetchAll(\PDO::FETCH_ASSOC);
    
        return $patients ?: [];
    }

}
