/**
 * El silbato, sintetizado: dos pitidos con el trino de la bolita (modulación a ~32 Hz) y un
 * poco de aire. Cero bytes de audio que descargar, y nada suena hasta que el visitante activa
 * el sonido — el `AudioContext` ni se crea antes, porque el navegador lo exige tras un gesto.
 */

let ctx: AudioContext | null = null;
let ruido: AudioBuffer | null = null;

function contexto() {
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function bufferRuido(c: AudioContext) {
  if (ruido) return ruido;
  ruido = c.createBuffer(1, Math.floor(c.sampleRate * 0.6), c.sampleRate);
  const d = ruido.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return ruido;
}

function pitido(c: AudioContext, salida: AudioNode, ini: number, dur: number) {
  const env = c.createGain();
  env.gain.setValueAtTime(0, ini);
  env.gain.linearRampToValueAtTime(1, ini + 0.018);
  env.gain.setValueAtTime(1, ini + dur - 0.05);
  env.gain.linearRampToValueAtTime(0, ini + dur);
  env.connect(salida);

  const tono = c.createOscillator();
  tono.frequency.value = 2750;
  const trino = c.createOscillator();
  trino.frequency.value = 32;
  const trinoProf = c.createGain();
  trinoProf.gain.value = 150;
  trino.connect(trinoProf).connect(tono.frequency);
  tono.connect(env);

  const armonico = c.createOscillator();
  armonico.frequency.value = 5500;
  const armonicoGan = c.createGain();
  armonicoGan.gain.value = 0.12;
  trinoProf.connect(armonico.frequency);
  armonico.connect(armonicoGan).connect(env);

  const aire = c.createBufferSource();
  aire.buffer = bufferRuido(c);
  const filtro = c.createBiquadFilter();
  filtro.type = "bandpass";
  filtro.frequency.value = 3200;
  filtro.Q.value = 1.2;
  const aireGan = c.createGain();
  aireGan.gain.value = 0.22;
  aire.connect(filtro).connect(aireGan).connect(env);

  for (const n of [tono, trino, armonico, aire]) {
    n.start(ini);
    n.stop(ini + dur + 0.02);
  }
}

/** Llamar DENTRO de un gesto (clic, tecla): desbloquea el audio para cuando suene después. */
export function prepararAudio() {
  contexto();
}

/** Dos toques: corto y largo. El segundo cae con el segundo soplido de la animación. */
export function silbido() {
  const c = contexto();
  const salida = c.createGain();
  salida.gain.value = 0.1;
  salida.connect(c.destination);
  const t0 = c.currentTime + 0.01;
  pitido(c, salida, t0, 0.26);
  pitido(c, salida, t0 + 0.4, 0.4);
}
