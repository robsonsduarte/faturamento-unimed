<?php

namespace API\Controllers;

use API\Helpers\Response;
use API\Helpers\Validator;
use API\Helpers\ZApiClient;
use API\Middleware\AuthMiddleware;

class NotificationController
{
    private $auth;

    public function __construct()
    {
        $this->auth = new AuthMiddleware();
    }

    /**
     * POST /notifications/send-whatsapp
     * Envia mensagem WhatsApp individual
     */
    public function sendWhatsApp($data)
    {
        // Validação
        $validator = new Validator($data);
        $validator->required('company')->required('phone')->required('message');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        // Autenticação
        $apiKeyData = $this->auth->validate($data['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $zapi = new ZApiClient();
            $result = $zapi->sendText($data['phone'], $data['message']);

            return Response::success([
                'message_id' => $result['messageId'] ?? $result['id'] ?? null,
                'zaap_id' => $result['zaapId'] ?? null,
                'phone' => $data['phone'],
                'company' => $data['company'],
                'sent_at' => date('Y-m-d H:i:s')
            ]);

        } catch (\Exception $e) {
            return Response::error(
                'NOTIFICATION_ERROR',
                'Erro ao enviar notificação: ' . $e->getMessage(),
                $e->getCode() ?: 500
            );
        }
    }

    /**
     * GET /notifications/check-whatsapp/{phone}
     * Verifica se número tem WhatsApp
     */
    public function checkWhatsApp($request)
    {
        // Validação
        $validator = new Validator($request);
        $validator->required('company')->required('phone');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        // Autenticação
        $apiKeyData = $this->auth->validate($request['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $zapi = new ZApiClient();
            $hasWhatsApp = $zapi->checkWhatsApp($request['phone']);

            return Response::success([
                'phone' => $request['phone'],
                'has_whatsapp' => $hasWhatsApp,
                'checked_at' => date('Y-m-d H:i:s')
            ]);
        } catch (\Exception $e) {
            return Response::error(
                'NOTIFICATION_ERROR',
                'Erro ao verificar WhatsApp: ' . $e->getMessage(),
                500
            );
        }
    }

    /**
     * GET /notifications/status
     * Status da conexão Z-API
     */
    public function getStatus($request)
    {
        // Validação
        $validator = new Validator($request);
        $validator->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        // Autenticação
        $apiKeyData = $this->auth->validate($request['company']);
        if (!$apiKeyData) {
            return;
        }

        try {
            $zapi = new ZApiClient();
            $status = $zapi->getStatus();

            return Response::success([
                'connected' => isset($status['connected']) && $status['connected'],
                'smartphone_connected' => $status['smartphoneConnected'] ?? false,
                'details' => $status,
                'checked_at' => date('Y-m-d H:i:s')
            ]);
        } catch (\Exception $e) {
            return Response::error(
                'NOTIFICATION_ERROR',
                'Erro ao obter status: ' . $e->getMessage(),
                500
            );
        }
    }

    /**
     * POST /notifications/send-batch
     * Envia múltiplas mensagens WhatsApp
     */
    public function sendBatch($data)
    {
        // Validação
        $validator = new Validator($data);
        $validator->required('company')->required('messages');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        if (!is_array($data['messages'])) {
            return Response::error(['messages' => 'Campo "messages" deve ser um array'], 400);
        }

        // Autenticação
        $apiKeyData = $this->auth->validate($data['company']);
        if (!$apiKeyData) {
            return;
        }

        $delay = isset($data['delay']) ? (int)$data['delay'] : 2;
        $results = [];
        $errors = [];

        try {
            $zapi = new ZApiClient();

            foreach ($data['messages'] as $index => $msg) {
                if (empty($msg['phone']) || empty($msg['message'])) {
                    $errors[] = [
                        'index' => $index,
                        'error' => 'Phone e message são obrigatórios'
                    ];
                    continue;
                }

                try {
                    $result = $zapi->sendText($msg['phone'], $msg['message']);
                    
                    $results[] = [
                        'index' => $index,
                        'phone' => $msg['phone'],
                        'message_id' => $result['messageId'] ?? null,
                        'status' => 'sent',
                        'sent_at' => date('Y-m-d H:i:s')
                    ];
                } catch (\Exception $e) {
                    $errors[] = [
                        'index' => $index,
                        'phone' => $msg['phone'],
                        'error' => $e->getMessage()
                    ];
                }

                // Delay anti-ban
                if ($index < count($data['messages']) - 1) {
                    sleep($delay);
                }
            }

            return Response::success([
                'company' => $data['company'],
                'total' => count($data['messages']),
                'sent' => count($results),
                'failed' => count($errors),
                'delay_used' => $delay,
                'results' => $results,
                'errors' => $errors,
                'completed_at' => date('Y-m-d H:i:s')
            ]);

        } catch (\Exception $e) {
            return Response::error(
                'NOTIFICATION_ERROR',
                'Erro ao processar lote: ' . $e->getMessage(),
                500
            );
        }
    }
}