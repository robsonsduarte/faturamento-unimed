<?php
namespace API\Controllers;

use API\Helpers\Response;
use API\Helpers\Validator;
use API\Middleware\AuthMiddleware;

class DocumentController
{
    private $auth;

    public function __construct()
    {
        $this->auth = new AuthMiddleware();
    }

    public function convertToImage($request)
    {
        $validator = new Validator($request);
        $validator->required('company')->required('file_base64');

        if ($validator->fails()) {
            return Response::error($validator->getErrors(), 400);
        }

        $apiKeyData = $this->auth->validate($request['company']);
        if (!$apiKeyData) {
            return Response::error('Unauthorized', 401);
        }

        try {
            $fileData = base64_decode($request['file_base64']);
            $tmpInput = tempnam(sys_get_temp_dir(), 'doc_') . '.pdf';
            $tmpOutput = tempnam(sys_get_temp_dir(), 'img_') . '.png';
            
            file_put_contents($tmpInput, $fileData);

            $imagick = new \Imagick();
            $imagick->setResolution(150, 150);
            $imagick->readImage($tmpInput . '[0]'); // Primeira página
            $imagick->setImageFormat('png');
            $imagick->writeImage($tmpOutput);
            $imagick->clear();

            $pngData = file_get_contents($tmpOutput);
            $pngBase64 = base64_encode($pngData);

            unlink($tmpInput);
            unlink($tmpOutput);

            return Response::success([
                'image_base64' => $pngBase64,
                'mime_type' => 'image/png'
            ]);

        } catch (\Exception $e) {
            return Response::error('Conversion error: ' . $e->getMessage(), 500);
        }
    }
}