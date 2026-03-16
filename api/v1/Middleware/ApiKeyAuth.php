<?php

class ApiKeyAuth {
    
    private $validKey;
    
    public function __construct() {
        $this->validKey = $_ENV['API_KEY'] ?? '';
    }
    
    public function validate() {
        $provided = $_SERVER['HTTP_X_API_KEY'] ?? '';
        
        if (empty($this->validKey)) {
            $this->deny('API key not configured on server');
        }
        
        if (empty($provided)) {
            $this->deny('Missing X-API-Key header');
        }
        
        if (!hash_equals($this->validKey, $provided)) {
            $this->deny('Invalid API key');
        }
        
        return true;
    }
    
    private function deny($reason) {
        http_response_code(401);
        header('Content-Type: application/json');
        echo json_encode([
            'success' => false,
            'error'   => 'Unauthorized',
            'message' => $reason,
        ]);
        exit;
    }
}
