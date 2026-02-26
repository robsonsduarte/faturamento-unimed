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

/**
 * Classe para integração com Evolution API
 * Substitui a integração com Z-API mantendo compatibilidade com o sistema existente
 *
 * Clínica Dedicare - Evolution API
 * URL: https://evolution.dedicaremulti.com.br
 * Instância: Dedicare
 */
class SendEvolutionApi
{
    private string $baseUrl;
    private string $apiKey;
    private string $instance;
    private Client $client;

    public function __construct()
    {
        setlocale(LC_TIME, 'pt_BR');
        date_default_timezone_set('America/Sao_Paulo');

        // Configurações Evolution API - Clínica Dedicare
        $this->baseUrl = 'https://evolution.dedicaremulti.com.br';
        $this->apiKey = '825CF0B47802-4F4D-BE0C-7E01579247DC';
        $this->instance = 'Dedicare';

        $this->client = new Client([
            'connect_timeout' => 10,
            'timeout' => 30
        ]);

        flush();
    }

    private function logRealTime(string $message): void
    {
        echo $message . "\n";
        flush();
    }

    /**
     * Envia requisição para a Evolution API
     */
    private function enviarRequisicaoAsync(string $endpoint, array $data = [], string $method = 'POST'): ?\stdClass
    {
        $url = $this->baseUrl . $endpoint;

        try {
            $options = [
                'headers' => [
                    'Content-Type' => 'application/json',
                    'apikey' => $this->apiKey
                ]
            ];

            if ($method === 'POST' && !empty($data)) {
                $options['json'] = $data;
            }

            $response = $this->client->request($method, $url, $options);
            $responseBody = $response->getBody()->getContents();
            $httpCode = $response->getStatusCode();

            $result = json_decode($responseBody);

            return (object)[
                "isValid" => ($httpCode >= 200 && $httpCode < 300) ? 'true' : 'false',
                "result" => $result,
                "message" => "Sucesso"
            ];

        } catch (\GuzzleHttp\Exception\RequestException $e) {
            $errorMsg = "Erro Evolution API: " . $e->getMessage();
            error_log($errorMsg);
            return (object)[
                "isValid" => 'false',
                "message" => $errorMsg
            ];
        } catch (\Exception $e) {
            $errorMsg = "Erro inesperado: " . $e->getMessage();
            error_log($errorMsg);
            return (object)[
                "isValid" => 'false',
                "message" => $errorMsg
            ];
        }
    }

    /**
     * Envia mensagem de texto via WhatsApp
     * Mantém compatibilidade com o método sendWhatsHallo da Z-API
     *
     * @param string $message Texto da mensagem
     * @param string $phone Número do telefone
     * @return \stdClass|null Resposta da API
     */
    public function sendWhatsHallo(string $message, string $phone): ?\stdClass
    {
        $phoneFormatted = $this->formatPhoneForEvolution($phone);

        $data = [
            'number' => $phoneFormatted,
            'text' => $message,
            'delay' => 1200
        ];

        $endpoint = "/message/sendText/{$this->instance}";
        $response = $this->enviarRequisicaoAsync($endpoint, $data);

        // Compatibilidade com retorno esperado pelo sistema
        if ($response && $response->isValid === 'true' && isset($response->result)) {
            // Evolution API retorna key.id como identificador da mensagem
            $messageId = $response->result->key->id ??
                         $response->result->messageId ??
                         $response->result->id ??
                         uniqid('evo_');
            $response->result->message_id = $messageId;
        }

        return $response;
    }

    /**
     * Formata número de telefone para o padrão Evolution API
     * Formato esperado: código do país + DDD + número (apenas dígitos)
     * Exemplo: 5511999999999
     */
    private function formatPhoneForEvolution(string $phone): string
    {
        // Remove tudo que não é número
        $phone = preg_replace('/[^0-9]/', '', $phone);

        // Se já começa com 55 (Brasil), retorna como está
        if (strlen($phone) >= 12 && substr($phone, 0, 2) === '55') {
            return $phone;
        }

        // Adiciona código do Brasil se não tiver
        if (strlen($phone) === 11 || strlen($phone) === 10) {
            return '55' . $phone;
        }

        return $phone;
    }

    /**
     * Envia mensagens automáticas de lembrete de consulta
     * Mantém a mesma lógica do sistema original
     */
    public function sendWhatsAppSystemMessage(): void
    {
        $companies = (new AppCompany())->find("sendwhats = 1")->fetch(true);

        if (!$companies) {
            return;
        }

        foreach ($companies as $company) {
            $hours = $company->advance_hours ?? 20;

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

            foreach ($appointments as $row) {
                $appointment = (new AppAppointments())->findById($row->id);
                if (!$appointment) {
                    continue;
                }

                $patient = (new AppPatient())->findById($appointment->patient);
                $professional = (new User())->findById($appointment->user);

                if (!$patient || !$professional) {
                    continue;
                }

                if (empty($patient->mobile) || trim($patient->mobile) === '') {
                    continue;
                }

                $formattedPhone = $this->formatPhoneForEvolution($patient->mobile);
                if (empty($formattedPhone)) {
                    continue;
                }

                // Verifica se é número WhatsApp válido
                if (!$this->isWhatsApp($formattedPhone)) {
                    continue;
                }

                $hora = date_fmt_hr_min($appointment->day);
                $data = date_fmt_br_date($appointment->day);
                $msg = "Olá *{$patient->first_name}*, você tem uma consulta com *{$professional->first_name}* no dia *{$data}* às *{$hora}*.

Pedimos que chegue com *10 minutos de antecedência* para a realização do *TOKEN biométrico* antes de seu atendimento.";

                if (!in_array($appointment->hash, ['confirmed', 'canceled', 'aboned', 'not-realized'])) {
                    $msg .= "\n\nPara *CONFIRMAR* ou *CANCELAR* seu agendamento, clique aqui: " . url("/confirma/agenda/{$appointment->hash}");
                }

                $res = $this->sendWhatsHallo($msg, $patient->mobile);

                if ($res && $res->isValid === 'true' && !empty($res->result->message_id)) {
                    // Sincronizar contato no Chatwoot
                    $this->syncChatwootContact($patient->mobile, trim($patient->first_name . " " . $patient->last_name));

                    $appointment->sent_whats = 'yes';
                    $appointment->message_id = $res->result->message_id;
                    $appointment->observation .= "\nMensagem enviada via Evolution API cron em " . date("d/m/Y H:i");
                } else {
                    $appointment->sent_whats = 'failed';
                    $appointment->observation .= "\nFalha ao enviar mensagem via Evolution API cron: " . ($res->message ?? 'Erro desconhecido');
                }

                $appointment->save();
                sleep(2);
            }
        }
    }

    /**
     * Verifica se um número tem WhatsApp
     *
     * @param string $phone Número formatado
     * @return bool
     */
    public function isWhatsApp(string $phone): bool
    {
        if (empty($phone)) {
            return false;
        }

        $formattedPhone = $this->formatPhoneForEvolution($phone);

        $data = [
            'numbers' => [$formattedPhone]
        ];

        $endpoint = "/chat/whatsappNumbers/{$this->instance}";
        $result = $this->enviarRequisicaoAsync($endpoint, $data);

        if ($result && $result->isValid === 'true' && isset($result->result)) {
            // Evolution API retorna array de números verificados
            if (is_array($result->result)) {
                foreach ($result->result as $item) {
                    if (isset($item->exists) && $item->exists === true) {
                        return true;
                    }
                    // Formato alternativo de resposta
                    if (isset($item->jid) && !empty($item->jid)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Obtém o status da conexão do dispositivo/instância
     *
     * @return \stdClass|null
     */
    public function getStatusDevice(): ?\stdClass
    {
        $endpoint = "/instance/connectionState/{$this->instance}";
        return $this->enviarRequisicaoAsync($endpoint, [], 'GET');
    }

    /**
     * Obtém a imagem do QR Code para conexão
     *
     * @return string|null Base64 da imagem do QR Code
     */
    public function getImgQrCode(): ?string
    {
        $endpoint = "/instance/connect/{$this->instance}";
        $result = $this->enviarRequisicaoAsync($endpoint, [], 'GET');

        if ($result && $result->isValid === 'true' && isset($result->result)) {
            // Evolution API pode retornar em diferentes formatos
            if (isset($result->result->base64)) {
                $value = $result->result->base64;
                if (strpos($value, 'data:image') === 0) {
                    return explode(',', $value, 2)[1];
                }
                return $value;
            }

            if (isset($result->result->qrcode)) {
                $value = $result->result->qrcode;
                if (strpos($value, 'data:image') === 0) {
                    return explode(',', $value, 2)[1];
                }
                return $value;
            }

            // Retorna o código raw se disponível
            if (isset($result->result->code)) {
                return $result->result->code;
            }
        }

        return null;
    }

    /**
     * Função placeholder - Evolution API não requer esta funcionalidade
     */
    public function autoReadMessage(string $status = 'false'): ?\stdClass
    {
        return (object)[
            "isValid" => 'true',
            "message" => "Função não necessária na Evolution API"
        ];
    }

    /**
     * Processa webhook de mensagens recebidas
     */
    public function getReturnMessage(): string
    {
        try {
            $webhookUrl = defined('EVOLUTION_WEBHOOK') ? EVOLUTION_WEBHOOK : '';
            if (empty($webhookUrl)) {
                return "Webhook não configurado";
            }

            $request = new Request('POST', $webhookUrl);
            $res = $this->client->sendAsync($request)->wait();
            return $res->getBody();
        } catch (\Exception $e) {
            error_log("Erro ao obter retorno do webhook Evolution API: " . $e->getMessage());
            return "Erro ao obter mensagem de retorno";
        }
    }

    /**
     * Sincroniza contato com Chatwoot
     */
    private function syncChatwootContact(string $phone, string $patientName): void
    {
        try {
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

            if ($httpCode === 200 || $httpCode === 201) {
                $result = json_decode($response, true);
                $action = $result["data"]["action"] ?? "unknown";
                $contactId = $result["data"]["contact_id"] ?? "N/A";
            }
        } catch (\Exception $e) {
            // Silenciosamente ignora erros de sync
        }
    }

    /**
     * Obtém o nome do contato no WhatsApp
     */
    private function getWhatsAppContactName(string $phone): ?string
    {
        try {
            $formattedPhone = $this->formatPhoneForEvolution($phone);

            $data = [
                'number' => $formattedPhone
            ];

            $endpoint = "/chat/fetchProfile/{$this->instance}";
            $result = $this->enviarRequisicaoAsync($endpoint, $data);

            if ($result && $result->isValid === "true" && isset($result->result)) {
                // Evolution API retorna perfil com nome
                return $result->result->name ??
                       $result->result->pushName ??
                       $result->result->verifiedName ??
                       null;
            }
            return null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Obtém nome do paciente para Chatwoot
     */
    private function getPatientNameForChatwoot($patient): string
    {
        $fullName = trim(($patient->first_name ?? "") . " " . ($patient->last_name ?? ""));
        if (!empty($fullName) && $fullName !== " ") {
            return $fullName;
        }

        $whatsappName = $this->getWhatsAppContactName($patient->mobile);
        if (!empty($whatsappName)) {
            return $whatsappName;
        }

        return "Paciente";
    }

    /**
     * Envia mensagem com mídia (imagem, documento, etc)
     * Funcionalidade adicional da Evolution API
     */
    public function sendMedia(string $phone, string $mediaUrl, string $caption = '', string $mediaType = 'image'): ?\stdClass
    {
        $phoneFormatted = $this->formatPhoneForEvolution($phone);

        $endpoint = "/message/sendMedia/{$this->instance}";

        $data = [
            'number' => $phoneFormatted,
            'options' => [
                'delay' => 1200,
                'presence' => 'composing'
            ],
            'mediaMessage' => [
                'mediatype' => $mediaType,
                'caption' => $caption,
                'media' => $mediaUrl
            ]
        ];

        return $this->enviarRequisicaoAsync($endpoint, $data);
    }

    /**
     * Desconecta a instância WhatsApp
     */
    public function logout(): ?\stdClass
    {
        $endpoint = "/instance/logout/{$this->instance}";
        return $this->enviarRequisicaoAsync($endpoint, [], 'DELETE');
    }

    /**
     * Reinicia a instância WhatsApp
     */
    public function restart(): ?\stdClass
    {
        $endpoint = "/instance/restart/{$this->instance}";
        return $this->enviarRequisicaoAsync($endpoint, [], 'PUT');
    }
}
