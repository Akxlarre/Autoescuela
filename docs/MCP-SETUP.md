# Setup de MCP Servers

`.mcp.json` está commiteado a propósito (no tiene secretos: Playwright corre vía `npx`), y
`.claude/settings.json` tiene `"enableAllProjectMcpServers": true`. Con eso, un dev nuevo que
clona el repo y abre Claude Code **no tiene que correr ni aprobar nada** — el server queda
disponible automáticamente en la primera sesión.

## Servers requeridos

| Server | Para qué | Usado por |
|---|---|---|
| `playwright` | QA visual en navegador real: screenshots, consola, DOM, network | skill `/verify` (ver `.claude/skills/verify/SKILL.md`) y los permisos `mcp__playwright__*` en `.claude/settings.json` |

## Agregar un MCP server nuevo

1. Agrégalo a `.mcp.json`. **Nunca metas tokens/API keys en texto plano ahí** — si el server los
   necesita, usa `${VAR_NAME}` (Claude Code lo interpola desde el entorno) y que cada dev lo
   resuelva vía su `.env` local. Un server que sí requiera secretos no debería ir en el `.mcp.json`
   compartido — mejor documentarlo aquí y que cada dev lo agregue a su config personal
   (`~/.claude.json` o `.claude/settings.local.json`, gitignoreados).
2. Si el server expone tools que el agente debe poder llamar sin pedir permiso cada vez,
   agrégalas a `.claude/settings.json` (`permissions.allow`).
3. Documenta el server en la tabla de arriba.

## Por qué está commiteado (a diferencia de otros blueprints Koa)

El `.gitignore` original de este blueprint traía `.mcp.json` ignorado por defecto (asumiendo que
cada dev podría necesitar tooling distinto). Para este proyecto se decidió lo contrario: como el
único server (`playwright`) no tiene secretos y es el mismo para todo el equipo, commitearlo
directo evita el paso manual de copiar un `.example`.
