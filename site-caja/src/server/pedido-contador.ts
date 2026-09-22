import { DurableObject } from "cloudflare:workers";

/**
 * Contador correlativo y ATÓMICO de referencias de pedido. Un solo hilo → dos pedidos
 * simultáneos nunca reciben el mismo número. Guarda el último número usado.
 *
 * `sembrar()` lo deja en al menos un mínimo (nunca baja): se usará cuando unifiquemos con la
 * tienda de GitHub para continuar la serie desde su máximo sin repetir referencias.
 */
export class PedidoContador extends DurableObject {
  /** Reserva y devuelve el siguiente número de pedido. */
  async siguiente(): Promise<number> {
    const n = ((await this.ctx.storage.get<number>("n")) ?? 0) + 1;
    await this.ctx.storage.put("n", n);
    return n;
  }

  /** Deja el contador en al menos `min` (no lo baja). Devuelve el valor resultante. */
  async sembrar(min: number): Promise<number> {
    const n = Math.max((await this.ctx.storage.get<number>("n")) ?? 0, Math.floor(min));
    await this.ctx.storage.put("n", n);
    return n;
  }
}
