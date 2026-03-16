<?php

namespace API\Helpers;

use API\Helpers\Response;

class ChatwootSync
{
    private $chatwootBaseUrl;
    private $chatwootAccountId;
    private $chatwootApiToken;
    private $zApiInstanceId;
    private $zApiToken;
    private $zApiClientToken;
    private $zApiBaseUrl;

    public function __construct()
    {
        // Configurações Chatwoot
        $this->chatwootBaseUrl = 'https://chatwoot.dedicaremulti.com.br';
        $this->chatwootAccountId = '1';
        $this->chatwootApiToken = 'Thb821uY75E22jAs4PwCdUJk';
        
        // Configurações Z-API (iguais ao ZApiClient)
        $this->zApiInstanceId = '3EA1241A8BBA01E785FB1A87054F898A';
        $this->zApiToken = 'BFC630F7636361A4F1CB56AD';
        $this->zApiClientToken = 'F36f3ab03fd2c4efe916f9ff3de7620baS';
        $this->zApiBaseUrl = "https://api.z-api.io/instances/{$this->zApiInstanceId}/token/{$this->zApiToken}";
    }

    /**
     * Método principal - sincroniza contato após envio de mensagem
     * ESTRATÉGIA: Tentar criar primeiro, se der erro 422, buscar e atualizar
     */
    public function syncContactAfterMessage(string $phone, string $patientName = null): array
    {
        try {
            // 1. Formatar telefone
            $formattedPhone = $this->formatPhone($phone);
            $phoneWithPlus = $this->formatPhoneForChatwoot($phone);
            $formattedPhone = $this->formatPhone($phone);
            
            // 2. Buscar dados extras (opcional)
            $avatarUrl = $this->getContactProfilePicture($formattedPhone);
            
            // 3. Preparar dados para Chatwoot
            $chatwootData = [
                'name' => $patientName ?: 'Paciente',
                'phone_number' => $phoneWithPlus,
                'identifier' => $formattedPhone
            ];

            if ($avatarUrl) {
                $chatwootData['avatar_url'] = $avatarUrl;
            }
            
            // 4. ESTRATÉGIA: Tentar criar primeiro
            try {
                $result = $this->createChatwootContact($chatwootData);
                return [
                    'success' => true,
                    'action' => 'created',
                    'contact_id' => $result['payload']['contact']['id'] ?? null,
                    'data' => $result
                ];
            } catch (\Exception $createError) {
                // Se deu erro 422 (já existe), buscar e atualizar
                if (strpos($createError->getMessage(), '422') !== false) {
                    
                    // Buscar contato existente
                    $existingContact = $this->findChatwootContactByIdentifier($formattedPhone);
                    
                    if ($existingContact) {
                        // Atualizar apenas nome e avatar (não identifier/phone)
                        $updateData = [
                            'name' => $patientName ?: 'Paciente'
                        ];
                        if ($avatarUrl) {
                            $updateData['avatar_url'] = $avatarUrl;
                        }
                        
                        $result = $this->updateChatwootContact($existingContact['id'], $updateData);
                        return [
                            'success' => true,
                            'action' => 'updated',
                            'contact_id' => $existingContact['id'],
                            'data' => $result
                        ];
                    }
                }
                
                // Se não foi erro 422 ou não encontrou o contato, re-lançar erro
                throw $createError;
            }

        } catch (\Exception $e) {
            error_log("Erro ChatwootSync: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Busca contato por identifier (mais eficiente que por phone)
     */
    private function findChatwootContactByIdentifier(string $identifier): ?array
    {
        try {
            // Buscar na lista completa de contatos (mais eficaz)
            $url = "{$this->chatwootBaseUrl}/api/v1/accounts/{$this->chatwootAccountId}/contacts";
            $response = $this->makeChatwootRequest($url, [], 'GET');
            
            if (isset($response['payload']) && is_array($response['payload'])) {
                foreach ($response['payload'] as $contact) {
                    // Buscar por identifier OU por telefone
                    $contactPhone = $contact['phone_number'] ?? '';
                    $contactId = $contact['identifier'] ?? '';
                    
                    if ($contactId === $identifier || 
                        $this->normalizePhoneForComparison($contactPhone) === $this->normalizePhoneForComparison($identifier) ||
                        $this->normalizePhoneForComparison($contactPhone) === $this->normalizePhoneForComparison('+'.$identifier)) {
                        return $contact;
                    }
                }
            }
            
            return null;
        } catch (\Exception $e) {
            error_log("Erro busca contato: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Busca foto do perfil no WhatsApp
     */
    private function getContactProfilePicture(string $phone): ?string
    {
        try {
            $url = $this->zApiBaseUrl . "/profile-picture?phone={$phone}";
            $response = $this->makeZApiRequest($url, [], 'GET');
            
            return $response['link'] ?? null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Cria novo contato no Chatwoot
     */
    private function createChatwootContact(array $data): array
    {
        $url = "{$this->chatwootBaseUrl}/api/v1/accounts/{$this->chatwootAccountId}/contacts";
        return $this->makeChatwootRequest($url, $data, 'POST');
    }

    /**
     * Atualiza contato existente no Chatwoot
     */
    private function updateChatwootContact(int $contactId, array $data): array
    {
        $url = "{$this->chatwootBaseUrl}/api/v1/accounts/{$this->chatwootAccountId}/contacts/{$contactId}";
        return $this->makeChatwootRequest($url, $data, 'PUT');
    }

    /**
     * Faz requisição para Z-API
     */
    private function makeZApiRequest(string $url, array $data = [], string $method = 'POST'): array
    {
        $ch = curl_init($url);

        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Client-Token: ' . $this->zApiClientToken
            ],
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10
        ];

        if ($method === 'POST') {
            $options[CURLOPT_POST] = true;
            $options[CURLOPT_POSTFIELDS] = json_encode($data);
        }

        curl_setopt_array($ch, $options);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);

        curl_close($ch);

        if ($error) {
            throw new \Exception("Erro Z-API: {$error}");
        }

        $result = json_decode($response, true);

        if ($httpCode !== 200) {
            throw new \Exception("Z-API HTTP {$httpCode}: " . ($result['error'] ?? 'Erro desconhecido'));
        }

        return $result;
    }

    /**
     * Faz requisição para Chatwoot
     */
    private function makeChatwootRequest(string $url, array $data = [], string $method = 'POST'): array
    {
        $ch = curl_init($url);

        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'api_access_token: ' . $this->chatwootApiToken
            ],
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CONNECTTIMEOUT => 10
        ];

        if (in_array($method, ['POST', 'PUT'])) {
            $options[CURLOPT_CUSTOMREQUEST] = $method;
            $options[CURLOPT_POSTFIELDS] = json_encode($data);
        }

        curl_setopt_array($ch, $options);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);

        curl_close($ch);

        if ($error) {
            throw new \Exception("Erro Chatwoot: {$error}");
        }

        $result = json_decode($response, true);

        if (!in_array($httpCode, [200, 201, 204])) {
            throw new \Exception("Chatwoot HTTP {$httpCode}: " . json_encode($result));
        }

        return $result ?: [];
    }

    /**
     * Formata telefone para padrão completo (+5511999999999)
     */
    private function formatPhone(string $phone): string
    {
        // Remove todos os caracteres não numéricos
        $cleanPhone = preg_replace('/[^0-9]/', '', $phone);
        
        // Se já tem 13 dígitos (55 + DDD + número), mantém
        if (strlen($cleanPhone) >= 13) {
            $cleanPhone = substr($cleanPhone, 0, 13);
        }
        // Se tem 11 dígitos (DDD + número), adiciona 55
        elseif (strlen($cleanPhone) >= 10) {
            $cleanPhone = '55' . $cleanPhone;
        }
        // Se tem menos, adiciona 55 + assume DDD padrão
        else {
            $cleanPhone = '5573' . $cleanPhone;
        }
        
        return $cleanPhone;
    }
    
    /**
     * Formata telefone para Chatwoot (sempre com +)
     */
    private function formatPhoneForChatwoot(string $phone): string
    {
        return '+' . $this->formatPhone($phone);

    /**
     * Normaliza telefone para comparação (só números)
     */
    private function normalizePhoneForComparison(string $phone): string
    {
        $clean = preg_replace('/[^0-9]/', '', $phone);
        // Sempre garantir formato com 55
        if (strlen($clean) >= 11 && substr($clean, 0, 2) !== '55') {
            $clean = '55' . $clean;
        }
        return $clean;
    }
    }
}
