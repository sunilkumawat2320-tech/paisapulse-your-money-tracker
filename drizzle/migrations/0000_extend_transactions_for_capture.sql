ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS merchant text,
  ADD COLUMN IF NOT EXISTS payment_mode text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS raw_text text,
  ADD COLUMN IF NOT EXISTS statement_import_id uuid,
  ADD COLUMN IF NOT EXISTS source_fingerprint text;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_source_fingerprint_unique
  ON public.transactions (user_id, source_fingerprint)
  WHERE source_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS transactions_user_statement_import_idx
  ON public.transactions (user_id, statement_import_id)
  WHERE statement_import_id IS NOT NULL;