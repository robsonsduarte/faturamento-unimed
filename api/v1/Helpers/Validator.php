<?php
namespace API\Helpers;

class Validator
{
    private $errors = [];
    private $data = [];
    
    public function __construct($data = [])
    {
        $this->data = $data;
    }
    
    public function required($field, $label = null)
    {
        $label = $label ?? $field;
        
        if (!isset($this->data[$field]) || $this->data[$field] === '' || $this->data[$field] === null) {
            $this->errors[$field] = "O campo {$label} é obrigatório";
        }
        
        return $this;
    }
    
    public function email($field, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field]) && !empty($this->data[$field])) {
            if (!filter_var($this->data[$field], FILTER_VALIDATE_EMAIL)) {
                $this->errors[$field] = "O campo {$label} deve ser um e-mail válido";
            }
        }
        
        return $this;
    }
    
    public function integer($field, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field]) && !empty($this->data[$field])) {
            if (!is_numeric($this->data[$field]) || (int)$this->data[$field] != $this->data[$field]) {
                $this->errors[$field] = "O campo {$label} deve ser um número inteiro";
            }
        }
        
        return $this;
    }
    
    public function min($field, $min, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field]) && !empty($this->data[$field])) {
            if (strlen($this->data[$field]) < $min) {
                $this->errors[$field] = "O campo {$label} deve ter no mínimo {$min} caracteres";
            }
        }
        
        return $this;
    }
    
    public function max($field, $max, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field]) && !empty($this->data[$field])) {
            if (strlen($this->data[$field]) > $max) {
                $this->errors[$field] = "O campo {$label} deve ter no máximo {$max} caracteres";
            }
        }
        
        return $this;
    }
    
    public function date($field, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field]) && !empty($this->data[$field])) {
            $d = \DateTime::createFromFormat('Y-m-d', $this->data[$field]);
            if (!$d || $d->format('Y-m-d') !== $this->data[$field]) {
                $this->errors[$field] = "O campo {$label} deve estar no formato YYYY-MM-DD";
            }
        }
        
        return $this;
    }
    
    public function time($field, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field]) && !empty($this->data[$field])) {
            $pattern = '/^([01]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/';
            if (!preg_match($pattern, $this->data[$field])) {
                $this->errors[$field] = "O campo {$label} deve estar no formato HH:MM";
            }
        }
        
        return $this;
    }
    
    public function in($field, $allowedValues, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field]) && !empty($this->data[$field])) {
            if (!in_array($this->data[$field], $allowedValues)) {
                $allowed = implode(', ', $allowedValues);
                $this->errors[$field] = "O campo {$label} deve ser um dos seguintes valores: {$allowed}";
            }
        }
        
        return $this;
    }
    
    public function phone($field, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field]) && !empty($this->data[$field])) {
            $phone = preg_replace('/[^0-9]/', '', $this->data[$field]);
            
            if (strlen($phone) < 10 || strlen($phone) > 11) {
                $this->errors[$field] = "O campo {$label} deve ser um telefone válido";
            }
        }
        
        return $this;
    }
    
    public function url($field, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field]) && !empty($this->data[$field])) {
            if (!filter_var($this->data[$field], FILTER_VALIDATE_URL)) {
                $this->errors[$field] = "O campo {$label} deve ser uma URL válida";
            }
        }
        
        return $this;
    }
    
    public function boolean($field, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field])) {
            $value = $this->data[$field];
            $valid = [true, false, 1, 0, '1', '0', 'true', 'false'];
            
            if (!in_array($value, $valid, true)) {
                $this->errors[$field] = "O campo {$label} deve ser um valor booleano";
            }
        }
        
        return $this;
    }
    
    public function json($field, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field]) && !empty($this->data[$field])) {
            json_decode($this->data[$field]);
            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->errors[$field] = "O campo {$label} deve ser um JSON válido";
            }
        }
        
        return $this;
    }
    
    public function positive($field, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field]) && !empty($this->data[$field])) {
            if (!is_numeric($this->data[$field]) || $this->data[$field] <= 0) {
                $this->errors[$field] = "O campo {$label} deve ser um número positivo";
            }
        }
        
        return $this;
    }
    
    public function custom($field, $callback, $message)
    {
        if (isset($this->data[$field])) {
            if (!call_user_func($callback, $this->data[$field], $this->data)) {
                $this->errors[$field] = $message;
            }
        }
        
        return $this;
    }
    
    public function passes()
    {
        return empty($this->errors);
    }
    
    public function fails()
    {
        return !$this->passes();
    }
    
    public function getErrors()
    {
        return $this->errors;
    }
    
    public function getFirstError()
    {
        return !empty($this->errors) ? reset($this->errors) : null;
    }
    
    public function addError($field, $message)
    {
        $this->errors[$field] = $message;
        return $this;
    }
    
    public function clearErrors()
    {
        $this->errors = [];
        return $this;
    }
    
    public function googleCalendarId($field, $label = null)
    {
        $label = $label ?? $field;
        
        if (isset($this->data[$field]) && !empty($this->data[$field])) {
            $pattern = '/^[a-f0-9]{64}@group\.calendar\.google\.com$/i';
            
            if (!preg_match($pattern, $this->data[$field])) {
                $this->errors[$field] = "O campo {$label} deve ser um ID válido do Google Calendar";
            }
        }
        
        return $this;
    }
    
    public static function validate($data, $rules)
    {
        $validator = new self($data);
        
        foreach ($rules as $field => $fieldRules) {
            $fieldRules = is_array($fieldRules) ? $fieldRules : explode('|', $fieldRules);
            
            foreach ($fieldRules as $rule) {
                if (strpos($rule, ':') !== false) {
                    [$method, $params] = explode(':', $rule, 2);
                    $params = explode(',', $params);
                    $validator->{$method}($field, ...$params);
                } else {
                    $validator->{$rule}($field);
                }
            }
        }
        
        return $validator->fails() ? $validator->getErrors() : null;
    }
}
