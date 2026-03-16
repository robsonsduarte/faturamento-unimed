<?php
namespace API\Models;

class TissLote extends BaseModel
{
    protected $table = 'app_xml_lote_header';
    protected $primaryKey = 'id';

    protected $fillable = [
        'company',
        'numero_lote',
        'hash',
        'qtd_guias',
        'valor_total',
        'arquivo',
        'status',
        'data_envio',
        'created_at',
        'updated_at'
    ];

    /**
     * Busca lotes por empresa
     */
    public function getByCompany($companyId, $limit = 50, $offset = 0)
    {
        $sql = "SELECT * FROM `{$this->table}` 
                WHERE `company` = ? 
                ORDER BY `created_at` DESC 
                LIMIT ? OFFSET ?";

        return $this->query($sql, [$companyId, $limit, $offset]);
    }

    /**
     * Busca lote com detalhes das guias
     */
    public function findWithGuias($loteId, $companyId)
    {
        $sql = "SELECT l.*, 
                (SELECT COUNT(*) FROM app_xml_lote g WHERE g.lote_header_id = l.id) as total_guias
                FROM `{$this->table}` l
                WHERE l.id = ? AND l.company = ?
                LIMIT 1";

        return $this->fetchOne($sql, [$loteId, $companyId]);
    }

    /**
     * ObtÃ©m prÃ³ximo nÃºmero de lote para a empresa
     */
    public function getNextLoteNumber($companyId)
    {
        $sql = "SELECT COALESCE(MAX(numero_lote), 0) + 1 as next_lote 
                FROM `{$this->table}` 
                WHERE `company` = ?";

        $result = $this->fetchOne($sql, [$companyId]);
        return (int)($result['next_lote'] ?? 1);
    }

    /**
     * Conta lotes por empresa
     */
    public function countByCompany($companyId, $status = null)
    {
        $sql = "SELECT COUNT(*) as total FROM `{$this->table}` WHERE `company` = ?";
        $params = [$companyId];

        if ($status) {
            $sql .= " AND `status` = ?";
            $params[] = $status;
        }

        $result = $this->fetchOne($sql, $params);
        return (int)($result['total'] ?? 0);
    }

    /**
     * Atualiza status do lote
     */
    public function updateStatus($loteId, $status)
    {
        return $this->update($loteId, [
            'status' => $status,
            'updated_at' => date('Y-m-d H:i:s')
        ]);
    }

    /**
     * Marca lote como enviado
     */
    public function markAsEnviado($loteId)
    {
        return $this->update($loteId, [
            'status' => 'enviado',
            'data_envio' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s')
        ]);
    }
}