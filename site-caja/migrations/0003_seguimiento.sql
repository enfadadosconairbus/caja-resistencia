-- Seguimiento de cada pedido de la tienda, para el Sheet de gestión y los correos al comprador.
-- Todas son opcionales: los pedidos anteriores siguen valiendo tal cual.
--
-- Estados: pagado → listo → entregado (o anulado). `pendiente` queda de la época de las
-- transferencias y ya no se crea.
ALTER TABLE pedidos ADD COLUMN telefono TEXT;            -- opcional, lo da el comprador
ALTER TABLE pedidos ADD COLUMN lang TEXT;                -- es | en | fr | de: idioma de los correos
ALTER TABLE pedidos ADD COLUMN correo_confirmacion TEXT; -- ISO: cuándo salió «pago recibido»
ALTER TABLE pedidos ADD COLUMN correo_listo TEXT;        -- ISO: cuándo salió «listo para recoger»
ALTER TABLE pedidos ADD COLUMN en_sheet TEXT;            -- ISO: cuándo se volcó al Sheet
