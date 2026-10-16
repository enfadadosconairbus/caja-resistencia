/**
 * Motor mínimo de animación del huelguista: interpolaciones con curva, muelles amortiguados y
 * suavizado crítico. Sin dependencias — three.js solo entra en el cuerpo y la escena.
 *
 * Tres herramientas, tres trabajos distintos:
 * - `Motor.tw`   → lo que está AUTORIZADO (una pose, un gesto): va de A a B con una curva.
 * - `Muelle`     → lo que tiene INERCIA (mochila, silbato, tela del paraguas): nadie lo anima,
 *                  reacciona a cómo se mueve aquello de lo que cuelga.
 * - `Suave`      → lo que PERSIGUE un objetivo que cambia (la mirada, el peso del paso): llega
 *                  sin rebotar y sin saltos cuando el objetivo se mueve a mitad de camino.
 */

export type Curva = (t: number) => number;

const volver = (c: number) => (t: number) => {
  const c3 = c + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

export const curva = {
  lineal: ((t) => t) as Curva,
  /** Arranca y frena: el movimiento por defecto de un cuerpo con peso. */
  suave: ((t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)) as Curva,
  /** Sale rápido y frena: gestos que "llegan" (alcanzar un objeto). */
  sale: ((t) => 1 - Math.pow(1 - t, 3)) as Curva,
  /** Acelera: preparación de un golpe (antes del chasquido del pan, del soplido). */
  entra: ((t) => t * t * t) as Curva,
  /** Se pasa un poco y vuelve: asentamiento. Pequeño a propósito — más, y parece de goma. */
  asienta: volver(0.9) as Curva,
  /** Pasada más marcada, para gestos rápidos (saludo, chasquido). */
  rebota: volver(1.7) as Curva,
};

type Interp = {
  t: number;
  dur: number;
  curva: Curva;
  fn: (k: number) => void;
  fin: () => void;
  grupo: number;
};

export class Motor {
  private activas: Interp[] = [];
  /** Cada acción abre un grupo; cancelarlo corta sus interpolaciones sin tocar las demás. */
  private grupoActual = 0;

  get ocupado() {
    return this.activas.length > 0;
  }

  nuevoGrupo() {
    this.grupoActual += 1;
    return this.grupoActual;
  }

  tw(dur: number, c: Curva, fn: (k: number) => void, grupo = this.grupoActual): Promise<void> {
    return new Promise((resolver) => {
      if (dur <= 0) {
        fn(1);
        resolver();
        return;
      }
      this.activas.push({ t: 0, dur, curva: c, fn, fin: resolver, grupo });
    });
  }

  /** Espera en tiempo de animación (se congela con la pestaña oculta, como todo lo demás). */
  espera(seg: number) {
    return this.tw(seg, curva.lineal, () => {});
  }

  cancelarGrupo(grupo: number) {
    const quedan: Interp[] = [];
    for (const a of this.activas) {
      if (a.grupo === grupo) a.fin();
      else quedan.push(a);
    }
    this.activas = quedan;
  }

  actualizar(dt: number) {
    if (!this.activas.length) return;
    const terminadas: Interp[] = [];
    for (const a of this.activas) {
      a.t = Math.min(a.dur, a.t + dt);
      const k = a.t / a.dur;
      a.fn(a.curva(k));
      if (k >= 1) terminadas.push(a);
    }
    if (terminadas.length) {
      this.activas = this.activas.filter((a) => !terminadas.includes(a));
      for (const a of terminadas) a.fin();
    }
  }
}

/** Muelle amortiguado de un grado de libertad (Euler semi-implícito, con subpasos). */
export class Muelle {
  x = 0;
  v = 0;
  constructor(
    public rigidez = 90,
    public amortiguacion = 9,
  ) {}

  paso(dt: number, objetivo: number, fuerza = 0) {
    const sub = dt > 1 / 90 ? 3 : 1;
    const h = dt / sub;
    for (let i = 0; i < sub; i++) {
      const a = -this.rigidez * (this.x - objetivo) - this.amortiguacion * this.v + fuerza;
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }

  empujar(impulso: number) {
    this.v += impulso;
  }
}

/** Suavizado críticamente amortiguado (el SmoothDamp de toda la vida). */
export class Suave {
  v = 0;
  constructor(public x = 0) {}

  paso(objetivo: number, tiempo: number, dt: number) {
    const omega = 2 / Math.max(0.0001, tiempo);
    const x = omega * dt;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    const cambio = this.x - objetivo;
    const temp = (this.v + omega * cambio) * dt;
    this.v = (this.v - omega * temp) * exp;
    this.x = objetivo + (cambio + temp) * exp;
    return this.x;
  }
}

export const azar = (min: number, max: number) => min + Math.random() * (max - min);
export const mezclar = (a: number, b: number, k: number) => a + (b - a) * k;
export const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
