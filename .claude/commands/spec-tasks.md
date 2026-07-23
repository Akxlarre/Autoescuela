---
description: Descomponer plan.md de la spec activa en tareas atómicas con DoD (tasks.md)
allowed-tools: Read, Write, Bash
---

# /spec-tasks — Descomponer plan en tareas atómicas

Vas a producir `tasks.md` de la spec activa transformando el plan en checklist atómico ejecutable.

## Procedimiento

### 1. Identificar la spec activa

```bash
cat specs/.active
```

- Si está vacío o tiene `--bypass` → abortar: "No hay spec activa."

### 2. Verificar que la spec tenga `plan.md` aprobado

- Leer `specs/<active>/plan.md`
- Si no existe → abortar: "No hay plan. Corre /spec-plan primero."
- Si está marcado como `Status: draft` en frontmatter, advertir al usuario

### 3. Leer también `spec.md`

Necesitas los AC para cruzar cada tarea con el AC que cumple (campo `AC ref:`).

### 4. Generar `tasks.md`

Lee la plantilla `.claude/skills/sdd/templates/tasks.md` y complétala:

#### Reemplazos básicos
- `{{ID}}`, `{{TITLE}}`, `{{DATE}}`

#### Fases obligatorias (ajustar según aplique al feature)

1. **Fase 1 — Datos y modelo**: solo si hay cambios en BD o modelos
2. **Fase 2 — Capa Facade**: solo si el feature toca datos
3. **Fase 3 — Capa UI**: si hay UI involucrada
4. **Fase 4 — Conexión y animación**: wire-up Smart↔Dumb, GSAP
5. **Fase 5 — Validación**: lint, tests, QA manual, /spec-verify
6. **Fase 6 — Cierre**: indices, ROADMAP, .active

Si una fase no aplica al feature, elimínala. No dejes fases vacías.

#### Reglas para cada tarea

- **Atómica**: cabe en un sitting (~30-90 min máx)
- **Verificable**: tiene Definition of Done explícito como sub-checklist
- **Trazable**: tiene `AC ref:` cuando aplica (qué AC de la spec cumple)
- **Ordenada**: dependencias primero (datos → facade → UI → wire-up)

#### Ejemplo de tarea bien escrita

```markdown
- [ ] **T2.2** — Implementar `pre-enrollment.facade.ts`
  - **AC ref:** AC1, AC2, AC-E1
  - **DoD:**
    - [ ] Tests PASAN (`npm run test:ci`)
    - [ ] Estructura: estado privado → estado público readonly → métodos
    - [ ] `catchError` en cada llamada async
    - [ ] Signal de error expuesto
    - [ ] Documentado en `indices/FACADES.md`
```

#### Ejemplo de tarea mal escrita (NO)

```markdown
- [ ] Implementar el backend  ← demasiado grande, sin DoD, sin AC ref
```

### 5. Escribir y reportar

Imprime:

```
✅ Tasks generadas: specs/<active>/tasks.md

Resumen:
  - <N> tareas atómicas en <M> fases
  - <X> tareas mapean a AC específicos
  - Orden recomendado: Datos → Facade → UI → Conexión → Validación → Cierre

Para empezar a ejecutar:
  "Implementa la tarea T1.1"
  (el plan-injector va a inyectar la spec y el plan como contexto en cada Edit)
```

## Reglas

- NO mezclar fases. Datos antes de UI siempre.
- NO crear tareas que no mapeen al `plan.md`. Si descubres algo no planificado, sugiere actualizar el plan primero.
- NO incluir DoD genéricos tipo "está terminado". DoD = lista verificable.
- Si el feature es trivial (1-2 archivos), genera 2-3 tareas, no fuerces 6 fases.
