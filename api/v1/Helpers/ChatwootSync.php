<?php

namespace API\Helpers;

class ChatwootSync
{
    private $chatwootBaseUrl = 'https://chatwoot.dedicaremulti.com.br';
    private $chatwootAccountId = '1';
    private $chatwootApiToken = 'Thb821uY75E22jAs4PwCdUJk';
    private $zApiInstanceId = '3EA1241A8BBA01E785FB1A87054F898A';
    private $zApiToken = 'BFC630F7636361A4F1CB56AD';
    private $zApiClientToken = 'F29f5f1e6a00d473887c5583a015ed167S';
    private $zApiBaseUrl;

    public function __construct()
    {
        $this->zApiBaseUrl = "https://api.z-api.io/instances/{$this->zApiInstanceId}/token/{$this->zApiToken}";
    }

    /**
     * Método principal de sincronização
     */
    public function syncContactAfterMessage(string $phone, string $patientName = null): array
    {
        try {
            $formattedPhone = $this->normalizePhone($phone);
            $phoneWithPlus = '+' . $formattedPhone;
            
            // 1. Buscar contato existente no Chatwoot
            $existingContact = $this->findChatwootContact($phoneWithPlus);
            
            // 2. Buscar dados do WhatsApp
            $whatsappData = $this->getWhatsAppContactData($formattedPhone);
            
            // 3. Definir nome final (prioridade: form > whatsapp > padrão)
            $finalName = $this->resolveFinalName($patientName, $whatsappData);
            
            // 4. Atualizar ou criar contato
            if ($existingContact) {
                return $this->updateExistingContact($existingContact, $finalName, $whatsappData);
            } else {
                return $this->createNewContact($phoneWithPlus, $formattedPhone, $finalName, $whatsappData);
            }
            
        } catch (\Exception $e) {
            error_log("ChatwootSync Error: " . $e->getMessage());
            return [
                'success' => false,
                'error' => $e->getMessage()
            ];
        }
    }

    /**
     * Buscar contato existente no Chatwoot via Search API
     */
    private function findChatwootContact(string $phoneWithPlus): ?array
    {
        try {
            $searchPhone = preg_replace('/[^0-9]/', '', $phoneWithPlus);
            error_log("DEBUG: Buscando telefone: $phoneWithPlus -> $searchPhone");
            
            $url = "{$this->chatwootBaseUrl}/api/v1/accounts/{$this->chatwootAccountId}/contacts/search?q={$searchPhone}";
            $response = $this->makeChatwootRequest($url, [], 'GET');
            
            if (isset($response['payload']) && is_array($response['payload'])) {
                error_log("DEBUG: Search retornou " . count($response['payload']) . " resultados");
                
                foreach ($response['payload'] as $contact) {
                    $contactPhone = preg_replace('/[^0-9]/', '', $contact['phone_number'] ?? '');
                    $contactId = $contact['id'] ?? 'N/A';
                    
                    error_log("DEBUG: Comparando $contactPhone vs $searchPhone (ID: $contactId)");
                    
                    if ($contactPhone === $searchPhone) {
                        error_log("DEBUG: MATCH encontrado! ID: $contactId");
                        return $contact;
                    }
                }
                error_log("DEBUG: Nenhum match encontrado");
            }
            
            return null;
        } catch (\Exception $e) {
            error_log("Erro busca Chatwoot: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Buscar dados completos do contato no WhatsApp
     */
    private function getWhatsAppContactData(string $phone): array
    {
        $data = [
            'name' => null,
            'short_name' => null,
            'avatar_url' => null
        ];
        
        try {
            // Buscar dados do contato
            $contactUrl = $this->zApiBaseUrl . "/contacts/{$phone}";
            $contactResponse = $this->makeZApiRequest($contactUrl, [], 'GET');
            
            if ($contactResponse && (isset($contactResponse['name']) || isset($contactResponse['vname']))) {
                $data['name'] = $contactResponse['name'] ?? $contactResponse['vname'] ?? null;
                $data['short_name'] = $contactResponse['short'] ?? null;
                $data['avatar_url'] = $contactResponse['imgUrl'] ?? null;
            }
            
            // Se não tem avatar, tentar buscar foto de perfil
            if (!$data['avatar_url']) {
                $pictureUrl = $this->zApiBaseUrl . "/profile-picture?phone={$phone}";
                $pictureResponse = $this->makeZApiRequest($pictureUrl, [], 'GET');
                
                if ($pictureResponse && isset($pictureResponse['link']) && $pictureResponse['link'] !== 'null') {
                    $data['avatar_url'] = $pictureResponse['link'];
                }
            }
            
        } catch (\Exception $e) {
            error_log("Erro dados WhatsApp: " . $e->getMessage());
        }
        
        return $data;
    }

    /**
     * Resolver nome final com prioridades
     */
    private function resolveFinalName(?string $formName, array $whatsappData): string
    {
        if (!empty($formName)) {
            return $this->normalizeName($formName);
        }
        
        // PRIORIDADE: nome completo antes do nome curto
        if (!empty($whatsappData['name'])) {
            return $this->normalizeName($whatsappData['name']);
        }
        
        if (!empty($whatsappData['short_name'])) {
            return $this->normalizeName($whatsappData['short_name']);
        }
        
        return 'Paciente';
    }

    /**
     * Atualizar contato existente
     */
    private function updateExistingContact(array $contact, string $name, array $whatsappData): array
    {
        $updateData = ['name' => $name];
        
        if (!empty($whatsappData['avatar_url'])) {
            $updateData['avatar_url'] = $whatsappData['avatar_url'];
        }
        
        $result = $this->updateChatwootContact($contact['id'], $updateData);
        
        return [
            'success' => true,
            'action' => 'updated',
            'contact_id' => $contact['id'],
            'data' => ['payload' => array_merge($contact, $updateData)]
        ];
    }

    /**
     * Criar novo contato
     */
    private function createNewContact(string $phoneWithPlus, string $identifier, string $name, array $whatsappData): array
    {
        $contactData = [
            'name' => $name,
            'phone_number' => $phoneWithPlus,
            'identifier' => $identifier
        ];
        
        if (!empty($whatsappData['avatar_url'])) {
            $contactData['avatar_url'] = $whatsappData['avatar_url'];
        }
        
        $result = $this->createChatwootContact($contactData);
        
        return [
            'success' => true,
            'action' => 'created',
            'contact_id' => $result['payload']['contact']['id'] ?? null,
            'data' => $result
        ];
    }

    /**
     * Criar contato no Chatwoot
     */
    private function createChatwootContact(array $data): array
    {
        $url = "{$this->chatwootBaseUrl}/api/v1/accounts/{$this->chatwootAccountId}/contacts";
        return $this->makeChatwootRequest($url, $data, 'POST');
    }

    /**
     * Atualizar contato no Chatwoot
     */
    private function updateChatwootContact(int $contactId, array $data): array
    {
        $url = "{$this->chatwootBaseUrl}/api/v1/accounts/{$this->chatwootAccountId}/contacts/{$contactId}";
        return $this->makeChatwootRequest($url, $data, 'PUT');
    }

    /**
     * Requisição para Chatwoot
     */
    private function makeChatwootRequest(string $url, array $data = [], string $method = 'GET'): array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'api_access_token: ' . $this->chatwootApiToken
            ],
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CUSTOMREQUEST => $method
        ]);
        
        if (in_array($method, ['POST', 'PUT']) && !empty($data)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if (!in_array($httpCode, [200, 201, 204])) {
            throw new \Exception("Chatwoot HTTP {$httpCode}: " . $response);
        }
        
        return json_decode($response, true) ?: [];
    }

    /**
     * Requisição para Z-API
     */
    private function makeZApiRequest(string $url, array $data = [], string $method = 'GET'): ?array
    {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Client-Token: ' . $this->zApiClientToken
            ],
            CURLOPT_TIMEOUT => 15,
            CURLOPT_CUSTOMREQUEST => $method
        ]);
        
        if ($method === 'POST' && !empty($data)) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode !== 200) {
            throw new \Exception("Z-API HTTP {$httpCode}");
        }
        
        return json_decode($response, true);
    }

    /**
     * Normalizar telefone (12 dígitos)
     */
    private function normalizePhone(string $phone): string
    {
        $clean = preg_replace('/[^0-9]/', '', $phone);
        error_log("DEBUG: normalizePhone input: $phone -> clean: $clean (len: " . strlen($clean) . ")");
        
        if (strlen($clean) >= 13) {
            // Remove 55 duplicado se necessário
            if (substr($clean, 0, 4) === '5555') {
                $clean = substr($clean, 2);
            }
            $clean = substr($clean, 0, 12);
        } elseif (strlen($clean) === 12) {
            // Já está correto
            $result = $clean;
        } elseif (strlen($clean) === 11) {
            // DDD + número, adiciona 55
            $clean = '55' . $clean;
        } elseif (strlen($clean) === 10) {
            // DDD + número sem 9, adiciona 55
            $clean = '55' . $clean;
        } else {
            // Número incompleto, adiciona código padrão
            $clean = '5573' . $clean;
        }
        
        $result = substr($clean, 0, 12);
        error_log("DEBUG: normalizePhone result: $result");
        return $result;
    }

    /**
     * Normalizar nome
     */
    private function normalizeName(string $name): string
    {
        $name = preg_replace('/\s+/', ' ', trim($name));
        return mb_convert_case(mb_strtolower($name), MB_CASE_TITLE, 'UTF-8');
    }
}
