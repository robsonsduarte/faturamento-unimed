<?php
/**
 * Gerador de API Key
 */

echo "=========================================\n";
echo "  GERADOR DE API KEY\n";
echo "=========================================\n\n";

function loadEnv() {
    $envFile = __DIR__ . '/.env';
    
    if (!file_exists($envFile)) {
        die("Arquivo .env nao encontrado!\n");
    }
    
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    $config = [];
    
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) {
            continue;
        }
        
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $config[trim($key)] = trim($value);
        }
    }
    
    return $config;
}

try {
    $config = loadEnv();
    
    $pdo = new PDO(
        "mysql:host={$config['DB_HOST']};dbname={$config['DB_NAME']};charset=utf8mb4",
        $config['DB_USER'],
        $config['DB_PASS'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]
    );
    
    $apiKey = bin2hex(random_bytes(32));
    $companyId = 1;
    $name = 'N8N Production';
    
    echo "Gerando API Key para empresa ID: {$companyId}\n\n";
    
    $sql = "INSERT INTO api_keys (company_id, api_key, name, status) 
            VALUES (?, ?, ?, 'active')";
    
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$companyId, $apiKey, $name]);
    
    $insertedId = $pdo->lastInsertId();
    
    echo "✅ API Key gerada com sucesso! (ID: {$insertedId})\n\n";
    echo "=========================================\n";
    echo "  COPIE E GUARDE ESTA CHAVE:\n";
    echo "=========================================\n\n";
    echo "{$apiKey}\n\n";
    echo "=========================================\n";
    echo "  COMO USAR:\n";
    echo "=========================================\n\n";
    echo "1. No n8n (HTTP Request Node):\n";
    echo "   Headers:\n";
    echo "     X-API-Key: {$apiKey}\n\n";
    echo "2. Com cURL:\n";
    echo "   curl -H 'X-API-Key: {$apiKey}' \\\n";
    echo "     {$config['API_BASE_URL']}/health\n\n";
    
    $stmt = $pdo->query("
        SELECT id, name, status, created_at, last_used 
        FROM api_keys 
        ORDER BY id DESC
    ");
    
    $keys = $stmt->fetchAll();
    
    echo "\nAPI Keys cadastradas: " . count($keys) . "\n";
    echo "=========================================\n";
    
    foreach ($keys as $key) {
        $status = $key['status'] === 'active' ? '✅ ATIVA' : '❌ INATIVA';
        $lastUsed = $key['last_used'] ?? 'Nunca usada';
        
        echo "\nID: {$key['id']}\n";
        echo "Nome: {$key['name']}\n";
        echo "Status: {$status}\n";
        echo "Criada: {$key['created_at']}\n";
        echo "Ultimo uso: {$lastUsed}\n";
    }
    
    echo "\n=========================================\n";
    echo "Proximo passo: Testar a API!\n";
    echo "=========================================\n";
    
} catch (PDOException $e) {
    echo "ERRO: " . $e->getMessage() . "\n";
    exit(1);
}