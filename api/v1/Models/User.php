<?php
namespace API\Models;

class User extends BaseModel
{
    protected $table = 'users';
    
    protected $fillable = [
        'company',
        'first_name',
        'last_name',
        'email',
        'mobile',
        'occupation',
        'document',
        'councilProfessional',
        'numberCouncil',
        'ufCouncil',
        'status',
        'level'
    ];
    
    protected $hidden = [
        'password'
    ];
    
    /**
     * Busca profissionais por empresa (SEM filtro de nome)
     */
    public function getByCompany($companyId, $status = 'confirmed')
    {
        $sql = "SELECT 
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.mobile,
                    u.document,
                    u.councilProfessional,
                    u.numberCouncil,
                    u.ufCouncil,
                    u.occupation,
                    u.status,
                    u.level,
                    o.title as occupation_name,
                    o.cbos as occupation_cbos
                FROM `{$this->table}` u
                LEFT JOIN `app_occupations` o ON u.occupation = o.id
                WHERE u.active = 'yes' AND u.level = 6 AND u.company = ?
                ORDER BY u.first_name ASC, u.last_name ASC";
        
        return $this->query($sql, [(int) $companyId]);
    }
    
    /**
     * Busca profissionais COM filtro de nome
     */
    public function searchByCompany($companyId, $searchTerm = null, $status = 'confirmed')
    {
        $sql = "SELECT 
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.mobile,
                    u.document,
                    u.councilProfessional,
                    u.numberCouncil,
                    u.ufCouncil,
                    u.occupation,
                    u.status,
                    u.level,
                    o.title as occupation_name,
                    o.cbos as occupation_cbos
                FROM `{$this->table}` u
                LEFT JOIN `app_occupations` o ON u.occupation = o.id
                WHERE u.active = 'yes' AND u.level = 6 AND u.company = ?";
        
        $params = [(int) $companyId];
        
        if ($searchTerm) {
            $sql .= " AND (LOWER(CONCAT(u.first_name, ' ', u.last_name)) LIKE LOWER(?)
                      OR LOWER(u.first_name) LIKE LOWER(?)
                      OR LOWER(u.last_name) LIKE LOWER(?))";
            $searchPattern = "%{$searchTerm}%";
            $params[] = $searchPattern;
            $params[] = $searchPattern;
            $params[] = $searchPattern;
        }
        
        $sql .= " ORDER BY u.first_name ASC, u.last_name ASC";
        
        return $this->query($sql, $params);
    }
    
    /**
     * Busca profissionais com Google Calendar
     */
    public function getWithGoogleCalendar($companyId)
    {
        $sql = "SELECT 
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.mobile,
                    u.document,
                    u.councilProfessional,
                    u.numberCouncil,
                    u.ufCouncil,
                    u.occupation,
                    o.title as occupation_name,
                    o.cbos as occupation_cbos,
                    gc.google_calendar_id,
                    gc.sync_enabled,
                    gc.last_sync
                FROM `{$this->table}` u
                LEFT JOIN `app_occupations` o ON u.occupation = o.id
                INNER JOIN `users_google_calendar` gc ON u.id = gc.user_id AND u.company = gc.company_id
                WHERE u.active = 'yes' AND u.level = 6 AND u.company = ?
                ORDER BY u.first_name ASC, u.last_name ASC";
        
        return $this->query($sql, [(int) $companyId]);
    }
    
    /**
     * Busca informações completas de um profissional (incluindo dados para XML TISS)
     */
    public function getFullInfo($userId, $companyId)
    {
        $sql = "SELECT 
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.email,
                    u.mobile,
                    u.document,
                    u.councilProfessional,
                    u.numberCouncil,
                    u.ufCouncil,
                    u.occupation,
                    u.status,
                    u.level,
                    o.title as occupation_name,
                    o.cbos as occupation_cbos,
                    gc.google_calendar_id,
                    gc.sync_enabled,
                    gc.last_sync
                FROM `{$this->table}` u
                LEFT JOIN `app_occupations` o ON u.occupation = o.id
                LEFT JOIN `users_google_calendar` gc ON u.id = gc.user_id AND u.company = gc.company_id
                WHERE u.active = 'yes' AND u.level = 6 AND u.id = ? AND u.company = ?
                LIMIT 1";
        
        return $this->fetchOne($sql, [$userId, (int) $companyId]);
    }
    
    /**
     * Busca dados do profissional para XML TISS (equipeSadt)
     * Retorna apenas os campos necessários para geração do XML
     */
    public function getForTiss($userId, $companyId)
    {
        $sql = "SELECT 
                    u.id,
                    u.first_name,
                    u.last_name,
                    u.document,
                    u.councilProfessional,
                    u.numberCouncil,
                    u.ufCouncil,
                    o.cbos as occupation_cbos
                FROM `{$this->table}` u
                LEFT JOIN `app_occupations` o ON u.occupation = o.id
                WHERE u.id = ? AND u.company = ?
                LIMIT 1";
        
        $result = $this->fetchOne($sql, [$userId, (int) $companyId]);
        
        if (!$result) {
            return null;
        }
        
        // Retorna no formato esperado pelo XML TISS
        return [
            'id' => (int) $result['id'],
            'nome' => trim($result['first_name'] . ' ' . $result['last_name']),
            'cpf' => preg_replace('/[^0-9]/', '', $result['document'] ?? ''),
            'conselho' => str_pad($result['councilProfessional'] ?? '', 2, '0', STR_PAD_LEFT),
            'numeroConselho' => $result['numberCouncil'] ?? '',
            'uf' => $result['ufCouncil'] ?? '',
            'cbos' => $result['occupation_cbos'] ?? ''
        ];
    }
    
    /**
     * Busca por email
     */
    public function getByEmail($email, $companyId)
    {
        return $this->findWhere([
            'email' => $email,
            'company' => $companyId
        ]);
    }
    
    /**
     * Verifica se usuário está ativo
     */
    public function isActive($userId, $companyId)
    {
        return $this->exists([
            'id' => $userId,
            'company' => $companyId,
            'status' => 'confirmed'
        ]);
    }
    
    /**
     * Retorna nome completo (first_name + last_name)
     */
    public static function getFullName($user)
    {
        $firstName = trim($user['first_name'] ?? '');
        $lastName = trim($user['last_name'] ?? '');
        return trim("{$firstName} {$lastName}");
    }
    
    /**
     * Formata para resposta da API (inclui dados TISS)
     */
    public function formatForAPI($user)
    {
        return [
            'id' => (int) $user['id'],
            'name' => self::getFullName($user),
            'email' => $user['email'] ?? null,
            'mobile' => $user['mobile'] ?? null,
            'document' => $user['document'] ?? null,
            'council' => [
                'code' => $user['councilProfessional'] ?? null,
                'number' => $user['numberCouncil'] ?? null,
                'uf' => $user['ufCouncil'] ?? null
            ],
            'occupation' => [
                'id' => (int) ($user['occupation'] ?? 0),
                'name' => $user['occupation_name'] ?? null,
                'cbos' => $user['occupation_cbos'] ?? null
            ],
            'google_calendar_id' => $user['google_calendar_id'] ?? null,
            'sync_enabled' => isset($user['sync_enabled']) ? (bool) $user['sync_enabled'] : null,
            'last_sync' => $user['last_sync'] ?? null,
            // Dados formatados para XML TISS
            'tiss' => [
                'cpfContratado' => preg_replace('/[^0-9]/', '', $user['document'] ?? ''),
                'nomeProf' => self::getFullName($user),
                'conselho' => str_pad($user['councilProfessional'] ?? '', 2, '0', STR_PAD_LEFT),
                'numeroConselhoProfissional' => $user['numberCouncil'] ?? '',
                'UF' => $user['ufCouncil'] ?? '',
                'CBOS' => $user['occupation_cbos'] ?? '',
                'grauPart' => '12' // Fixo: Clínico/Profissional SADT
            ]
        ];
    }
    
    /**
     * Lista ocupações da empresa
     */
    public function getOccupations($companyId)
    {
        $sql = "SELECT DISTINCT o.id, o.title as name, o.cbos
                FROM `app_occupations` o
                INNER JOIN `users` u ON u.occupation = o.id
                WHERE u.active = 'yes' AND u.level = 6 AND u.company = ?
                ORDER BY o.title ASC";
        
        return $this->query($sql, [(int) $companyId]);
    }
}