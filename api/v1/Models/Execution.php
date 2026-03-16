<?php
namespace API\Models;

class Execution extends BaseModel
{
    protected $table = 'app_executions';
    protected $primaryKey = 'id';

    protected $fillable = [
        'patient', 'company', 'user', 'user_request', 'request_date',
        'user_attendant', 'authorization_date', 'password', 'validate_password',
        'clinical_indication', 'guide_number_provider', 'first_consultation',
        'table_tuss', 'guide_number', 'appointment_day', 'attendance_day',
        'attendance_start', 'attendance_end', 'agreement_type', 'type',
        'agreement', 'author', 'status_guide', 'status', 'signed',
        'send_biometry', 'executed_by', 'value', 'observation', 'deleted',
        'deleted_by', 'checkin', 'saw_consulta_at'
    ];

    /**
     * Lista guias por empresa com filtros
     * 
     * @param int $companyId
     * @param array $filters
     * @param int $limit
     * @param int $offset
     * @return array
     */
    public function getByCompany($companyId, $filters = [], $limit = 50, $offset = 0)
    {
        $sql = "SELECT 
                    e.*,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.document as patient_document,
                    p.mobile as patient_mobile,
                    u.first_name as professional_first_name,
                    u.last_name as professional_last_name,
                    ag.title as agreement_name,
                    ag.sub_of as agreement_parent_id,
                    ag_parent.title as agreement_parent_name
                FROM `{$this->table}` e
                INNER JOIN `app_patient` p ON e.patient = p.id
                INNER JOIN `users` u ON e.user = u.id
                LEFT JOIN `app_agreement` ag ON e.agreement = ag.id
                LEFT JOIN `app_agreement` ag_parent ON ag.sub_of = ag_parent.id
                WHERE e.company = ?
                AND (e.deleted IS NULL OR e.deleted = '' OR e.deleted = 'no')";
        
        $params = [$companyId];

        // Filtro por convênio (agreement) - ID direto
        if (!empty($filters['agreement'])) {
            $sql .= " AND e.agreement = ?";
            $params[] = $filters['agreement'];
        }

        // Filtro por nome do convênio (busca no título OU no título do pai)
        if (!empty($filters['agreement_name'])) {
            $sql .= " AND (ag.title LIKE ? OR ag_parent.title LIKE ?)";
            $params[] = '%' . $filters['agreement_name'] . '%';
            $params[] = '%' . $filters['agreement_name'] . '%';
        }

        // Filtro por ID do convênio pai (para buscar todos procedimentos de um convênio)
        if (!empty($filters['agreement_parent_id'])) {
            $sql .= " AND (ag.sub_of = ? OR ag.id = ?)";
            $params[] = $filters['agreement_parent_id'];
            $params[] = $filters['agreement_parent_id'];
        }

        // Filtro por profissional
        if (!empty($filters['user'])) {
            $sql .= " AND e.user = ?";
            $params[] = $filters['user'];
        }

        // Filtro por paciente
        if (!empty($filters['patient'])) {
            $sql .= " AND e.patient = ?";
            $params[] = $filters['patient'];
        }

        // Filtro por número da guia
        if (!empty($filters['guide_number'])) {
            $sql .= " AND e.guide_number = ?";
            $params[] = $filters['guide_number'];
        }

        // Filtro por número da guia do prestador
        if (!empty($filters['guide_number_provider'])) {
            $sql .= " AND e.guide_number_provider = ?";
            $params[] = $filters['guide_number_provider'];
        }

        // Filtro por status da guia
        if (!empty($filters['status_guide'])) {
            $sql .= " AND e.status_guide = ?";
            $params[] = $filters['status_guide'];
        }

        // Filtro por status geral
        if (!empty($filters['status'])) {
            $sql .= " AND e.status = ?";
            $params[] = $filters['status'];
        }

        // Filtro por data de atendimento (range)
        if (!empty($filters['attendance_date_start'])) {
            $sql .= " AND e.attendance_day >= ?";
            $params[] = $filters['attendance_date_start'];
        }
        if (!empty($filters['attendance_date_end'])) {
            $sql .= " AND e.attendance_day <= ?";
            $params[] = $filters['attendance_date_end'];
        }

        // Filtro por data de autorização (range)
        if (!empty($filters['authorization_date_start'])) {
            $sql .= " AND e.authorization_date >= ?";
            $params[] = $filters['authorization_date_start'];
        }
        if (!empty($filters['authorization_date_end'])) {
            $sql .= " AND e.authorization_date <= ?";
            $params[] = $filters['authorization_date_end'];
        }

        // Filtro por senha
        if (!empty($filters['password'])) {
            $sql .= " AND e.password = ?";
            $params[] = $filters['password'];
        }

        // Filtro por checkin
        if (isset($filters['checkin']) && $filters['checkin'] !== '') {
            $sql .= " AND e.checkin = ?";
            $params[] = $filters['checkin'];
        }

        // Filtro por tipo (local, intercambio)
        if (!empty($filters['type'])) {
            $sql .= " AND e.type = ?";
            $params[] = $filters['type'];
        }

        // Ordenação
        $orderBy = $filters['order_by'] ?? 'e.attendance_day';
        $orderDir = strtoupper($filters['order_dir'] ?? 'DESC');
        $orderDir = in_array($orderDir, ['ASC', 'DESC']) ? $orderDir : 'DESC';
        
        $sql .= " ORDER BY {$orderBy} {$orderDir}";
        $sql .= " LIMIT ? OFFSET ?";
        $params[] = $limit;
        $params[] = $offset;

        return $this->query($sql, $params);
    }

    /**
     * Conta guias por filtros
     * 
     * @param int $companyId
     * @param array $filters
     * @return int
     */
    public function countByFilters($companyId, $filters = [])
    {
        $sql = "SELECT COUNT(*) as total 
                FROM `{$this->table}` e
                LEFT JOIN `app_agreement` ag ON e.agreement = ag.id
                LEFT JOIN `app_agreement` ag_parent ON ag.sub_of = ag_parent.id
                WHERE e.company = ?
                AND (e.deleted IS NULL OR e.deleted = '' OR e.deleted = 'no')";
        
        $params = [$companyId];

        if (!empty($filters['agreement'])) {
            $sql .= " AND e.agreement = ?";
            $params[] = $filters['agreement'];
        }

        if (!empty($filters['agreement_name'])) {
            $sql .= " AND (ag.title LIKE ? OR ag_parent.title LIKE ?)";
            $params[] = '%' . $filters['agreement_name'] . '%';
            $params[] = '%' . $filters['agreement_name'] . '%';
        }

        if (!empty($filters['agreement_parent_id'])) {
            $sql .= " AND (ag.sub_of = ? OR ag.id = ?)";
            $params[] = $filters['agreement_parent_id'];
            $params[] = $filters['agreement_parent_id'];
        }

        if (!empty($filters['user'])) {
            $sql .= " AND e.user = ?";
            $params[] = $filters['user'];
        }

        if (!empty($filters['patient'])) {
            $sql .= " AND e.patient = ?";
            $params[] = $filters['patient'];
        }

        if (!empty($filters['guide_number'])) {
            $sql .= " AND e.guide_number = ?";
            $params[] = $filters['guide_number'];
        }

        if (!empty($filters['status_guide'])) {
            $sql .= " AND e.status_guide = ?";
            $params[] = $filters['status_guide'];
        }

        if (!empty($filters['status'])) {
            $sql .= " AND e.status = ?";
            $params[] = $filters['status'];
        }

        if (!empty($filters['attendance_date_start'])) {
            $sql .= " AND e.attendance_day >= ?";
            $params[] = $filters['attendance_date_start'];
        }
        if (!empty($filters['attendance_date_end'])) {
            $sql .= " AND e.attendance_day <= ?";
            $params[] = $filters['attendance_date_end'];
        }

        if (!empty($filters['type'])) {
            $sql .= " AND e.type = ?";
            $params[] = $filters['type'];
        }

        $result = $this->fetchOne($sql, $params);
        return (int)($result['total'] ?? 0);
    }

    /**
     * Busca guia por ID com detalhes
     * 
     * @param int $id
     * @return array|null
     */
    public function findWithDetails($id)
    {
        $sql = "SELECT 
                    e.*,
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.document as patient_document,
                    p.mobile as patient_mobile,
                    p.email as patient_email,
                    p.born_at as patient_born_at,
                    u.first_name as professional_first_name,
                    u.last_name as professional_last_name,
                    u.document_register as professional_rg,
                    ag.title as agreement_name,
                    ag.sub_of as agreement_parent_id,
                    ag_parent.title as agreement_parent_name,
                    tt.title as table_tuss_name
                FROM `{$this->table}` e
                INNER JOIN `app_patient` p ON e.patient = p.id
                INNER JOIN `users` u ON e.user = u.id
                LEFT JOIN `app_agreement` ag ON e.agreement = ag.id
                LEFT JOIN `app_agreement` ag_parent ON ag.sub_of = ag_parent.id
                LEFT JOIN `app_table_tuss` tt ON e.table_tuss = tt.id
                WHERE e.id = ?
                LIMIT 1";

        return $this->fetchOne($sql, [$id]);
    }

    /**
     * Busca TODAS as execuções/atendimentos de uma guia por número
     * 
     * Uma guia pode ter múltiplos atendimentos/procedimentos executados
     * 
     * @param string $guideNumber - Número da guia (interno ou operadora)
     * @param int $companyId - ID da empresa
     * @return array - Array com todas as execuções da guia
     */
    public function findByGuideNumber($guideNumber, $companyId)
    {
        $sql = "SELECT 
                    e.id,
                    e.company,
                    e.guide_number,
                    e.guide_number_provider,
                    e.patient,
                    e.user,
                    e.user_request,
                    e.user_attendant,
                    e.authorization_date,
                    e.password,
                    e.validate_password,
                    e.request_date,
                    e.attendance_day,
                    e.attendance_start,
                    e.attendance_end,
                    e.value,
                    e.status_guide,
                    e.status,
                    e.type,
                    e.checkin,
                    e.agreement,
                    e.agreement_type,
                    e.table_tuss,
                    e.clinical_indication,
                    e.observation,
                    e.first_consultation,
                    e.saw_consulta_at,
                    e.created_at,
                    e.updated_at,
                    
                    -- Dados do Paciente
                    p.first_name as patient_first_name,
                    p.last_name as patient_last_name,
                    p.document as patient_document,
                    p.mobile as patient_mobile,
                    p.email as patient_email,
                    p.born_at as patient_born_at,
                    
                    -- Dados do Profissional
                    u.first_name as professional_first_name,
                    u.last_name as professional_last_name,
                    u.document as professional_cpf,
                    u.document_register as professional_rg,
                    u.mobile as professional_mobile,
                    
                    -- Dados do Convênio
                    ag.title as agreement_name,
                    ag.sub_of as agreement_parent_id,
                    ag_parent.title as agreement_parent_name,
                    
                    -- Dados TUSS
                    tt.value as tuss_code,
                    tt.title as tuss_description
                    
                FROM `{$this->table}` e
                INNER JOIN `app_patient` p ON e.patient = p.id
                INNER JOIN `users` u ON e.user = u.id
                LEFT JOIN `app_agreement` ag ON e.agreement = ag.id
                LEFT JOIN `app_agreement` ag_parent ON ag.sub_of = ag_parent.id
                LEFT JOIN `app_table_tuss` tt ON e.table_tuss = tt.id
                WHERE (e.guide_number = ? OR e.guide_number_provider = ?)
                  AND e.company = ?
                  AND (e.deleted IS NULL OR e.deleted = '' OR e.deleted = 'no')
                ORDER BY e.attendance_day ASC, e.attendance_start ASC";
        
        // ✅ CORREÇÃO: Usar query() ao invés de fetchAll()
        $results = $this->query($sql, [$guideNumber, $guideNumber, $companyId]);
        
        return $results ?: [];
    }

    /**
     * Lista guias da Unimed (filtro específico)
     * Busca por convênios que têm "Unimed" no nome (próprio ou do pai)
     * 
     * @param int $companyId
     * @param array $filters
     * @param int $limit
     * @param int $offset
     * @return array
     */
    public function getUnimedGuides($companyId, $filters = [], $limit = 50, $offset = 0)
    {
        // Adiciona filtro específico para Unimed
        $filters['agreement_name'] = 'Unimed';
        return $this->getByCompany($companyId, $filters, $limit, $offset);
    }

    /**
     * Conta guias da Unimed
     * 
     * @param int $companyId
     * @param array $filters
     * @return int
     */
    public function countUnimedGuides($companyId, $filters = [])
    {
        $filters['agreement_name'] = 'Unimed';
        return $this->countByFilters($companyId, $filters);
    }

    /**
     * Lista convênios disponíveis na empresa (estrutura hierárquica)
     * 
     * @param int $companyId
     * @return array
     */
    public function listAgreements($companyId)
    {
        $sql = "SELECT 
                    ag.id, 
                    ag.title,
                    ag.sub_of,
                    ag_parent.title as parent_name,
                    COUNT(e.id) as total_guides
                FROM `app_agreement` ag
                LEFT JOIN `app_agreement` ag_parent ON ag.sub_of = ag_parent.id
                LEFT JOIN `{$this->table}` e ON ag.id = e.agreement 
                    AND e.company = ? 
                    AND (e.deleted IS NULL OR e.deleted = '' OR e.deleted = 'no')
                WHERE ag.company = ? OR ag.company IS NULL
                GROUP BY ag.id, ag.title, ag.sub_of, ag_parent.title
                ORDER BY ag_parent.title ASC, ag.title ASC";

        return $this->query($sql, [$companyId, $companyId]);
    }

    /**
     * Lista apenas convênios pai (principais)
     * 
     * @param int $companyId
     * @return array
     */
    public function listParentAgreements($companyId)
    {
        $sql = "SELECT 
                    ag.id, 
                    ag.title,
                    COUNT(DISTINCT e.id) as total_guides,
                    COUNT(DISTINCT child.id) as total_procedures
                FROM `app_agreement` ag
                LEFT JOIN `app_agreement` child ON child.sub_of = ag.id
                LEFT JOIN `{$this->table}` e ON (e.agreement = ag.id OR e.agreement = child.id)
                    AND e.company = ? 
                    AND (e.deleted IS NULL OR e.deleted = '' OR e.deleted = 'no')
                WHERE (ag.company = ? OR ag.company IS NULL)
                AND ag.sub_of IS NULL
                GROUP BY ag.id, ag.title
                ORDER BY ag.title ASC";

        return $this->query($sql, [$companyId, $companyId]);
    }

    /**
     * Estatísticas das guias
     * 
     * @param int $companyId
     * @param array $filters
     * @return array
     */
    public function getStatistics($companyId, $filters = [])
    {
        $whereClause = "WHERE e.company = ? AND (e.deleted IS NULL OR e.deleted = '' OR e.deleted = 'no')";
        $params = [$companyId];

        if (!empty($filters['agreement_name'])) {
            $whereClause .= " AND (ag.title LIKE ? OR ag_parent.title LIKE ?)";
            $params[] = '%' . $filters['agreement_name'] . '%';
            $params[] = '%' . $filters['agreement_name'] . '%';
        }

        if (!empty($filters['agreement_parent_id'])) {
            $whereClause .= " AND (ag.sub_of = ? OR ag.id = ?)";
            $params[] = $filters['agreement_parent_id'];
            $params[] = $filters['agreement_parent_id'];
        }

        if (!empty($filters['attendance_date_start'])) {
            $whereClause .= " AND e.attendance_day >= ?";
            $params[] = $filters['attendance_date_start'];
        }
        if (!empty($filters['attendance_date_end'])) {
            $whereClause .= " AND e.attendance_day <= ?";
            $params[] = $filters['attendance_date_end'];
        }

        if (!empty($filters['type'])) {
            $whereClause .= " AND e.type = ?";
            $params[] = $filters['type'];
        }

        $sql = "SELECT 
                    COUNT(*) as total_guides,
                    SUM(e.value) as total_value,
                    COUNT(DISTINCT e.patient) as unique_patients,
                    COUNT(DISTINCT e.user) as unique_professionals,
                    COUNT(CASE WHEN UPPER(e.status_guide) = 'AUTORIZADA' THEN 1 END) as authorized,
                    COUNT(CASE WHEN UPPER(e.status_guide) IN ('PENDENTE', 'NAO_ENCONTRADA') THEN 1 END) as pending,
                    COUNT(CASE WHEN UPPER(e.status_guide) = 'NEGADA' THEN 1 END) as denied,
                    COUNT(CASE WHEN e.checkin = 'yes' THEN 1 END) as with_checkin,
                    COUNT(CASE WHEN e.type = 'local' THEN 1 END) as type_local,
                    COUNT(CASE WHEN e.type = 'intercambio' THEN 1 END) as type_intercambio
                FROM `{$this->table}` e
                LEFT JOIN `app_agreement` ag ON e.agreement = ag.id
                LEFT JOIN `app_agreement` ag_parent ON ag.sub_of = ag_parent.id
                {$whereClause}";

        return $this->fetchOne($sql, $params);
    }
    
    
     /**
     * Busca dados do profissional executante para TISS
     */
    public function getExecutante($guideNumber, $companyId)
    {
        $sql = "SELECT 
                    u.document as cpf,
                    u.first_name,
                    u.last_name,
                    u.councilProfessional as council_id,
                    u.numberCouncil as council_number,
                    u.ufCouncil as uf,
                    occ.cbos
                FROM app_executions e
                LEFT JOIN users u ON e.user = u.id
                LEFT JOIN app_occupations occ ON u.occupation = occ.id
                WHERE e.guide_number = ? AND e.company = ?
                LIMIT 1";
        
        return $this->fetchOne($sql, [$guideNumber, $companyId]);
    }
    

    /**
     * Busca procedimentos pendentes de cobrança no SAW
     * 
     * @param string $guideNumber - Número da guia
     * @param int $companyId - ID da empresa
     * @return array
     */
    public function getPendingByGuideNumber($guideNumber, $companyId)
    {
        $sql = "SELECT 
                    e.id,
                    e.attendance_day,
                    e.attendance_start,
                    e.attendance_end,
                    e.status_guide,
                    e.saw_realizado_at,
                    p.first_name,
                    p.last_name
                FROM app_executions e
                INNER JOIN app_patient p 
                    ON e.patient = p.id
                WHERE 
                    e.guide_number = ?
                    AND e.company = ?
                    AND e.saw_realizado_at IS NULL
                    AND (e.deleted IS NULL OR e.deleted = '' OR e.deleted = 'no')
                ORDER BY e.attendance_day ASC;
";
        
        $rows = $this->query($sql, [$guideNumber, $companyId]);
        
        $procedimentos = [];
        $paciente = '';
        
        foreach ($rows as $row) {
            if (!$paciente) {
                $paciente = trim($row['first_name'] . ' ' . $row['last_name']);
            }
            
            // Formatar data DD/MM/YYYY
            $data = date('d/m/Y', strtotime($row['attendance_day']));
            $horaInicial = $row['attendance_start'] ? substr($row['attendance_start'], 0, 5) : '08:00';
            $horaFinal = $row['attendance_end'] ? substr($row['attendance_end'], 0, 5) : '08:30';
            
            $procedimentos[] = [
                'id' => (int)$row['id'],
                'data' => $data,
                'horaInicial' => $horaInicial,
                'horaFinal' => $horaFinal,
                'quantidade' => '1',
                'viaAcesso' => '1',
                'tecnica' => '1',
                'redAcresc' => '1.0'
            ];
        }
        
        return [
            'paciente' => $paciente,
            'procedimentos' => $procedimentos
        ];
    }
    
    /**
     * Marca uma execução individual como realizada
     */
    public function markExecutionAsRealized($executionId, $companyId, $data)
    {
        if (empty($executionId) || empty($companyId)) {
            return false;
        }
        
        $realized = !empty($data['realized']) ? 1 : 0;
        $attendanceDay = $data['attendance_day'] ?? null;
        $attendanceStart = $data['attendance_start'] ?? null;
        $attendanceEnd = $data['attendance_end'] ?? null;
        $observation = $data['observation'] ?? null;
        
        // Converter data DD/MM/YYYY -> YYYY-MM-DD
        if ($attendanceDay && strpos($attendanceDay, '/') !== false) {
            $dateParts = explode('/', $attendanceDay);
            if (count($dateParts) === 3) {
                $attendanceDay = $dateParts[2] . '-' . $dateParts[1] . '-' . $dateParts[0];
            }
        }
        
        if ($realized) {
            // Execução realizada com sucesso
            $sql = "UPDATE {$this->table} 
                    SET saw_realizado_at = NOW(),
                        status_guide = 'REALIZADA',
                        status = 'executed',
                        attendance_day = ?,
                        attendance_start = ?,
                        attendance_end = ?,
                        updated_at = NOW()
                    WHERE id = ?
                      AND company = ?
                      AND (deleted IS NULL OR deleted = '' OR deleted = 'no')";
            
            $params = [
                $attendanceDay,
                $attendanceStart,
                $attendanceEnd,
                $executionId,
                $companyId
            ];
        } else {
            // Execução falhou
            $sql = "UPDATE {$this->table} 
                    SET status_guide = 'ERRO',
                        observation = ?,
                        updated_at = NOW()
                    WHERE id = ?
                      AND company = ?
                      AND (deleted IS NULL OR deleted = '' OR deleted = 'no')";
            
            $params = [
                $observation,
                $executionId,
                $companyId
            ];
        }
        
        try {
            $result = $this->execute($sql, $params);
            return $result > 0;
        } catch (\Exception $e) {
            error_log("Erro ao atualizar execução {$executionId}: " . $e->getMessage());
            throw $e;
        }
    }
    
    /**
     * Busca uma execução por ID (para validação)
     * 
     * @param int $executionId
     * @param int $companyId
     * @return array|null
     */
    public function getExecutionById($executionId, $companyId)
    {
        $sql = "SELECT id, guide_number, attendance_day, attendance_start, attendance_end, status_guide, status 
                FROM {$this->table}
                WHERE id = ?
                  AND company = ?
                  AND (deleted IS NULL OR deleted = '' OR deleted = 'no')
                LIMIT 1";
        
        $result = $this->query($sql, [$executionId, $companyId]);
        return $result ? $result[0] : null;
    }
    
    /**
     * MÉTODO ANTIGO - MANTÉM PARA COMPATIBILIDADE (DEPRECATED)
     * Marca múltiplas execuções baseado em guide_number e data
     */
    public function markAsRealized($guideNumber, $companyId, $execucoes)
    {
        $updated = 0;
        
        foreach ($execucoes as $exec) {
            if (!empty($exec['success']) && !empty($exec['data'])) {
                // Converter data de DD/MM/YYYY para YYYY-MM-DD
                $dataParts = explode('/', $exec['data']);
                if (count($dataParts) === 3) {
                    $dataDb = $dateParts[2] . '-' . $dateParts[1] . '-' . $dateParts[0];
                    
                    $sql = "UPDATE {$this->table} 
                            SET saw_realizado_at = NOW(),
                                status_guide = 'REALIZADA'
                            WHERE guide_number = ?
                              AND company = ?
                              AND attendance_day = ?
                              AND (deleted IS NULL OR deleted = '' OR deleted = 'no')";
                    
                    $result = $this->execute($sql, [$guideNumber, $companyId, $dataDb]);
                    $updated += $result;
                }
            }
        }
        
        return $updated;
    }

}