-- Pago = orden: los pedidos de producto se crean YA PAGADOS desde el webhook de Stripe (no hay
-- pendientes ni conciliación de transferencias para producto). `stripe_session` es la clave de
-- idempotencia (Stripe reintenta webhooks): un índice único evita duplicar el pedido.
ALTER TABLE pedidos ADD COLUMN metodo TEXT NOT NULL DEFAULT 'stripe';
ALTER TABLE pedidos ADD COLUMN stripe_session TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_stripe_session
  ON pedidos (stripe_session) WHERE stripe_session IS NOT NULL;
