-- Pedidos de la tienda (merchandising). Un pedido = una transferencia con su referencia.
-- El total y las líneas los fija y valida el backend (crear_pedido); el navegador no decide.
CREATE TABLE IF NOT EXISTS pedidos (
  referencia TEXT PRIMARY KEY,              -- p. ej. AIRW-00001
  creado     TEXT NOT NULL,                 -- ISO 8601 UTC
  nombre     TEXT NOT NULL,
  email      TEXT NOT NULL,
  site       TEXT,                          -- site de recogida (null si el pedido es solo donación)
  lineas     TEXT NOT NULL,                 -- JSON: [{"talla":"M","cantidad":2}]
  unidades   INTEGER NOT NULL DEFAULT 0,
  donacion   INTEGER NOT NULL DEFAULT 0,    -- €
  total      INTEGER NOT NULL,              -- € (unidades*precio + donacion)
  estado     TEXT NOT NULL DEFAULT 'pendiente'  -- pendiente | pagado | anulado
);

CREATE INDEX IF NOT EXISTS idx_pedidos_creado ON pedidos (creado);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON pedidos (estado);
