CREATE UNIQUE INDEX IF NOT EXISTS transactions_user_source_fingerprint_unique_all
  ON public.transactions (user_id, source_fingerprint);