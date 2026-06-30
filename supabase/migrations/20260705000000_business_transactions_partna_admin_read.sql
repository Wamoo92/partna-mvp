-- Partna admins need to read business_transactions to see and process
-- business withdrawals in the admin portal. Previously only the owning
-- business admin (business_transactions_select_own) and the service role
-- could read this table, so the admin "Business Withdrawals" tab was blank.

DROP POLICY IF EXISTS business_transactions_select_partna_admin ON business_transactions;

CREATE POLICY business_transactions_select_partna_admin
  ON business_transactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users au WHERE au.email = auth.email()
    )
  );
