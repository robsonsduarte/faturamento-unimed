<?php
namespace API\Helpers;

class HolidayHelper
{
    /**
     * Verifica se uma data é feriado
     */
    public static function isHoliday($date, $city = 'Itabuna', $state = 'BA')
    {
        $holidays = self::getHolidays(date('Y', strtotime($date)), $city, $state);
        $dateOnly = date('Y-m-d', strtotime($date));
        
        return in_array($dateOnly, $holidays);
    }
    
    /**
     * Retorna lista de feriados do ano
     */
    private static function getHolidays($year, $city, $state)
    {
        $holidays = [];
        
        // FERIADOS NACIONAIS FIXOS
        $holidays[] = "$year-01-01"; // Ano Novo
        $holidays[] = "$year-04-21"; // Tiradentes
        $holidays[] = "$year-05-01"; // Dia do Trabalho
        $holidays[] = "$year-09-07"; // Independência
        $holidays[] = "$year-10-12"; // Nossa Senhora Aparecida
        $holidays[] = "$year-11-02"; // Finados
        $holidays[] = "$year-11-15"; // Proclamação da República
        $holidays[] = "$year-11-20"; // Consciência Negra (nacional desde 2024)
        $holidays[] = "$year-12-25"; // Natal
        
        // FERIADOS MÓVEIS (baseados na Páscoa)
        $easter = self::getEasterDate($year);
        $holidays[] = date('Y-m-d', strtotime("$easter -47 days")); // Carnaval (segunda)
        $holidays[] = date('Y-m-d', strtotime("$easter -46 days")); // Carnaval (terça)
        $holidays[] = date('Y-m-d', strtotime("$easter -2 days"));  // Sexta-feira Santa
        $holidays[] = date('Y-m-d', strtotime("$easter"));           // Páscoa
        $holidays[] = date('Y-m-d', strtotime("$easter +60 days")); // Corpus Christi
        
        // FERIADOS ESTADUAIS
        $holidays = array_merge($holidays, self::getStateHolidays($year, $state));
        
        // FERIADOS MUNICIPAIS
        $holidays = array_merge($holidays, self::getCityHolidays($year, $city, $state));
        
        return $holidays;
    }
    
     /**
     * Feriados estaduais
     */
    private static function getStateHolidays($year, $state)
    {
        $holidays = [];
        
        switch ($state) {
            case 'BA': // Bahia
                $holidays[] = "$year-07-02"; // Independência da Bahia
                break;
                
            case 'PE': // Pernambuco
                $holidays[] = "$year-03-06"; // Revolução Pernambucana (data fixa aproximada)
                // Nota: A data exata pode variar, ajuste conforme necessário
                break;
                
            case 'SP': // São Paulo
                $holidays[] = "$year-07-09"; // Revolução Constitucionalista
                break;
                
            case 'RJ': // Rio de Janeiro
                $holidays[] = "$year-11-20"; // Zumbi dos Palmares (alguns estados)
                break;
                
            // Adicione outros estados conforme necessário
        }
        
        return $holidays;
    }
    
    /**
     * Feriados municipais
     */
    private static function getCityHolidays($year, $city, $state)
    {
        $holidays = [];
        
        // Normalizar nome da cidade
        $cityNormalized = self::normalizeString($city);
        
        // BAHIA
        if ($state === 'BA') {
            if ($cityNormalized === 'itabuna') {
                $holidays[] = "$year-06-02"; // Aniversário de Itabuna
            } elseif ($cityNormalized === 'ilheus') {
                $holidays[] = "$year-06-28"; // Aniversário de Ilhéus
            } elseif ($cityNormalized === 'salvador') {
                $holidays[] = "$year-01-01"; // Já é nacional, exemplo
            }
        }
        
        // PERNAMBUCO
        if ($state === 'PE') {
            if ($cityNormalized === 'recife') {
                $holidays[] = "$year-03-12"; // Aniversário de Recife
            } elseif ($cityNormalized === 'olinda') {
                $holidays[] = "$year-03-12"; // Aniversário de Olinda
            }
        }
        
        // SÃO PAULO
        if ($state === 'SP') {
            if ($cityNormalized === 'saopaulo' || $cityNormalized === 'sao paulo') {
                $holidays[] = "$year-01-25"; // Aniversário de São Paulo
            }
        }
        
        // Adicione outras cidades conforme necessário
        
        return $holidays;
    }
    
    /**
     * Normalizar string (remover acentos e espaços)
     */
    private static function normalizeString($string)
    {
        $string = strtolower($string);
        $string = preg_replace('/[áàâãä]/u', 'a', $string);
        $string = preg_replace('/[éèêë]/u', 'e', $string);
        $string = preg_replace('/[íìîï]/u', 'i', $string);
        $string = preg_replace('/[óòôõö]/u', 'o', $string);
        $string = preg_replace('/[úùûü]/u', 'u', $string);
        $string = preg_replace('/[ç]/u', 'c', $string);
        $string = preg_replace('/\s+/', '', $string);
        return $string;
    }
    
    /**
     * Calcula data da Páscoa
     */
    private static function getEasterDate($year)
    {
        $easter = easter_date($year);
        return date('Y-m-d', $easter);
    }
}