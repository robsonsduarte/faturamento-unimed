-- Garante que a tabela notifications esta na publication supabase_realtime
-- e com REPLICA IDENTITY FULL (necessario para payloads completos em events).

ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Re-add para garantir (DROP se ja existir e ADD novamente)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
  END IF;
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
END $$;
