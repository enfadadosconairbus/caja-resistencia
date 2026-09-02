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
