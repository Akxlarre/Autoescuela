---
description: Listar Asignaciones de equipo pendientes — las tuyas por defecto, o todas con --all
argument-hint: "[--all]"
allowed-tools: Read, Bash, Glob
---

# /assign-list — Ver Asignaciones pendientes

## Argumento recibido

**$ARGUMENTS**

## Procedimiento

### 1. Resolver mi propio código de autor

```bash
cat .claude/author.local.json 2>/dev/null
```

- Si no existe, preguntale al usuario su código y nombre, y creá `.claude/author.local.json` a partir de `.claude/author.local.json.example` (mismo bootstrap que usan `/spec-new` y `/fix-new`).
- Si el proyecto no tiene sistema de autores (no existe `specs/AUTHORS.md`), avisá que este comando asume convención de autor y segui igual mostrando todo sin filtrar por owner.

### 2. Verificar que exista el tablero

```bash
cat specs/ASSIGNMENTS.md 2>/dev/null
```

- Si no existe, avisá: "No hay specs/ASSIGNMENTS.md todavía — nadie ha creado una Asignación con /assign-new. Nada que listar."

### 3. Parsear la tabla "Pendientes"

Leé las filas de la tabla bajo el encabezado `## Pendientes`. Cada fila tiene: ID, Título, Asignado a, Tipo sugerido, Prioridad, Creado por, Notas.

### 4. Filtrar

- **Sin `--all`** (default): mostrar solo filas donde `Asignado a` == mi código de autor, **o** `Asignado a` == `cualquiera`.
- **Con `--all`**: mostrar todas las filas de "Pendientes" sin filtrar, agrupadas visualmente por owner.

### 5. Reportar

Si hay resultados (modo default):

```
📋 Asignaciones pendientes para vos (<código>) o abiertas para cualquiera:

  ASG-003 · Migrar selects de Liquidaciones · asignada a vos · fix · P1
  ASG-005 · Rediseño de X · cualquiera · spec · P2

Para tomar una: /assign-claim ASG-003
```

Si no hay ninguna:

```
No hay Asignaciones pendientes para vos ahora mismo.
(<N> asignaciones pendientes existen en total para otras personas — usá /assign-list --all para verlas todas)
```

Si `--all`, agrupar por owner en el output para que sea fácil de escanear.

## Reglas

- Es un comando de solo lectura — nunca escribe ni modifica `specs/ASSIGNMENTS.md` ni ningún otro archivo.
- No hace `git fetch` — si el usuario sospecha que su copia está desactualizada, que corra `git pull` manualmente antes (este comando es de consulta rápida, no el punto de sincronización — eso vive en `/assign-claim`, que sí valida antes de reclamar).
