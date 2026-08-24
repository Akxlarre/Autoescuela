/**
 * agent-proxy-relay.js — Relay de red para QA visual en sesiones remotas (Claude Code web).
 *
 * ─── PARA QUÉ EXISTE ────────────────────────────────────────────────────────
 * En el contenedor remoto, Chromium **no enruta HTTPS por el agent proxy**: sale
 * directo y la red del sandbox le resetea la conexión. Da igual pasarle
 * `--proxy-server` o la opción `proxy` de Playwright — comprobado: navegar a un
 * host denegado NO deja rastro en el log del proxy, o sea que el navegador ni lo
 * consulta. Resultado: cualquier request a Supabase o a Google Fonts muere con
 * `net::ERR_CONNECTION_RESET`, no hay login posible y `/verify` es inviable.
 *
 * Node SÍ atraviesa el túnel (CONNECT manual al proxy local). Este módulo
 * intercepta las requests en Playwright y las reenvía por Node.
 *
 * NO hace falta en local: ahí el navegador tiene salida directa. Esto es
 * exclusivamente para sesiones abiertas desde la web.
 * Contexto completo: docs/REMOTE-WEB-SESSIONS.md
 *
 * ─── USO ────────────────────────────────────────────────────────────────────
 *   // El repo es ESM ("type": "module" en package.json) → import, no require.
 *   import { chromium } from '<ruta>/playwright-core/index.mjs';
 *   import { install } from './scripts/qa/agent-proxy-relay.js';
 *
 *   const browser = await chromium.launch({
 *     executablePath: '/opt/pw-browsers/chromium',   // el 'chrome' del canal no existe
 *     args: ['--no-sandbox'],                        // OJO: sin `proxy`, es inútil acá
 *   });
 *   const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
 *   await install(ctx, /(supabase\.co|fonts\.googleapis\.com|fonts\.gstatic\.com)/);
 *
 * Incluir las fuentes no es opcional si vas a MEDIR alturas: sin ellas el layout
 * cae a tipografías de fallback con métricas distintas y los números no son los
 * de producción.
 *
 * ─── LÍMITES CONOCIDOS ──────────────────────────────────────────────────────
 * - No cubre WebSocket (el proxy no soporta upgrades) → Supabase Realtime falla.
 *   Para QA de layout es irrelevante, pero ensucia la consola.
 * - No relayar `localhost`: el proxy solo acepta CONNECT y rechaza HTTP plano.
 */
import net from 'node:net';
import tls from 'node:tls';
import fs from 'node:fs';

const PROXY_HOST = '127.0.0.1';
const PROXY_PORT = Number(process.env.CCR_PROXY_PORT || 33643);
const CA_PATH = process.env.CCR_CA_BUNDLE || '/root/.ccr/ca-bundle.crt';

/** Hace una request HTTPS a través del agent proxy, vía CONNECT + TLS manual. */
function relay({ method, urlStr, headers, body }) {
  return new Promise((resolve, reject) => {
    const ca = fs.readFileSync(CA_PATH);
    const u = new URL(urlStr);
    const port = u.port || 443;
    const sock = net.connect(PROXY_PORT, PROXY_HOST, () => {
      sock.write(`CONNECT ${u.hostname}:${port} HTTP/1.1\r\nHost: ${u.hostname}:${port}\r\n\r\n`);
    });

    let head = '';
    const onData = (d) => {
      head += d.toString('latin1');
      if (!head.includes('\r\n\r\n')) return;
      sock.removeListener('data', onData);
      if (!/^HTTP\/1\.[01] 200/.test(head)) {
        // 403 acá = el host no está permitido por la política de egreso del entorno.
        return reject(new Error('CONNECT rechazado: ' + head.split('\r\n')[0]));
      }

      const t = tls.connect({ socket: sock, servername: u.hostname, ca }, () => {
        const h = { ...headers };
        delete h['accept-encoding'];
        delete h['host'];
        delete h['connection'];
        delete h['content-length'];
        const lines = [
          `${method} ${u.pathname}${u.search} HTTP/1.1`,
          `Host: ${u.hostname}`,
          'Accept-Encoding: identity', // sin gzip: así no hay que descomprimir
          'Connection: close',
          ...Object.entries(h).map(([k, v]) => `${k}: ${v}`),
        ];
        if (body) lines.push(`Content-Length: ${Buffer.byteLength(body)}`);
        t.write(lines.join('\r\n') + '\r\n\r\n');
        if (body) t.write(body);
      });

      const chunks = [];
      t.on('data', (c) => chunks.push(c));
      t.on('end', () => {
        const raw = Buffer.concat(chunks);
        const sep = raw.indexOf('\r\n\r\n');
        const [statusLine, ...hdrLines] = raw.slice(0, sep).toString('latin1').split('\r\n');
        let rest = raw.slice(sep + 4);

        const resHeaders = {};
        hdrLines.forEach((l) => {
          const i = l.indexOf(':');
          if (i > 0) resHeaders[l.slice(0, i).trim().toLowerCase()] = l.slice(i + 1).trim();
        });

        if ((resHeaders['transfer-encoding'] || '').includes('chunked')) {
          const out = [];
          let buf = rest;
          for (;;) {
            const nl = buf.indexOf('\r\n');
            if (nl < 0) break;
            const size = parseInt(buf.slice(0, nl).toString('latin1').trim(), 16);
            if (!size || Number.isNaN(size)) break;
            out.push(buf.slice(nl + 2, nl + 2 + size));
            buf = buf.slice(nl + 2 + size + 2);
          }
          rest = Buffer.concat(out);
          delete resHeaders['transfer-encoding'];
        }
        delete resHeaders['content-encoding'];
        delete resHeaders['content-length'];

        resolve({ status: parseInt(statusLine.split(' ')[1], 10), headers: resHeaders, body: rest });
      });
      t.on('error', reject);
    };

    sock.on('data', onData);
    sock.on('error', reject);
    setTimeout(() => reject(new Error('timeout relay')), 25000);
  });
}

/**
 * Instala la intercepción en un BrowserContext de Playwright.
 * @param ctx contexto de Playwright
 * @param hostMatch string (substring del hostname) o RegExp
 */
async function install(ctx, hostMatch) {
  const match = (h) => (hostMatch instanceof RegExp ? hostMatch.test(h) : h.includes(hostMatch));
  await ctx.route(
    (url) => match(url.hostname),
    async (route) => {
      const req = route.request();
      try {
        const r = await relay({
          method: req.method(),
          urlStr: req.url(),
          headers: req.headers(),
          body: req.postData(),
        });
        await route.fulfill({ status: r.status, headers: r.headers, body: r.body });
      } catch {
        await route.abort();
      }
    },
  );
}

export { relay, install };
