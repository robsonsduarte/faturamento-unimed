<?php

namespace API\Helpers;

class ZApiClient
{
    private $instanceId;
    private $token;
    private $clientToken;
    private $baseUrl;

    public function __construct()
    {
        // Carrega variáveis de ambiente
        EnvLoader::load();

        // Obtém credenciais do .env
        $this->instanceId = EnvLoader::get('ZAPI_INSTANCE_ID');
        $this->token = EnvLoader::get('ZAPI_TOKEN');
        $this->clientToken = EnvLoader::get('ZAPI_SECURITY_TOKEN');

        // Valida se variáveis foram carregadas
        if (empty($this->instanceId)) {
            throw new \Exception("ZAPI_INSTANCE_ID não configurada no .env");
        }

        if (empty($this->token)) {
            throw new \Exception("ZAPI_TOKEN não configurada no .env");
        }

        if (empty($this->clientToken)) {
            throw new \Exception("ZAPI_SECURITY_TOKEN não configurada no .env");
        }

        // Configura URL base
        $this->baseUrl = "https://api.z-api.io/instances/{$this->instanceId}/token/{$this->token}";
    }

    /**
     * Envia mensagem de texto via WhatsApp
     * 
     * @param string $phone Telefone (com ou sem DDI)
     * @param string $message Mensagem a ser enviada
     * @return array Response da Z-API
     * @throws \Exception Se houver erro na requisição
     */
    public function sendText(string $phone, string $message): array
    {
        // Normaliza telefone (remove caracteres especiais)
        $phone = preg_replace('/[^0-9]/', '', $phone);
        
        // Adiciona DDI 55 se necessário
        if (strlen($phone) < 12) {
            $phone = '55' . $phone;
        }

        return $this->request('/send-text', [
            'phone' => $phone,
            'message' => $message
        ]);
    }

    /**
     * Verifica se número tem WhatsApp ativo
     * 
     * @param string $phone Telefone a verificar
     * @return bool True se tem WhatsApp, False se não tem
     * @throws \Exception Se houver erro na requisição
     */
    public function checkWhatsApp(string $phone): bool
    {
        // Normaliza telefone
        $phone = preg_replace('/[^0-9]/', '', $phone);
        
        // Adiciona DDI 55 se necessário
        if (strlen($phone) < 12) {
            $phone = '55' . $phone;
        }

        $response = $this->request("/phone-exists/{$phone}", [], 'GET');
        
        return isset($response['exists']) && $response['exists'] === true;
    }

    /**
     * Obtém status da conexão Z-API
     * 
     * @return array Status da conexão
     * @throws \Exception Se houver erro na requisição
     */
    public function getStatus(): array
    {
        return $this->request('/status', [], 'GET');
    }

    /**
     * Executa requisição HTTP para Z-API
     * 
     * @param string $endpoint Endpoint da API
     * @param array $data Dados a enviar (para POST)
     * @param string $method Método HTTP (GET ou POST)
     * @return array Response decodificado
     * @throws \Exception Se houver erro na requisição
     */
    private function request(string $endpoint, array $data = [], string $method = 'POST'): array
    {
        $url = $this->baseUrl . $endpoint;
        
        $ch = curl_init($url);
        
        $options = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Client-Token: ' . $this->clientToken
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
            throw new \Exception("Erro ao conectar Z-API: {$error}");
        }

        $result = json_decode($response, true);

        if ($httpCode !== 200) {
            $errorMessage = $result['error'] ?? $result['message'] ?? "Erro HTTP {$httpCode}";
            throw new \Exception($errorMessage, $httpCode);
        }

        return $result;
    }
}