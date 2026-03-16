<?php

class ReportController
{
    private $pdo;

    public function __construct(PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    public function generate(): void
    {
        $userId = $_GET['user_id'] ?? null;
        $month  = $_GET['month'] ?? null;

        if (!$userId || !$month) {
            http_response_code(400);
            header('Content-Type: application/json');
            echo json_encode(['success' => false, 'error' => 'Parâmetros user_id e month são obrigatórios']);
            return;
        }

        require_once __DIR__ . '/../Models/SublocationReport.php';
        $model = new SublocationReport($this->pdo);
        $result = $model->generateReport((int)$userId, $month);

        header('Content-Type: application/json');
        echo json_encode($result);
    }

    public function professionals(): void
    {
        require_once __DIR__ . '/../Models/SublocationReport.php';
        $model = new SublocationReport($this->pdo);
        $list = $model->listProfessionals();

        header('Content-Type: application/json');
        echo json_encode(['success' => true, 'data' => $list]);
    }

    public function deleteAppointment(int $appointmentId): void
    {
        header('Content-Type: application/json');

        if ($appointmentId <= 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID inválido']);
            return;
        }

        $check = $this->pdo->prepare("SELECT id, deleted FROM app_appointment WHERE id = :id LIMIT 1");
        $check->execute([':id' => $appointmentId]);
        $appt = $check->fetch(PDO::FETCH_ASSOC);

        if (!$appt) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'Atendimento não encontrado']);
            return;
        }

        if ($appt['deleted'] === 'yes') {
            echo json_encode(['success' => true, 'message' => 'Já estava excluído', 'id' => $appointmentId]);
            return;
        }

        $stmt = $this->pdo->prepare("UPDATE app_appointment 
                                        SET deleted = 'yes', 
                                            status = 'close', 
                                            canceled = 'yes',
                                            observation = CONCAT(COALESCE(observation, ''), ' | Excluido do relatorio de repasse da operadora')
                                        WHERE id = :id");
        $stmt->execute([':id' => $appointmentId]);

        echo json_encode(['success' => true, 'message' => 'Excluído permanentemente', 'id' => $appointmentId]);
    }

    public function getOperatorValue(): void
    {
        header('Content-Type: application/json');

        $operatorId   = (int)($_GET['operator_id'] ?? 0);
        $occupationId = (int)($_GET['occupation_id'] ?? 0);
        $userId       = (int)($_GET['user_id'] ?? 0);

        if (!$operatorId) {
            echo json_encode(['success' => true, 'data' => ['value' => 0, 'procedure' => 'Particular', 'doubled' => false]]);
            return;
        }

        // Busca nome da operadora
        $opStmt = $this->pdo->prepare("SELECT id, title FROM app_agreement WHERE id = :id LIMIT 1");
        $opStmt->execute([':id' => $operatorId]);
        $operator = $opStmt->fetch(PDO::FETCH_ASSOC);
        $operatorName = $operator['title'] ?? '';

        // Verifica override do profissional para esta operadora
        if ($userId > 0) {
            $overrideValue = $this->getOperatorOverrideValue($userId, $operatorName);
            if ($overrideValue !== null) {
                echo json_encode([
                    'success' => true,
                    'data' => [
                        'value' => round($overrideValue, 2),
                        'procedure' => $operatorName,
                        'doubled' => false,
                        'operator_name' => $operatorName,
                        'source' => 'professional_config',
                    ]
                ]);
                return;
            }
        }

        // Fallback: busca valor TISS
        $specialtyMap = [
            158 => '%psicolog%',
            160 => '%psicolog%',
            159 => '%psicomotricidade%',
            65  => '%fonoaudio%',
            148 => '%nutricion%',
        ];
        $unimedNoDouble = [159];
        $specialtyTerm = $specialtyMap[$occupationId] ?? null;
        $isUnimed = (stripos($operatorName, 'unimed') !== false);

        $value = 0;
        $procedure = 'Não encontrado';

        if ($specialtyTerm) {
            $sql = "SELECT title, value FROM app_agreement
                    WHERE sub_of = :opId AND title LIKE :term
                    AND value IS NOT NULL AND value > 0
                    ORDER BY value DESC LIMIT 1";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([':opId' => $operatorId, ':term' => $specialtyTerm]);
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($result) {
                $value = (float)$result['value'];
                $procedure = $result['title'];
            } else {
                $sql2 = "SELECT title, value FROM app_agreement WHERE id = :opId AND value IS NOT NULL AND value > 0 LIMIT 1";
                $stmt2 = $this->pdo->prepare($sql2);
                $stmt2->execute([':opId' => $operatorId]);
                $r2 = $stmt2->fetch(PDO::FETCH_ASSOC);
                if ($r2) {
                    $value = (float)$r2['value'];
                    $procedure = $r2['title'];
                }
            }
        }

        $doubled = false;
        if ($isUnimed && !in_array($occupationId, $unimedNoDouble) && $value > 0) {
            $value *= 2;
            $doubled = true;
        }

        echo json_encode([
            'success' => true,
            'data' => [
                'value' => round($value, 2),
                'procedure' => $procedure,
                'doubled' => $doubled,
                'operator_name' => $operatorName,
                'source' => 'tiss',
            ]
        ]);
    }

    /**
     * Busca valor de override do profissional para uma operadora.
     * Retorna null se nao houver override configurado.
     */
    private function getOperatorOverrideValue(int $userId, string $operatorName): ?float
    {
        if ($operatorName === '' || $operatorName === 'Particular') {
            // Particular nao tem override de operadora (valor = 0)
            return null;
        }

        $stmt = $this->pdo->prepare(
            "SELECT config_key, config_value FROM professional_config
             WHERE api_professional_id = :uid AND (config_key LIKE 'op_%' OR config_key LIKE 'operator_%')"
        );
        $stmt->execute([':uid' => $userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

        $normalizedTarget = mb_strtolower(trim($operatorName), 'UTF-8');

        foreach ($rows as $key => $value) {
            if (strpos($key, 'op_') === 0) {
                $encoded = substr($key, 3);
                $opName = base64_decode($encoded);
            } else {
                $opName = str_replace('_', ' ', substr($key, 9));
            }

            if ($opName !== false && mb_strtolower(trim($opName), 'UTF-8') === $normalizedTarget) {
                $val = (float)$value;
                if ($val > 0) {
                    return $val;
                }
            }
        }

        return null;
    }
}
