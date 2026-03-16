<?php

namespace Source\App\Clinic;

use DateTime;
use GuzzleHttp\Client;
use GuzzleHttp\Psr7\Request;
use Source\Core\Connect;
use Source\Models\App\AppAppointments;
use Source\Models\App\AppCompany;
use Source\Models\App\AppPatient;
use Source\Models\App\AppSubscription;
use Source\Models\User;

class SendZApi
{
    private $instanceId;
    private $token;
    private $securityToken;
    private $baseUrl;
    private $client;

    public function __construct()
    {
        setlocale(LC_TIME, 'pt_BR');
        date_default_timezone_set('America/Sao_Paulo');

        // Configurações Z-API - usando as credenciais que funcionaram
        $this->instanceId = '3EA1241A8BBA01E785FB1A87054F898A';
        $this->token = 'BFC630F7636361A4F1CB56AD';
        $this->securityToken = 'F36f3ab03fd2c4efe916f9ff3de7620baS';
        $this->baseUrl = "https://api.z-api.io/instances/{$this->instanceId}/token/{$this->token}";

        $this->client = new Client([
            'connect_timeout' => 10,
            'timeout' => 30
        ]);
        
        flush();
    }

    private function logRealTime(string $message): void
    {
        flush(); // Força output imediato
    }

    private function enviarRequisicaoAsync(string $url, array $data = [], string $method = 'POST'): ?\stdClass
    {
        $this->logRealTime("🔄 Fazendo requisição: {$method} {$url}");
        
        try {
            $options = [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'Client-Token' => $this->securityToken
                ]
            ];
            
            if ($method === 'POST') {
                $options['json'] = $data;
                $this->logRealTime("📤 Dados enviados: " . json_encode($data));
            }

            $response = $this->client->request($method, $url, $options);
            $responseBody = $response->getBody()->getContents();
            $httpCode = $response->getStatusCode();
            
            $this->logRealTime("✅ HTTP {$httpCode} - Response: " . substr($responseBody, 0, 200) . (strlen($responseBody) > 200 ? "..." : ""));
            
            $result = json_decode($responseBody);
            
            return (object)[
                "isValid" => $httpCode === 200 ? 'true' : 'false',
                "result" => $result,
                "message" => "Sucesso"
            ];
            
        } catch (\GuzzleHttp\Exception\RequestException $e) {
            $errorMsg = "❌ Erro Z-API: " . $e->getMessage();
            $this->logRealTime($errorMsg);
            error_log($errorMsg);
            return (object)[
                "isValid" => 'false',
                "message" => $errorMsg
            ];
        } catch (\Exception $e) {
            $errorMsg = "❌ Erro inesperado: " . $e->getMessage();
            $this->logRealTime($errorMsg);
            error_log($errorMsg);
            return (object)[
                "isValid" => 'false',
                "message" => $errorMsg
            ];
        }
    }

    public function sendWhatsHallo(string $message, string $phone): ?\stdClass
    {
        $phoneFormatted = phone_whatsapp_zapi($phone);
        $this->logRealTime("📱 Enviando para: {$phone} → {$phoneFormatted}");
        
        $data = [
            'phone' => $phoneFormatted,
            'message' => $message
        ];

        $response = $this->enviarRequisicaoAsync($this->baseUrl . '/send-text', $data);
        
        // Compatibilidade com retorno da Hallo API
        if ($response && $response->isValid === 'true' && isset($response->result)) {
            $response->result->message_id = $response->result->messageId ?? $response->result->id ?? uniqid();
            $this->logRealTime("✅ Mensagem enviada! ID: {$response->result->message_id}");
        } else {
            $this->logRealTime("❌ Falha no envio: " . ($response->message ?? 'Erro desconhecido'));
        }
        
        return $response;
    }

    public function sendWhatsAppSystemMessage(): void
    {
        $this->logRealTime("🚀 === INICIANDO ENVIO DE MENSAGENS ===");
        
        $companies = (new AppCompany())->find("sendwhats = 1")->fetch(true);

        if (!$companies) {
            $this->logRealTime("⚠️ Nenhuma empresa configurada para envio automático");
            return;
        }

        $this->logRealTime("🏢 Empresas encontradas: " . count($companies));

        foreach ($companies as $company) {
            $hours = $company->advance_hours ?? 20;
            $this->logRealTime("🔍 Empresa ID {$company->id} - Antecedência: {$hours}h");

            $stmt = Connect::getInstance()->prepare("
                SELECT * FROM app_appointment
                WHERE company = :company
                  AND (absence = 'no' OR absence IS NULL)
                  AND (justified = 'no' OR justified IS NULL)
                  AND (realized = 'no' OR realized IS NULL)
                  AND (aboned = 'no' OR aboned IS NULL)
                  AND (canceled = 'no' OR canceled IS NULL)
                  AND day >= NOW()
                  AND day < (NOW() + INTERVAL {$hours} HOUR)
                  AND (sent_whats = 'no' OR sent_whats IS NULL)
                ORDER BY day ASC
                LIMIT 50
            ");
            $stmt->execute(['company' => $company->id]);
            $appointments = $stmt->fetchAll();

            $this->logRealTime("📅 Agendamentos encontrados: " . count($appointments));

            foreach ($appointments as $row) {
                $appointment = (new AppAppointments())->findById($row->id);
                if (!$appointment) {
                    $this->logRealTime("⚠️ Agendamento ID {$row->id} não encontrado");
                    continue;
                }

                $patient = (new AppPatient())->findById($appointment->patient);
                $professional = (new User())->findById($appointment->user);

                if (!$patient || !$professional || !$patient->mobile) {
                    $this->logRealTime("⚠️ Dados incompletos - Agendamento ID {$appointment->id}");
                    continue;
                }

                $this->logRealTime("👤 Paciente: {$patient->first_name} ({$patient->mobile})");

                // Verifica se é número WhatsApp válido
                if (!$this->isWhatsApp(phone_whatsapp_zapi($patient->mobile))) {
                    $this->logRealTime("❌ Número sem WhatsApp: {$patient->mobile}");
                    continue;
                }

                $hora = date_fmt_hr_min($appointment->day);
                $data = date_fmt_br_date($appointment->day);
                $msg = "Olá *{$patient->first_name}*, você tem uma consulta com *{$professional->first_name}* no dia *{$data}* às *{$hora}*.

                Pedimos que chegue com *10 minutos de antecedência* para a realização do *TOKEN biométrico* antes de seu atendimento.";

                if (!in_array($appointment->hash, ['confirmed', 'canceled', 'aboned', 'not-realized'])) {
                    $msg .= "\n\nPara *CONFIRMAR* ou *CANCELAR* seu agendamento, clique aqui: " . url("/confirma/agenda/{$appointment->hash}");
                }

                $this->logRealTime("💬 Enviando lembrete para {$patient->first_name}...");
                $res = $this->sendWhatsHallo($msg, $patient->mobile);

                if ($res && $res->isValid === 'true' && !empty($res->result->message_id)) {
                    // Sincronizar contato no Chatwoot
                    $this->syncChatwootContact($patient->mobile, $patient->first_name);
                    $appointment->sent_whats = 'yes';
                    $appointment->message_id = $res->result->message_id;
                    $appointment->observation .= "\nMensagem enviada via Z-API cron em " . date("d/m/Y H:i");
                    $this->logRealTime("✅ SUCESSO! Mensagem salva no banco");
                } else {
                    $appointment->sent_whats = 'failed';
                    $appointment->observation .= "\nFalha ao enviar mensagem via Z-API cron: " . ($res->message ?? 'Erro desconhecido');
                    $this->logRealTime("❌ FALHA! Erro salvo no banco");
                }

                $appointment->save();
                $this->logRealTime("⏱️ Aguardando 2 segundos...");
                sleep(2);
            }
        }
        
        $this->logRealTime("🏁 === ENVIO FINALIZADO ===");
    }

    public function isWhatsApp($phone): bool
    {
        $this->logRealTime("🔍 Verificando WhatsApp: {$phone}");
        $result = $this->enviarRequisicaoAsync($this->baseUrl . '/phone-exists/' . $phone, [], 'GET');
        
        $hasWhatsApp = false;
        if ($result && $result->isValid === 'true' && isset($result->result)) {
            $hasWhatsApp = ($result->result->exists === true || $result->result->exists === 'true');
        }
        
        $this->logRealTime("📱 Resultado: " . ($hasWhatsApp ? "TEM WhatsApp" : "NÃO TEM WhatsApp"));
        return $hasWhatsApp;
    }

    public function getStatusDevice(): ?\stdClass
    {
        return $this->enviarRequisicaoAsync($this->baseUrl . '/status', [], 'GET');
    }

    public function getImgQrCode(): ?string
    {
        $result = $this->enviarRequisicaoAsync($this->baseUrl . '/qr-code/image', [], 'GET');
        
        if ($result && $result->isValid === 'true') {
            if (isset($result->result->value)) {
                $value = $result->result->value;
                if (strpos($value, 'data:image') === 0) {
                    return explode(',', $value, 2)[1];
                }
                return $value;
            }
        }
        return null;
    }

    public function autoReadMessage(string $status = 'false'): ?\stdClass
    {
        return (object)[
            "isValid" => 'true',
            "message" => "Função não disponível na Z-API"
        ];
    }

    public function getReturnMessage(): string
    {
        try {
            $request = new Request('POST', ZAPI_WEBHOOK ?? '');
            $res = $this->client->sendAsync($request)->wait();
            return $res->getBody();
        } catch (\Exception $e) {
            error_log("Erro ao obter retorno do webhook Z-API: " . $e->getMessage());
            return "Erro ao obter mensagem de retorno";
        }
    }

    private function syncChatwootContact(string $phone, string $patientName): void
    {
        try {
            $this->logRealTime("🔗 Sincronizando contato no Chatwoot...");
            
            $data = [
                "phone" => $phone,
                "patient_name" => $patientName
            ];
            
            $ch = curl_init("https://consultoriopro.com.br/service/api/v1/chatwoot/sync-contact");
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_HTTPHEADER => [
                    "Content-Type: application/json",
                    "X-API-Key: e877ba1c49319300be89bee57a9f11581c0b65c3326ddaf9121b414bafed5960"
                ],
                CURLOPT_POSTFIELDS => json_encode($data)
            ]);
            
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($httpCode === 200) {
                $result = json_decode($response, true);
                $action = $result["data"]["action"] ?? "unknown";
                $contactId = $result["data"]["contact_id"] ?? "N/A";
                $this->logRealTime("✅ Chatwoot sync: {$action} (ID: {$contactId})");
            } else {
                $this->logRealTime("⚠️ Chatwoot sync falhou: HTTP {$httpCode}");
            }
        } catch (\Exception $e) {
            $this->logRealTime("❌ Erro Chatwoot sync: " . $e->getMessage());
        }
    }
}