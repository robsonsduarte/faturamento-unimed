<?php
namespace API\Controllers;

use API\Helpers\Response;
use API\Middleware\AuthMiddleware;

class XmlController
{
    private $auth;
    
    public function __construct()
    {
        $this->auth = new AuthMiddleware();
    }
    
    /**
     * POST /xml/upload
     * Body JSON: { "filename": "lote.xml", "content": "<?xml..." }
     */
    public function upload()
    {
        $apiKeyData = $this->auth->validate();
        if (!$apiKeyData) {
            return;
        }
        
        try {
            // Ler JSON do body
            $json = file_get_contents('php://input');
            $data = json_decode($json, true);
            
            if (!$data || !isset($data['content'])) {
                return Response::error('Campo "content" obrigatório', 400);
            }
            
            $content = $data['content'];
            $filename = $data['filename'] ?? 'lote_' . time() . '.xml';
            
            // Garantir .xml
            if (substr($filename, -4) !== '.xml') {
                $filename .= '.xml';
            }
            
            // Caminho CORRETO: xmlUnimed
            $uploadDir = dirname(__DIR__, 4) . '/xmlUnimed/';
            
            if (!is_dir($uploadDir)) {
                mkdir($uploadDir, 0755, true);
            }
            
            $destinationPath = $uploadDir . $filename;
            
            // Salvar
            if (file_put_contents($destinationPath, $content) === false) {
                return Response::error('Erro ao salvar arquivo', 500);
            }
            
            return Response::success([
                'filename' => $filename,
                'path' => '/xmlUnimed/' . $filename,
                'url' => 'https://consultoriopro.com.br/xmlUnimed/' . $filename,
                'size' => strlen($content)
            ]);
            
        } catch (\Exception $e) {
            return Response::error('Erro: ' . $e->getMessage(), 500);
        }
    }
}