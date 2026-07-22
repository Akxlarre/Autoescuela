---
description: Generar plan técnico (plan.md) para la spec SDD activa, basado en spec + índices del proyecto
allowed-tools: Read, Write, Glob, Grep, Bash
---

# /spec-plan — Generar plan técnico para la spec activa

Vas a producir el `plan.md` de la spec actualmente activa, conectándola con los recursos existentes del proyecto.

## Procedimiento

### 1. Identificar la spec activa

```bash
cat specs/.active
```

- Si está vacío o tiene `--bypass` → abortar con mensaje: "No hay spec activa. Usá /spec-activate <ID> primero."
- Si tiene un ID, leer `specs/<id>/spec.md`

### 2. Verificar que la spec esté aprobada

- Buscar el campo `Status:` en el frontmatter de `spec.md`
- Si está en `draft` → preguntá al usuario si está seguro de planificar antes de aprobarla
- Si está en `done` o `archived` → abortar

### 3. DESCUBRIR — leer índices del proyecto

Antes de planificar, leé los índices del proyecto (si existen):

```bash
ls indices/ 2>/dev/null
```

Si existen, leelos en paralelo:
- `indices/COMPONENTS.md` — ¿qué componentes UI ya existen?
- `indices/FACADES.md` — ¿qué facades cubren el dominio?
- `indices/SERVICES.md` — ¿qué services transversales hay?
- `indices/DATABASE.md` — ¿qué tablas relacionadas existen?
- `indices/MODELS.md` — ¿qué DTOs/UI models hay?
- `indices/DIRECTIVES.md` — ¿hay directivas reutilizables?
- `indices/STYLES.md` — ¿qué tokens/clases del DS aplican?

Si el proyecto no tiene `indices/`, marca esa sección del plan como "N/A — proyecto sin índices canónicos" y procedé igual.

### 4. Clasificar el tamaño del feature (auto-sizing)

Con la información de Discovery, evaluá estas señales:

| Señal | S | M | L |
|-------|---|---|---|
| Archivos a modificar/crear | ≤5 | 6–10 | >10 |
| Facade o servicio nuevo | No | Puede | Sí |
| Migración SQL | No | Simple | Compleja o múltiple |
| ACs ambiguos o abiertos | Ninguno | 1–2 | Varios |
| Nuevo dominio de negocio | No | No | Sí |

**Mostrar al usuario este mensaje antes de continuar** (adaptando los datos reales):

```
Propuesta: Spec-S (feature pequeño, proceso ligero)
Por qué: toca N archivos existentes, sin migración, sin facades nuevos — complejidad acotada.
Qué significa: plan reducido — solo ACs, impacto técnico y testing. Sin secciones de negocio extensas.
Siguiente paso: genero plan.md y arrancamos directo a implementar.
¿Confirmás Spec-S, o preferís talla M (plan completo)?
```

Si es M o L, mostrar el mismo mensaje adaptado y esperar confirmación igualmente.

**Comportamiento por talla:**
- **S** → plan sin secciones: Contexto de negocio, User Stories, Métricas de éxito, checklist de restricciones (solo mencionar las que apliquen, sin tabla). Estimar < 1 día.
- **M** → plan completo con todas las secciones. Estimar 1–3 días.
- **L** → plan completo + advertencia explícita: "Revisar plan antes de implementar — tamaño alto". Estimar > 3 días.

Esperar confirmación del usuario antes de generar el plan.

### 5. Leer las reglas del proyecto

```bash
ls .claude/rules/ 2>/dev/null
```

Si existen, identificá cuáles aplican al feature (architecture, facades, models, visual-system, swr-pattern, notifications, testing-tdd, ai-readability).

### 6. Generar el `plan.md`

> Si la talla clasificada es **S**, omitir las secciones: Contexto de negocio, User Stories, Métricas de éxito, y reemplazar el checklist de Restricciones por una línea simple ("Reglas aplicables: X, Y, Z"). Todo lo demás aplica igual.

Lee la plantilla `.claude/skills/sdd/templates/plan.md` y completala con:

1. **Reemplazos básicos:**
   - `{{ID}}`, `{{TITLE}}`, `{{DATE}}`

2. **Inventario de impacto** (sección 2):
   - Basado en los AC de spec.md, listá los archivos a CREAR y MODIFICAR.
   - Sé específico con paths (no escribas `src/...`, escribí `src/app/features/pre-inscripcion/pre-inscripcion.component.ts`).

3. **Reutilización** (sección 3):
   - Cruzá con los índices: qué componentes/facades/services existentes encajan
   - Si proponés crear algo nuevo, justificá por qué no se puede reutilizar lo existente

4. **Modelo de datos** (sección 4):
   - Si la spec involucra persistencia, propone tablas, RLS y modelos
   - Pseudo-SQL en bloques `sql` (no SQL final — eso va en tasks.md)

5. **Arquitectura del feature** (sección 5):
   - Diagrama ASCII del flujo Smart → Dumb → Facade → BD
   - Mapeo claro de qué capa toca qué

6. **Restricciones aplicables** (sección 6):
   - Marcá con `[x]` solo las reglas que SÍ aplican
   - Si una regla no aplica, dejá `[ ]` (no la borres — sirve de checklist visual)

7. **Plan de testing, riesgos y orden de implementación**:
   - Sé concreto. Riesgos reales (ej: "el endpoint público sin auth puede ser abusado → rate limit"), no genéricos.

### 7. Escribir el archivo y reportar

```bash
# Escribir specs/<active>/plan.md con el contenido generado
```

Imprime:

```
✅ Plan generado: specs/<active>/plan.md

Resumen:
  - <N> archivos a crear, <M> a modificar
  - Reutilización: <X> componentes/facades del proyecto
  - Reglas aplicables: <lista corta>
  - Riesgos identificados: <N>

Revisalo y ajustá lo que haga falta. Cuando lo apruebes:
  /spec-tasks  → para descomponer en tareas atómicas
```

## Reglas

- NO generes `tasks.md` en este comando (eso es de `/spec-tasks`)
- NO empieces a escribir código de producto: este comando solo planifica
- Si los índices revelan que el feature YA existe parcialmente, mencionalo arriba del plan como ⚠️ "Posible duplicación con XXX — confirmar con el usuario"
- El plan debe ser revisable: bullets concretos, no prosa larga
- Si la spec tiene AC vagos o sin Gherkin, devolvé el plan con un bloque "🚨 SPEC NECESITA AJUSTES" listando qué falta
