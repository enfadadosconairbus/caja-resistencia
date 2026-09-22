import { DurableObject } from "cloudflare:workers";

/**
 * Contador de visitas como Durable Object.
 *
 * Un solo hilo → el incremento es ATÓMICO: dos visitas simultáneas no se pisan (a
 * diferencia de KV) y no hay tope de escrituras/día. Guarda un único número en su storage.
 * No se registra nada de quien visita: ni IP, ni user-agent, ni cookie, ni identificador.
 */
export class VisitasCounter extends DurableObject {
  /** Suma una visita y devuelve el total ya actualizado. */
  async incrementar(): Promise<number> {
    const total = ((await this.ctx.storage.get<number>("total")) ?? 0) + 1;
    await this.ctx.storage.put("total", total);
    return total;
  }

  /** Total actual, sin sumar. */
  async leer(): Promise<number> {
    return (await this.ctx.storage.get<number>("total")) ?? 0;
  }
}
