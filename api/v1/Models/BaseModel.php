<?php
namespace API\Models;

use API\Config\Database;
use PDO;

abstract class BaseModel
{
    protected $db;
    protected $conn;
    protected $table;
    protected $primaryKey = 'id';
    protected $fillable = [];
    protected $hidden = [];
    
    public function __construct()
    {
        $this->db = Database::getInstance();
        $this->conn = $this->db->getConnection();
    }
    
    public function all($where = [], $orderBy = null, $limit = null)
    {
        $sql = "SELECT * FROM `{$this->table}`";
        $params = [];
        
        if (!empty($where)) {
            $conditions = $this->buildWhereClause($where);
            $sql .= " WHERE {$conditions['sql']}";
            $params = $conditions['params'];
        }
        
        if ($orderBy) {
            $sql .= " ORDER BY {$orderBy}";
        }
        
        if ($limit) {
            $sql .= " LIMIT {$limit}";
        }
        
        $results = $this->db->query($sql, $params);
        return $this->hideFields($results);
    }
    
    public function find($id)
    {
        $sql = "SELECT * FROM `{$this->table}` WHERE `{$this->primaryKey}` = ? LIMIT 1";
        $result = $this->db->fetchOne($sql, [$id]);
        
        return $result ? $this->hideFields([$result])[0] : null;
    }
    
    public function findWhere($where)
    {
        $conditions = $this->buildWhereClause($where);
        $sql = "SELECT * FROM `{$this->table}` WHERE {$conditions['sql']} LIMIT 1";
        $result = $this->db->fetchOne($sql, $conditions['params']);
        
        return $result ? $this->hideFields([$result])[0] : null;
    }
    
    public function exists($where)
    {
        return $this->findWhere($where) !== null;
    }
    
    public function count($where = [])
    {
        return $this->db->count($this->table, $where);
    }
    
    public function insert($data)
    {
        $data = $this->filterFillable($data);
        
        if (empty($data)) {
            return false;
        }
        
        $fields = array_keys($data);
        $values = array_values($data);
        $placeholders = array_fill(0, count($fields), '?');
        
        $sql = sprintf(
            "INSERT INTO `%s` (`%s`) VALUES (%s)",
            $this->table,
            implode('`, `', $fields),
            implode(', ', $placeholders)
        );
        
        return $this->db->execute($sql, $values);
    }
    
    public function update($id, $data)
    {
        $data = $this->filterFillable($data);
        
        if (empty($data)) {
            return false;
        }
        
        if (in_array('updated_at', $this->fillable)) {
            $data['updated_at'] = date('Y-m-d H:i:s');
        }
        
        $fields = [];
        $values = [];
        
        foreach ($data as $field => $value) {
            $fields[] = "`{$field}` = ?";
            $values[] = $value;
        }
        
        $values[] = $id;
        
        $sql = sprintf(
            "UPDATE `%s` SET %s WHERE `%s` = ?",
            $this->table,
            implode(', ', $fields),
            $this->primaryKey
        );
        
        return $this->db->execute($sql, $values);
    }
    
    public function delete($id)
    {
        $sql = "DELETE FROM `{$this->table}` WHERE `{$this->primaryKey}` = ?";
        return $this->db->execute($sql, [$id]);
    }
    
    public function deleteWhere($where)
    {
        $conditions = $this->buildWhereClause($where);
        $sql = "DELETE FROM `{$this->table}` WHERE {$conditions['sql']}";
        return $this->db->execute($sql, $conditions['params']);
    }
    
    protected function query($sql, $params = [])
    {
        return $this->db->query($sql, $params);
    }
    
    protected function execute($sql, $params = [])
    {
        return $this->db->execute($sql, $params);
    }
    
    protected function fetchOne($sql, $params = [])
    {
        return $this->db->fetchOne($sql, $params);
    }
    
    protected function buildWhereClause($where)
    {
        $conditions = [];
        $params = [];
        
        foreach ($where as $field => $value) {
            if (is_array($value)) {
                [$operator, $val] = $value;
                $conditions[] = "`{$field}` {$operator} ?";
                $params[] = $val;
            } else {
                $conditions[] = "`{$field}` = ?";
                $params[] = $value;
            }
        }
        
        return [
            'sql' => implode(' AND ', $conditions),
            'params' => $params
        ];
    }
    
    protected function filterFillable($data)
    {
        if (empty($this->fillable)) {
            return $data;
        }
        
        return array_intersect_key($data, array_flip($this->fillable));
    }
    
    protected function hideFields($results)
    {
        if (empty($this->hidden)) {
            return $results;
        }
        
        foreach ($results as &$row) {
            foreach ($this->hidden as $field) {
                unset($row[$field]);
            }
        }
        
        return $results;
    }
    
    public function beginTransaction()
    {
        return $this->db->beginTransaction();
    }
    
    public function commit()
    {
        return $this->db->commit();
    }
    
    public function rollback()
    {
        return $this->db->rollback();
    }
}
