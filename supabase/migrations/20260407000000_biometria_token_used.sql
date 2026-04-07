-- Track when a photo was used for token resolution
ALTER TABLE biometria_fotos ADD COLUMN IF NOT EXISTS token_used_at TIMESTAMPTZ DEFAULT NULL;
