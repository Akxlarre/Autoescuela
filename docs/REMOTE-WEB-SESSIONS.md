# Trabajar desde Claude Code en la web (sesiones remotas)

> **Esto NO reemplaza ni modifica el flujo documentado.** El flujo de `.claude/CLAUDE.md`
> (SDD, hooks, `/verify`) asume una máquina local con el repo instalado y `ng serve` corriendo,
> y ahí funciona tal cual está escrito. Este documento es un **carril paralelo**: qué cambia
> cuando la sesión se abre desde la web, y cómo rodear lo que se rompe.
>
> Escrito a partir de `fix-147-b` (2026-08-22), la primera sesión que necesitó `/verify` real
> desde un contenedor remoto.

## El contenedor es efímero

Se recicla al terminar la sesión (o tras un rato de inactividad). El repo se clona fresco cada
vez. Nada de lo instalado o levantado sobrevive.

| | Local | Web |
|---|---|---|
| `node_modules` | ya está | clone fresco → `npm ci` (~2 min) |
| `ng serve` | normalmente ya corriendo | de cero; **el primer build puede tardar ~12 min** |
| `.claude/author.local.json` | tuyo, persistente | gitignoreado → **no existe**, hay que recrearlo |
| Salida a internet | directa | política de egreso del entorno |

**Todo lo que quieras conservar hay que commitearlo y pushearlo antes de cerrar.**

## Lo que se rompe y cómo se resuelve

### 1. `npm install <paquete>` está bloqueado (Bash Guard)

Es a propósito: la regla apunta a **mutar dependencias** (agregar/quitar paquetes). Restaurar el
lockfile ya commiteado es otra cosa: **`npm ci` funciona** y es lo correcto acá, porque instala
exactamente lo pineado.

### 2. La política de egreso puede bloquear Supabase

El navegador falla con `net::ERR_TUNNEL_CONNECTION_FAILED` y el proxy registra
`gateway answered 403 to CONNECT`. Sin login no hay acceso a `/app/**`.

No se rodea: lo habilita el dueño del entorno en la configuración de red
(claude.ai/code → el entorno del repo). Hosts que conviene permitir:

- `<tu-proyecto>.supabase.co` — **bloqueante**, sin esto no hay sesión
- `fonts.googleapis.com` + `fonts.gstatic.com` — no bloquean, pero **sí importan si vas a medir
  alturas**: sin ellos el layout cae a tipografías de fallback con métricas distintas

Diagnóstico rápido del proxy (es localhost, no sale a internet):

```bash
node -e "require('http').get('http://127.0.0.1:33643/__agentproxy/status',r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(d))})"
```

El campo `recentRelayFailures` lista los hosts rechazados con su motivo.

### 3. Playwright MCP apunta a un Chrome que no existe

`.mcp.json` lanza `@playwright/mcp` sin `--browser`, así que cae al canal `chrome`, que no está
instalado. Sí está Chromium en `/opt/pw-browsers/chromium`.

### 4. ⚠️ Chromium no enruta HTTPS por el agent proxy

El problema de fondo, y el más caro de diagnosticar. **Chromium sale directo y el sandbox le
resetea toda conexión HTTPS** — a Supabase, a Google Fonts, a cualquier host. Pasarle
`--proxy-server` o la opción `proxy` de Playwright **no cambia nada**: navegar a un host
denegado no deja rastro en el log del proxy, o sea que el navegador ni lo consulta.

Solución: interceptar en Playwright y reenviar por Node, que sí atraviesa el túnel.
**Ya está resuelto y commiteado** en `scripts/qa/agent-proxy-relay.js` (ver su cabecera para el
uso). No hay que redescubrirlo.

## Lo que NO es ambiental

Cuidado con descartar hallazgos como "ruido del sandbox". Estos aparecieron en una sesión web
pero **te muerden igual en local**, y están documentados en `indices/APP-LIKE-ROLLOUT.md`:

- **`tsc --noEmit` no valida templates de Angular.** Un `NG5002` pasó `tsc`, 2210 tests y
  `lint:arch` sin una queja; apareció solo al abrir el navegador.
- **El scroller de la app es `.shell-content`,** no `main` ni `documentElement`. Medir overflow
  contra `main` (que está en `overflow:hidden`) da negativo **siempre**.
- **La cuenta del seed no cubre todos los estados.** `alumno@test.com` no tiene saldo pendiente
  Clase B, así que `/alumno/pagar` dibuja solo hero + stepper: se mide el vacío y se concluye
  cualquier cosa. Si la variante cara depende de datos que el seed no tiene, inyectá la
  respuesta en el harness de QA — nunca tocando código de la app.

## Sobre automatizar el arranque (decisión pendiente del equipo)

Existe la opción de un **SessionStart hook** que prepare el entorno solo. **No se implementó a
propósito**, porque `settings.json` se commitea y el hook correría en las sesiones de todos:

- `npm ci` **borra y reinstala** `node_modules` → ~2 min de churn a cada dev local, en cada
  sesión, para resolver un problema que solo existe en la web.
- Levantar `ng serve` en automático es intrusivo para quien ya lo tiene corriendo.

Una versión condicional (`[ -d node_modules ] || npm ci`) sería inocua, pero cambia el arranque
de sesión de todo el equipo: es una decisión de equipo, no de quien pasa por acá. Si se decide
hacerlo, va con su propio track porque toca configuración del harness, no `src/`.
