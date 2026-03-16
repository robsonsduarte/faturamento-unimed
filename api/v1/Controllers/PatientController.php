<?php
namespace API\Controllers;

use API\Models\Patient;
use API\Helpers\Response;
use API\Helpers\Validator;
use API\Middleware\AuthMiddleware;

class PatientController
{
    private $patientModel;
    private $auth;

    public function __construct()
    {
        $this->patientModel = new Patient();
        $this->auth = new AuthMiddleware();
    }

    /**
     * POST /patients/find-or-create
     * Buscar paciente por telefone ou criar se não existir
     */
    public function findOrCreate($request)
    {
        // Validação de campos obrigatórios
        $validator = new Validator($request);
        $validator->required('company')->required('mobile');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        // Autenticação
        $apiKeyData = $this->auth->validate($request['company']);
        if (!$apiKeyData) {
            return;
        }

        // Buscar ou criar
        try {
            $result = $this->patientModel->findOrCreate($request);

            if (!$result) {
                return Response::error('Failed to create patient', 500);
            }

            return Response::success([
                'patient' => $result['patient'],
                'created' => $result['created']
            ], $result['created'] ? 201 : 200);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /patients/search?company=1&query=João
     * Buscar pacientes por nome ou telefone
     */
    public function search($request)
    {
        // Validação
        $validator = new Validator($request);
        $validator->required('company')->required('query');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        // Autenticação
        $apiKeyData = $this->auth->validate($request['company']);
        if (!$apiKeyData) {
            return;
        }

        // Buscar
        try {
            $limit = isset($request['limit']) ? (int)$request['limit'] : 20;
            $patients = $this->patientModel->search(
                $request['query'],
                $request['company'],
                $limit
            );

            return Response::success([
                'patients' => $patients,
                'total' => count($patients)
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * PUT /patients/{id}
     * Atualizar paciente
     */
    public function update($request)
    {
        // Validação
        $validator = new Validator($request);
        $validator->required('id')->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        // Autenticação
        $apiKeyData = $this->auth->validate($request['company']);
        if (!$apiKeyData) {
            return;
        }

        // Verificar se existe
        try {
            $patient = $this->patientModel->find($request['id']);

            if (!$patient) {
                return Response::error('Patient not found', 404);
            }

            // Verificar se pertence à empresa (patient é ARRAY!)
            if ($patient['company'] != $request['company']) {
                return Response::error('Unauthorized access', 403);
            }

            // Remover campos que não devem ser atualizados
            $updateData = $request;
            unset($updateData['id']);
            unset($updateData['company']);
            unset($updateData['author']);
            unset($updateData['created_at']);

            // Atualizar (patient['id'] porque é array!)
            $updated = $this->patientModel->update($patient['id'], $updateData);

            if (!$updated) {
                return Response::error('Failed to update patient', 500);
            }

            // Buscar atualizado
            $updatedPatient = $this->patientModel->find($patient['id']);

            return Response::success([
                'patient' => $updatedPatient,
                'updated' => true
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }
    
    /**
     * POST /patients/validate-lgpd
     * Busca paciente validando dados LGPD
     */
    public function validateLgpd($request)
    {
        $validator = new Validator($request);
        $validator->required('company')
                  ->required('nome_completo')
                  ->required('data_nascimento')
                  ->required('telefone');
    
        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }
    
        $apiKeyData = $this->auth->validate($request['company']);
        if (!$apiKeyData) {
            return Response::error('Unauthorized', 401);
        }
    
        try {
            $patient = $this->patientModel->searchForValidation(
                $request['company'],
                $request['telefone'],
                $request['nome_completo'],
                $request['data_nascimento']
            );
    
            if (!$patient) {
                return Response::success([
                    'found' => false,
                    'message' => 'Paciente não encontrado ou dados não conferem'
                ]);
            }
    
            return Response::success([
                'found' => true,
                'patient' => [
                    'id' => $patient['id'],
                    'nome' => $patient['first_name'] . ' ' . $patient['last_name'],
                    'telefone' => $patient['mobile'],
                    'email' => $patient['email'] ?? ''
                ]
            ]);
    
        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /patients?company=1&limit=50
     * Listar pacientes
     */
    public function list($request)
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

        // Listar
        try {
            $limit = isset($request['limit']) ? (int)$request['limit'] : 50;
            $offset = isset($request['offset']) ? (int)$request['offset'] : 0;

            $patients = $this->patientModel->getByCompany(
                $request['company'],
                $limit,
                $offset
            );

            $total = $this->patientModel->countActive($request['company']);

            return Response::success([
                'patients' => $patients,
                'total' => $total,
                'limit' => $limit,
                'offset' => $offset
            ]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    /**
     * GET /patients/{id}?company=1
     * Buscar paciente específico
     */
    public function show($request)
    {
        // Validação
        $validator = new Validator($request);
        $validator->required('id')->required('company');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        // Autenticação
        $apiKeyData = $this->auth->validate($request['company']);
        if (!$apiKeyData) {
            return;
        }

        // Buscar
        try {
            $patient = $this->patientModel->find($request['id']);

            if (!$patient) {
                return Response::error('Patient not found', 404);
            }

            // Verificar se pertence à empresa (patient é ARRAY!)
            if ($patient['company'] != $request['company']) {
                return Response::error('Unauthorized access', 403);
            }

            return Response::success(['patient' => $patient]);

        } catch (\Exception $e) {
            return Response::error('Error: ' . $e->getMessage(), 500);
        }
    }

    
}