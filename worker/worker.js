/* =============================================================================
   worker.js — Cloudflare Worker (proxy seguro entre la web y Apps Script)
   -----------------------------------------------------------------------------
   Por qué existe:
     - Google Apps Script no deja controlar bien las cabeceras CORS.
     - El TOKEN del backend y la URL /exec NO deben aparecer nunca en GitHub.
   El navegador solo conoce la URL de este Worker. El Worker conoce el secreto.

   Variables/secretos a configurar en Cloudflare (Settings -> Variables):
     - APPS_SCRIPT_URL  (Secret)  -> la URL de Apps Script terminada en /exec
     - BACKEND_TOKEN    (Secret)  -> el token que muestra el menú del Sheet
     - ALLOWED_ORIGIN   (Variable)-> orígenes permitidos, separados por comas.
                                     Ej: https://TU-CUENTA.github.io

   Binding OPCIONAL para el ESPEJO de pedidos (A1 — backup independiente de Google):
     - PEDIDOS_KV (KV namespace) -> si existe, cada pedido registrado se copia a KV.
                                    Si no existe, el Worker funciona igual (sin espejo).
   ========================================================================== */

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const allow = allowedOrigin(origin, env.ALLOWED_ORIGIN);

    // Preflight CORS (por si algún navegador lo dispara)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(allow) });
    }

    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Método no permitido' }, 405, allow);
    }

    // Si el origen no está permitido, se rechaza.
    if (!allow) {
      return json({ ok: false, error: 'Origen no permitido' }, 403, '');
    }

    let payload;
    try {
      payload = await request.json();
    } catch (e) {
      // el frontend envía text/plain con JSON dentro
      try { payload = JSON.parse(await request.text()); }
      catch (e2) { return json({ ok: false, error: 'JSON inválido' }, 400, allow); }
    }

    // Conteo público 'estado': cacheado 45 s en el edge para no saturar Apps Script.
    if (payload && payload.action === 'estado') {
      const cache = caches.default;
      const cacheKey = new Request('https://cache.tienda/estado', { method: 'GET' });
      const hit = await cache.match(cacheKey);
      if (hit) {
        return new Response(await hit.text(), { status: 200, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders(allow)) });
      }
      payload.token = env.BACKEND_TOKEN;
      let up;
      try { up = await fetch(env.APPS_SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), redirect: 'follow' }); }
      catch (e) { return json({ ok: false, error: 'No se pudo contactar con el backend' }, 502, allow); }
      const body = await up.text();
      if (up.status === 200) ctx.waitUntil(cache.put(cacheKey, new Response(body, { headers: { 'Cache-Control': 'max-age=45', 'Content-Type': 'application/json; charset=utf-8' } })));
      return new Response(body, { status: up.status, headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders(allow)) });
    }

    // Se inyecta el token en el cuerpo (el navegador nunca lo ve).
    payload.token = env.BACKEND_TOKEN;

    let upstream;
    try {
      upstream = await fetch(env.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });
    } catch (e) {
      return json({ ok: false, error: 'No se pudo contactar con el backend' }, 502, allow);
    }

    const text = await upstream.text();

    // A1 — ESPEJO INDEPENDIENTE en Cloudflare KV. Copia cada pedido registrado a
    // un almacén fuera de Google, para que un bloqueo de la cuenta de Google no
    // borre los datos. Nunca debe afectar al pedido: va en waitUntil y traga
    // cualquier error (si el espejo falla, el cliente ni se entera).
    if (payload && payload.action === 'crear_pedido' && env.PEDIDOS_KV) {
      ctx.waitUntil(espejarPedido(env, payload, text).catch(() => {}));
    }

    // Se reenvía tal cual la respuesta del backend, con cabeceras CORS.
    return new Response(text, {
      status: upstream.status,
      headers: Object.assign(
        { 'Content-Type': 'application/json; charset=utf-8' },
        corsHeaders(allow)
      )
    });
  }
};

/* ---------------------------------------------------------------------------
   A1 · Espejo de pedidos en KV. Guarda una copia solo de los pedidos REALMENTE
   registrados por el backend (resp.ok con order_id). La clave es el order_id
   (AIR26-XXXXX), así que un reintento sobrescribe la misma entrada, no duplica.
   Cada valor lleva el pedido completo + la respuesta del backend: suficiente
   para reconstruir el Sheet si algún día se pierde Google.
--------------------------------------------------------------------------- */
async function espejarPedido(env, payload, responseText) {
  let resp = {};
  try { resp = JSON.parse(responseText); } catch (e) { return; }
  if (!resp || !resp.ok || !resp.order_id) return;   // solo pedidos confirmados

  const c = payload.cliente || {};
  const record = {
    created_at: new Date().toISOString(),
    order_id: resp.order_id,
    client_request_id: payload.client_request_id || null,
    cliente: c,
    site: payload.site || null,
    lineas: payload.lineas || null,
    aportacion: (payload.aportacion != null ? payload.aportacion : null),
    total_eur: (typeof resp.total === 'number') ? resp.total : null,
    response: resp
  };

  await env.PEDIDOS_KV.put('order:' + resp.order_id, JSON.stringify(record), {
    metadata: { email: c.email || '', total: record.total_eur, at: record.created_at }
  });
}

function allowedOrigin(origin, allowedList) {
  if (!allowedList) return '';
  const list = allowedList.split(',').map(s => s.trim()).filter(Boolean);
  if (list.includes('*')) return origin || '*';
  return list.includes(origin) ? origin : '';
}

function corsHeaders(allow) {
  return {
    'Access-Control-Allow-Origin': allow || 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(obj, status, allow) {
  return new Response(JSON.stringify(obj), {
    status: status,
    headers: Object.assign(
      { 'Content-Type': 'application/json; charset=utf-8' },
      corsHeaders(allow)
    )
  });
}
