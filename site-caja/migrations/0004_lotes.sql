-- Lotes mensuales al proveedor. Cada pedido pagado entra en UN lote, y una vez dentro no se mueve.
--
-- El lote «2026-11» reúne lo que entró del 21-oct 00:00 al 21-nov 00:00, hora de Madrid. No se
-- elige por fechas sino por marca: al cerrar un lote se le asignan los pedidos SIN lote anteriores
-- al corte. Así un pedido no puede caer en dos lotes ni en ninguno, aunque un mes la rutina falle
-- (el siguiente recoge lo pendiente) o se lance dos veces (la segunda no encuentra nada nuevo).
ALTER TABLE pedidos ADD COLUMN lote TEXT;  -- «AAAA-MM» del lote en que se mandó a producir
CREATE INDEX IF NOT EXISTS idx_pedidos_lote ON pedidos (lote);

CREATE TABLE IF NOT EXISTS lotes (
  etiqueta TEXT PRIMARY KEY,   -- «AAAA-MM»
  corte    TEXT NOT NULL,      -- ISO UTC: entra lo creado ANTES de este instante (21, 00:00 Madrid)
  cerrado  TEXT NOT NULL,      -- ISO UTC: cuándo se asignaron los pedidos
  correo   TEXT                -- ISO UTC: cuándo salió el correo a la caja (null = pendiente)
);
