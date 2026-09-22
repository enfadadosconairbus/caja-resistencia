// Entry propio del Worker. vinext lo detecta automáticamente en `worker/index.ts` y lo usa
// como `main` (ver resolveWorkerEntry en @vinext/cloudflare). Aquí re-exportamos el handler
// de vinext (App Router) SIN tocarlo y, además, publicamos las Durable Objects (contador de
// visitas y contador de referencias de pedido) para que formen parte del Worker desplegado.
export { VisitasCounter } from "../src/server/visitas-counter";
export { PedidoContador } from "../src/server/pedido-contador";
export { default } from "vinext/server/fetch-handler";
