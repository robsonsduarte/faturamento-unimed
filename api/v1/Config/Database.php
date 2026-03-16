<?php
namespace API\Config;

use PDO;
use PDOException;
use API\Helpers\EnvLoader;

class Database
{
    private static $instance = null;
    private $connection;
    
    private function __construct()
    {
        try {
            // Carregar variáveis de ambiente
            EnvLoader::load();
            
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                EnvLoader::get('DB_HOST', 'localhost'),
                EnvLoader::get('DB_PORT', '3306'),
                EnvLoader::get('DB_NAME', 'consult6_cpro'),
                'utf8mb4'
            );
            
            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
            ];
            
            $this->connection = new PDO(
                $dsn,
                EnvLoader::get('DB_USER'),
                EnvLoader::get('DB_PASS'),
                $options
            );
            
        } catch (PDOException $e) {
            $this->handleConnectionError($e);
        }
    }
    
    private function __clone() {}
    
    public function __wakeup()
    {
        throw new \Exception("Cannot unserialize singleton");
    }
    
    public static function getInstance()
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }
    
    public function getConnection()
    {
        return $this->connection;
    }
    
    public function query($sql, $params = [])
    {
        try {
            $stmt = $this->connection->prepare($sql);
            $stmt->execute($params);
            return $stmt->fetchAll();
        } catch (PDOException $e) {
            $this->handleQueryError($e, $sql);
            return [];
        }
    }
    
    public function execute($sql, $params = [])
    {
        try {
            $stmt = $this->connection->prepare($sql);
            $result = $stmt->execute($params);
            
            if (stripos(trim($sql), 'INSERT') === 0) {
                return $this->connection->lastInsertId();
            }
            
            return $result;
        } catch (PDOException $e) {
            $this->handleQueryError($e, $sql);
            return false;
        }
    }
    
    public function fetchOne($sql, $params = [])
    {
        try {
            $stmt = $this->connection->prepare($sql);
            $stmt->execute($params);
            $result = $stmt->fetch();
            return $result ?: null;
        } catch (PDOException $e) {
            $this->handleQueryError($e, $sql);
            return null;
        }
    }
    
    public function count($table, $where = [])
    {
        $sql = "SELECT COUNT(*) as total FROM `{$table}`";
        
        if (!empty($where)) {
            $conditions = [];
            foreach (array_keys($where) as $column) {
                $conditions[] = "`{$column}` = ?";
            }
            $sql .= " WHERE " . implode(' AND ', $conditions);
        }
        
        $result = $this->fetchOne($sql, array_values($where));
        return (int) ($result['total'] ?? 0);
    }
    
    public function beginTransaction()
    {
        return $this->connection->beginTransaction();
    }
    
    public function commit()
    {
        return $this->connection->commit();
    }
    
    public function rollback()
    {
        // Fix: Verifica se há transação ativa antes de fazer rollback
        if ($this->connection->inTransaction()) {
            return $this->connection->rollBack();
        }
        return false; // Sem transação ativa, retorna false silenciosamente
    }
    
    public function inTransaction()
    {
        return $this->connection->inTransaction();
    }
    
    private function handleConnectionError(PDOException $e)
    {
        $debugMode = EnvLoader::getBool('DEBUG_MODE', true);
        
        if ($debugMode) {
            die("Erro de conexão: " . $e->getMessage());
        } else {
            error_log("Database Connection Error: " . $e->getMessage());
            die("Erro ao conectar com o banco de dados.");
        }
    }
    
    private function handleQueryError(PDOException $e, $sql = '')
    {
        $errorMessage = "Database Query Error: " . $e->getMessage();
        if ($sql) {
            $errorMessage .= " | SQL: " . $sql;
        }
        error_log($errorMessage);
        
        if (EnvLoader::getBool('DEBUG_MODE', true)) {
            throw $e;
        }
    }
    
    public static function testConnection()
    {
        try {
            $db = self::getInstance();
            $result = $db->fetchOne("SELECT 1 as test");
            return isset($result['test']) && $result['test'] == 1;
        } catch (\Exception $e) {
            return false;
        }
    }
}
