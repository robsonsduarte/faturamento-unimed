<?php
namespace API\Models;

class Patient extends BaseModel
{
    protected $table = 'app_patient';
    protected $primaryKey = 'id';

    protected $fillable = [
        'company',
        'first_name',
        'last_name',
        'email',
        'mobile',
        'phone',
        'send',
        'sendBday',
        'telegram',
        'genre',
        'born_at',
        'document',
        'cid10',
        'agreement',
        'agreement_code',
        'biometry',
        'photo',
        'project',
        'contract_template',
        'contract_document',
        'contract_company_url',
        'contract_patient_url',
        'contract_signed',
        'consent_terms',
        'consent_terms_patient',
        'consent_terms_professional',
        'consent_terms_company',
        'responsible_name',
        'responsible_rg',
        'responsible_cpf',
        'responsible_born_at',
        'observation',
        'hash',
        'waiting',
        'status',
        'author'
    ];

    protected $hidden = [
        'responsible_cpf',
        'document'
    ];

    public function findByMobile($mobile, $companyId)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `mobile` = ? AND `company` = ? 
                LIMIT 1";
        
        return $this->fetchOne($sql, [$mobile, $companyId]);
    }

    public function findOrCreate($data)
    {
        $existing = $this->findByMobile($data['mobile'], $data['company']);
        
        if ($existing) {
            return [
                'patient' => $existing,
                'created' => false
            ];
        }

        $patientData = [
            'company' => $data['company'],
            'mobile' => $data['mobile'],
            'first_name' => $data['first_name'] ?? '',
            'last_name' => $data['last_name'] ?? '',
            'email' => $data['email'] ?? '',
            'genre' => $data['genre'] ?? 'm',
            'born_at' => $data['born_at'] ?? '1900-01-01',
            'document' => $data['document'] ?? '00000000000',
            'agreement' => $data['agreement'] ?? '1',
            'biometry' => $data['biometry'] ?? 'yes',
            'project' => $data['project'] ?? 'no',
            'contract_signed' => $data['contract_signed'] ?? 'no',
            'waiting' => $data['waiting'] ?? 'no',
            'status' => $data['status'] ?? 'active',
            'author' => $data['author'] ?? 1
        ];

        $newId = $this->insert($patientData);
        
        if ($newId) {
            return [
                'patient' => $this->find($newId),
                'created' => true
            ];
        }

        return null;
    }

    public function search($query, $companyId, $limit = 20)
    {
        // Trim e prepara o termo de busca
        $query = trim($query);
        $searchTerm = "%{$query}%";
        
        // Faz o split do nome para pegar primeiro e último
        $nameParts = explode(' ', $query);
        $firstName = null;
        $lastName = null;
        
        // Se tiver mais de uma palavra, pega primeira e última
        if (count($nameParts) > 1) {
            $firstName = trim($nameParts[0]);
            $lastName = trim($nameParts[count($nameParts) - 1]);
        }
        
        // Query SQL atualizada
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `company` = ? 
                AND (
                    `first_name` LIKE ? 
                    OR `last_name` LIKE ? 
                    OR `mobile` LIKE ?
                    OR `email` LIKE ?";
        
        $params = [
            $companyId,
            $searchTerm,
            $searchTerm,
            $searchTerm,
            $searchTerm
        ];
        
        // Se tiver primeiro e último nome, adiciona busca combinada
        if ($firstName && $lastName) {
            $sql .= " OR (`first_name` LIKE ? AND `last_name` LIKE ?)";
            $params[] = "%{$firstName}%";
            $params[] = "%{$lastName}%";
        }
        
        $sql .= ")
                AND `status` = 'active'
                ORDER BY `first_name` ASC
                LIMIT ?";
        
        $params[] = $limit;
        
        $results = $this->query($sql, $params);
    
        return $this->hideFields($results);
    }

    public function getByCompany($companyId, $limit = 50, $offset = 0)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `company` = ? 
                AND `status` = 'active'
                ORDER BY `first_name` ASC
                LIMIT ? OFFSET ?";
        
        $results = $this->query($sql, [$companyId, $limit, $offset]);
        return $this->hideFields($results);
    }

    public function countActive($companyId)
    {
        return $this->count(['company' => $companyId, 'status' => 'active']);
    }

    public function existsByMobile($mobile, $companyId)
    {
        return $this->findByMobile($mobile, $companyId) !== null;
    }
    
    /**
     * Busca paciente para validação LGPD (4 últimos dígitos + nome + data)
     */
   public function searchForValidation($companyId, $telefone, $nomeCompleto, $dataNascimento)
    {
        $telefone = preg_replace('/[^0-9]/', '', $telefone);
        $ultimosDigitos = substr($telefone, -4);
        
        $dataParts = explode('/', $dataNascimento);
        if (count($dataParts) === 3) {
            $dataNasc = $dataParts[2] . '-' . $dataParts[1] . '-' . $dataParts[0];
        } else {
            $dataNasc = date('Y-m-d', strtotime($dataNascimento));
        }
        
        $nomePartes = explode(' ', trim($nomeCompleto));
        if (count($nomePartes) < 2) {
            return null;
        }
        
        $primeiroNome = $nomePartes[0];
        $ultimoNome = $nomePartes[count($nomePartes) - 1];
        
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `company` = ? 
                AND `born_at` = ?
                AND `mobile` LIKE ?
                AND LOWER(`first_name`) LIKE ?
                AND LOWER(`last_name`) LIKE ?
                LIMIT 1";
        
        $telefoneLike = "%{$ultimosDigitos}";
        $primeiroPattern = strtolower("%{$primeiroNome}%");
        $ultimoPattern = strtolower("%{$ultimoNome}%");
        
        $result = $this->query($sql, [
            $companyId,
            $dataNasc,
            $telefoneLike,
            $primeiroPattern,
            $ultimoPattern
        ]);
        
        return !empty($result) ? $result[0] : null;
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
