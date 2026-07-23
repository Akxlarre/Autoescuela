---
description: Reclamar una Asignación de equipo y generar tu propio track SDD (spec/fix/hotfix) a partir de ella
argument-hint: "[<ASG-ID>] [--as=spec|fix|hotfix]"
allowed-tools: Read, Write, Bash, Glob
---

# /assign-claim — Reclamar una Asignación y generar tu track

Vas a tomar una Asignación de equipo (`specs/assignments/ASG-NNN-*.md`) y convertirla en tu propio
track SDD real (spec, fix o hotfix), numerado bajo **tu propio código de autor**, con el contexto
de la Asignación pre-cargado en vez de arrancar de cero.

## Argumento recibido

**$ARGUMENTS**

## Procedimiento

### 1. Resolver mi propio código de autor

```bash
cat .claude/author.local.json 2>/dev/null
```

Si no existe, preguntale al usuario su código y nombre, y creá `.claude/author.local.json` a partir de `.claude/author.local.json.example` (mismo bootstrap que `/spec-new`/`/fix-new`). Sin esto no podés numerar tu track — es obligatorio para este comando.

### 2. Chequeo de sincronización (multi-rama) — antes de leer nada

```bash
git fetch origin --quiet 2>/dev/null
```

Detectá la rama principal remota (`origin/main` o `origin/master`). Si existe, compará:

```bash
git diff --quiet HEAD origin/main -- specs/ASSIGNMENTS.md specs/assignments/ 2>/dev/null
```

Si tu copia local está atrás, avisá **antes de continuar**:

```
⚠️  specs/ASSIGNMENTS.md tiene cambios en origin/<rama> que no tenés localmente.
    Alguien pudo haber reclamado esta u otras asignaciones en paralelo.
    Recomendado: git pull antes de reclamar, para no chocar con otra persona.
```

y preguntale al usuario si quiere `git pull` primero o continuar de todas formas. Si el fetch falla (sin remoto, sin red), seguí sin bloquear — es best-effort.

### 3. Identificar QUÉ asignación reclamar

Parseá `$ARGUMENTS`:

- **Si viene un ID** (con o sin prefijo `ASG-`, con o sin ceros — ej. `3`, `ASG-003`, `asg-3` son equivalentes): buscala en la tabla "Pendientes" de `specs/ASSIGNMENTS.md`.
- **Si no viene ID**: filtrá la tabla "Pendientes" por `Asignado a == mi código` o `Asignado a == cualquiera`.
  - Si hay exactamente 1 match → usala directo.
  - Si hay más de 1 → listalas y preguntale al usuario cuál quiere reclamar.
  - Si hay 0 → avisá "No hay asignaciones pendientes para vos ahora mismo" y sugerí `/assign-list --all`.

### 4. Validar que se puede reclamar

- Si el estado de esa fila/archivo ya es `reclamada` o `completada` → BLOQUEAR: "ASG-NNN ya fue reclamada por <quien> el <fecha> → <track resultante>. No se puede reclamar de nuevo."
- Si `Asignado a` es un código específico que **no es el mío** (y no es `cualquiera`) → BLOQUEAR: "ASG-NNN está asignada a <código>, no a vos. Si es un error, que <código> la reclame, o pedile a quien la creó que la reasigne."
- Si pasa la validación, continuar.

### 5. Leer el contenido de la Asignación

Leé `specs/assignments/ASG-NNN-slug.md` completo: Contexto/Objetivo, Alcance sugerido, Referencias,
Archivos involucrados, Notas, y el campo `tipo_sugerido`.

### 6. Chequeo de solape de archivos (best-effort, no bloqueante)

Si la sección "Archivos involucrados" de la Asignación que vas a reclamar está vacía o dice "Ninguno
declarado", saltá este paso.

Si tiene paths:

```bash
grep -l "status: reclamada" specs/assignments/ASG-*.md 2>/dev/null
```

Para cada archivo de Asignación ya `reclamada` (excluyendo la que estás por reclamar), leé su sección
"Archivos involucrados" y compará contra la de la Asignación actual. Si hay al menos un path en común
(match exacto o mismo archivo bajo un glob declarado):

```
⚠️  ASG-NNN comparte archivo(s) con ASG-XXX (ya reclamada por <código>, track <id>):
    - <archivo compartido>
    Coordiná con esa persona antes de tocarlo en paralelo, para no pisarse el trabajo.
```

Preguntale al usuario si quiere continuar igual o prefiere coordinar primero. No bloquees si no hay
overlap, si las Asignaciones no declararon archivos, o si el chequeo no puede determinar solape con
certeza — es una señal de alerta, no un gate duro.

### 7. Determinar el tipo efectivo

- Si `$ARGUMENTS` incluye `--as=spec|fix|hotfix`, ese valor manda.
- Si no, usá el `tipo_sugerido` del archivo de la Asignación.
- Si al leer el Contexto te parece que el tipo sugerido no encaja (ej. sugerido como "fix" pero claramente requiere decisiones de diseño y AC nuevos), decíselo al usuario y preguntale si prefiere cambiar el tipo con `--as=`.

### 8. Generar el track, según el tipo efectivo

En los 3 casos: determiná el próximo número **bajo tu propio código de autor**, exactamente con la
misma regla que ya usan `/spec-new`, `/fix-new` y `/hotfix` (listar los tracks existentes de ESE tipo
que correspondan a tu código, tomar el máximo + 1; si no hay ninguno, empezar en `0001` para spec o
`001` para fix/hotfix).

#### Si es `spec`:

- Crear `specs/NNNN-<mi_codigo>-slug/` con `spec.md`, `plan.md`, `tasks.md`, `acceptance.md` — mismo scaffold que `/spec-new`.
- En `spec.md`, la sección **"1. Contexto de negocio"** se pre-llena con el Contexto/Objetivo de la Asignación (no la dejes en placeholder — ya tenés contenido real). El resto (User Stories, AC, Out of scope, etc.) queda con placeholders — eso lo escribe quien reclamó, no vos.
- Agregá al final de "9. Notas / decisiones abiertas": `- Originado de Asignación ASG-NNN (specs/assignments/ASG-NNN-slug.md)`.
- Actualizá `specs/ROADMAP.md`: agregá fila a "Backlog" con el owner = quien reclamó.
- **NO** toques `specs/.active` (igual que `/spec-new`: el usuario revisa antes de activar con `/spec-activate`).

#### Si es `fix`:

- Crear `specs/fix-NNN-<mi_codigo>-slug/fix.md` (mismo template que `/fix-new`).
- La sección **"Root Cause"** se pre-llena con el Contexto/Objetivo de la Asignación, marcado explícitamente como hipótesis heredada: prefijalo con `[Heredado de ASG-NNN, a confirmar]:` antes del texto.
- El campo `refs:` del frontmatter apunta a `ASG-NNN` si no hay spec relacionada más específica.
- **Sí** escribís `specs/.active` con el nuevo ID (igual que `/fix-new`).

#### Si es `hotfix`:

- Crear `specs/fixes/hotfixes/hotfix-NNN-<mi_codigo>-slug/hotfix.md` (mismo template que `/hotfix`).
- La sección **"Problema"** se pre-llena igual, con el mismo prefijo `[Heredado de ASG-NNN, a confirmar]:`.
- **Sí** escribís `specs/.active` con el nuevo ID (igual que `/hotfix`).

### 9. Actualizar `specs/ASSIGNMENTS.md`

- Quitá la fila de "Pendientes".
- Agregala a "Reclamadas / En curso": ID, título, quién reclamó (mi código), track resultante (ID + link relativo), fecha de hoy.
- Actualizá también el frontmatter de `specs/assignments/ASG-NNN-slug.md`: `status: reclamada`, `claimed_by`, `claimed_at`, `resulting_track`.

### 10. Commit + push automático de la reclamación (sin confirmar — decisión explícita del equipo)

Este paso corre siempre, sin preguntar, salvo que el paso 2 haya detectado que el fetch falló (sin red/remoto) — en ese caso saltalo y avisá en el reporte final que quedó pendiente de push manual.

```bash
git branch --show-current
```

- **Si la rama actual es `main`/`master`** (la rama principal detectada en el paso 2): stagea **solo** estos paths exactos (nunca `-A` ni `.`):
  - `specs/ASSIGNMENTS.md`
  - `specs/assignments/ASG-NNN-slug.md`
  - el path nuevo del track (`specs/fix-NNN-<codigo>-slug/`, `specs/NNNN-<codigo>-slug/` o `specs/fixes/hotfixes/hotfix-NNN-<codigo>-slug/`)

  Luego commiteá con `chore(assign): reclamar ASG-NNN → <track-id>` y pusheá directo (`git push`), sin pedir confirmación — el usuario ya autorizó este flujo de forma durable. Si el push falla (conflicto con otro push en paralelo), NO forcees: hacé `git pull --rebase` una vez y reintentá; si vuelve a fallar, avisá al usuario en el reporte en vez de insistir.
- **Si la rama actual NO es la principal:** no intentes pushear a main desde ahí (cambiar de rama con cambios de otro feature en curso es más riesgoso y no fue lo que se autorizó). Commiteá igual esos mismos paths puntuales en la rama actual como respaldo local, y en el reporte avisá que falta llevar `specs/ASSIGNMENTS.md` + el track nuevo a `main` a mano (ej. cherry-pick o pasar a `main` antes de seguir).

### 11. Reportar al usuario

Usá el mismo formato de reporte que ya imprime el comando subyacente (`/spec-new`, `/fix-new` o `/hotfix`), y agregale al principio:

```
✅ ASG-NNN reclamada → generó <tipo>: <track-id>
   (contexto pre-cargado desde specs/assignments/ASG-NNN-slug.md)

[... reporte estándar del comando subyacente ...]

✅ Commit + push automático a <rama>: <hash corto> — ya visible para el resto del equipo.
```

o, si no se pudo pushear (sin red, conflicto persistente, o no estabas en la rama principal):

```
⚠️  No se pudo pushear automáticamente (<motivo>). Commiteado localmente en <rama>;
    llevá specs/ASSIGNMENTS.md + el track nuevo a la rama principal a mano antes de
    que alguien más reclame ASG-NNN en paralelo.
```

## Reglas

- Nunca reclames una Asignación que ya está `reclamada`/`completada`, ni una asignada a otro código específico.
- Nunca inventes User Stories, AC, o Root Cause más allá de lo que ya dice la Asignación — pre-cargás el contexto, no completás el contrato entero (eso sigue siendo trabajo de quien reclama, con `/spec-plan`/`/spec-tasks` o completando `fix.md` a mano).
- La numeración del track nuevo SIEMPRE es bajo el código de autor de quien reclama, nunca bajo el de quien creó la Asignación.
- No bloquees si el chequeo de `git fetch` falla — es best-effort, no un gate duro.
- Si el usuario no tiene claro qué Asignación reclamar y hay varias candidatas, preguntale — no elijas por él.
