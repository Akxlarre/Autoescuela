---
description: Crear una nueva spec SDD (Spec-Driven Development) con scaffold completo
argument-hint: "<título del feature>"
allowed-tools: Read, Write, Bash, Glob
---

# /spec-new — Crear nueva spec SDD

Vas a crear el scaffold completo de una nueva spec siguiendo el patrón SDD de Koa CLI.

## Argumento recibido

Título del feature: **$ARGUMENTS**

(Si está vacío, pedile al usuario que provea un título descriptivo. Ejemplo: "Pre-inscripción profesional online".)

## Procedimiento

### 1. Verificar que el proyecto tenga SDD inicializado

```bash
ls specs/
```

- Si `specs/` no existe, créalo y copia `.claude/skills/sdd/templates/ROADMAP.md` a `specs/ROADMAP.md`. Crea también `specs/.active` vacío.

### 2. Determinar el próximo ID secuencial

- Lista las carpetas existentes en `specs/` con formato `NNNN-*`
- El próximo ID es el máximo encontrado + 1, formateado como 4 dígitos (`0001`, `0002`, etc.)
- Si no hay specs, empieza en `0001`

### 3. Generar slug del título

- Lowercase
- Sin acentos (á→a, é→e, etc.)
- Espacios → guiones
- Solo `[a-z0-9-]`
- Ejemplo: "Pre-inscripción Profesional Online" → `pre-inscripcion-profesional-online`

### 4. Crear estructura de carpetas

```
specs/NNNN-slug/
├── spec.md          (copiar desde .claude/skills/sdd/templates/spec.md)
├── plan.md          (vacío todavía — se genera con /spec-plan)
├── tasks.md         (vacío todavía — se genera con /spec-tasks)
└── acceptance.md    (vacío todavía — se genera con /spec-verify)
```

Para los 3 archivos vacíos por ahora, créalos con solo este placeholder:
```
# (vacío — se genera con /spec-XXX cuando corresponda)
```

### 5. Personalizar `spec.md`

Lee la plantilla `.claude/skills/sdd/templates/spec.md` y reemplaza los placeholders:
- `{{ID}}` → el ID nuevo (ej. `0001`)
- `{{TITLE}}` → el título del feature
- `{{DATE}}` → fecha actual en formato `YYYY-MM-DD`
- `{{OWNER}}` → el usuario (preguntá si no lo sabés)
- `{{P0|P1|P2}}` → preguntale al usuario la prioridad

Las secciones internas (User Stories, AC, etc.) las dejás con los placeholders `{{...}}` para que el usuario las complete. NO inventes contenido de negocio.

### 6. Actualizar `specs/ROADMAP.md`

Agrega una fila a la tabla "Backlog" con el nuevo ID, título, prioridad y dueño.

### 7. Reportar al usuario

Imprime:

```
✅ Spec NNNN-slug creada en specs/NNNN-slug/

Archivos:
  - spec.md (plantilla lista para completar)
  - plan.md (vacío)
  - tasks.md (vacío)
  - acceptance.md (vacío)

Próximos pasos:
  1. Completá las secciones de spec.md (User Stories, AC, Out of scope, etc.)
  2. Cambiá el status de "draft" a "approved" cuando esté lista
  3. /spec-activate NNNN-slug para empezar a trabajarla
  4. /spec-plan para generar el plan técnico

¿Querés que te ayude a redactar las User Stories y los Acceptance Criteria ahora?
```

## Reglas

- NO actives la spec automáticamente (eso es trabajo de `/spec-activate`).
- NO redactes user stories ni AC sin pedírselos al usuario — la spec es su contrato.
- NO toques `specs/.active` en este comando.
- Si el usuario invoca `/spec-new` sin argumento, pedile el título antes de hacer nada.
