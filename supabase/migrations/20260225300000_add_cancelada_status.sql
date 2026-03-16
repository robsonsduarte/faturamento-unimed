-- Adicionar valor CANCELADA ao enum guide_status
ALTER TYPE guide_status ADD VALUE IF NOT EXISTS 'CANCELADA';
