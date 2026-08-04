# Setup de MCP Servers

`.mcp.json` está en `.gitignore` (config local por dev), así que cada quien lo crea a partir
del ejemplo versionado:

```bash
cp .mcp.json.example .mcp.json
```

Reinicia Claude Code (o corre `claude mcp list`) para que levante los servers definidos ahí.

## Servers requeridos

| Server | Para qué | Usado por |
|---|---|---|
| `playwright` | QA visual en navegador real: screenshots, consola, DOM, network | skill `/verify` (ver `.claude/skills/verify/SKILL.md`) y los permisos `mcp__playwright__*` en `.claude/settings.json` |

## Agregar un MCP server nuevo

1. Agrégalo a `.mcp.json.example` (nunca metas tokens/API keys ahí — si el server los necesita,
   usa `${VAR_NAME}` y que cada dev lo resuelva vía su `.env` local).
2. Si el server expone tools que el agente debe poder llamar sin pedir permiso cada vez,
   agrégalas a `.claude/settings.json` (`permissions.allow`).
3. Documenta el server en la tabla de arriba.
