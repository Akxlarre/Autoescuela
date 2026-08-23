# Setup de MCP Servers

`.mcp.json` está commiteado a propósito, y `.claude/settings.json` tiene
`"enableAllProjectMcpServers": true`. Con eso, un dev nuevo que clona el repo y abre Claude Code
**no tiene que correr ni aprobar nada** para los servers compartidos — quedan disponibles
automáticamente en la primera sesión.

## Regla de fondo: secretos NUNCA en `.mcp.json`

`.mcp.json` es git-tracked y **visible para todo el equipo**. Un server que necesite un
token/API key **no va ahí**, ni siquiera usando `${VAR_NAME}` (Claude Code sí interpola env vars
en `command`/`args`/`env`/`url`/`headers` — no es que el placeholder filtre el secreto). La razón
es defensa en profundidad: si alguien alguna vez reemplaza el placeholder por el valor real a
mano (para probar algo rápido) en un archivo trackeado, ese error se sube al repo remoto. Si el
server vive en config personal gitignoreada, el mismo error se queda local.

## ⚠️ Si abrís la sesión desde la web (Claude Code remoto)

El Playwright MCP de `.mcp.json` **no funciona tal cual en el contenedor remoto**: se lanza sin
`--browser`, así que cae al canal `chrome` (que no está instalado), y aunque se resuelva eso,
Chromium ahí no enruta HTTPS por el agent proxy y toda request externa muere con
`ERR_CONNECTION_RESET`.

Está diagnosticado y resuelto — no lo redescubras: **`docs/REMOTE-WEB-SESSIONS.md`**.
En local no aplica nada de esto.

## Servers compartidos (`.mcp.json`, sin secretos)

| Server | Para qué | Usado por |
|---|---|---|
| `typescript` | LSP de TypeScript vía MCP (diagnósticos, definiciones, hover) | Cualquier tarea de código |
| `angular` | CLI de Angular vía MCP | Scaffolding, generación |
| `playwright` | QA visual en navegador real: screenshots, consola, DOM, network. Corre con `--isolated` (perfil en memoria) para que sesiones concurrentes o mal cerradas nunca choquen por el lock del perfil de Chrome — ver el gotcha en `.claude/skills/verify/SKILL.md` | skill `/verify` y los permisos `mcp__playwright__*` en `.claude/settings.json` |

## Servers personales (requieren secreto — NO van en `.mcp.json`)

| Server | Secreto | Para qué |
|---|---|---|
| `supabase` | `SUPABASE_ACCESS_TOKEN` ([dashboard](https://supabase.com/dashboard/account/tokens)) | Queries/migraciones/logs de Supabase vía MCP |

### Setup (una vez por dev, por proyecto)

1. Setea `SUPABASE_ACCESS_TOKEN` en tu entorno (no en un archivo del repo).
2. Agrégalo con **scope local** — queda en tu `~/.claude.json`, atado a este proyecto,
   nunca se commitea:

```bash
claude mcp add supabase --scope local --transport stdio -- npx -y @supabase/mcp-server-supabase@latest --access-token "${SUPABASE_ACCESS_TOKEN}"
```

3. Confirma que quedó activo: `claude mcp list`.

## Agregar un MCP server nuevo

1. **¿Necesita un secreto?**
   - **No** → agrégalo a `.mcp.json` (server compartido) y documéntalo en la tabla de arriba.
   - **Sí** → **no** lo metas en `.mcp.json`. Documéntalo en la tabla de "Servers personales" de
     este archivo y que cada dev lo agregue con `claude mcp add --scope local` como arriba.
2. Si el server expone tools que el agente debe poder llamar sin pedir permiso cada vez,
   agrégalas a `.claude/settings.json` (`permissions.allow`) si es compartido, o a
   `.claude/settings.local.json` si es personal.
3. Actualiza la tabla correspondiente en este archivo.

## Por qué `.mcp.json` está commiteado (a diferencia de otros blueprints Koa)

El `.gitignore` original de este blueprint traía `.mcp.json` ignorado por defecto (asumiendo que
cada dev podría necesitar tooling distinto). Para este proyecto se decidió lo contrario: los
servers compartidos no tienen secretos y son los mismos para todo el equipo, así que commitearlos
evita el paso manual de copiar un `.example`. El único server con secreto (`supabase`) se resolvió
aparte, vía scope local — ver arriba.
