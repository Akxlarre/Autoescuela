---
description: Crear una nueva Asignación de equipo (tarea previa a un track SDD, para designarla a alguien)
argument-hint: "<título de la tarea>"
allowed-tools: Read, Write, Bash, Glob
---

# /assign-new — Crear una Asignación de equipo

Vas a crear una **Asignación**: el paso previo a un track SDD (spec/fix/hotfix). No es el contrato final —
es la forma en que alguien (típicamente quien lidera, pero cualquiera puede) declara "esto hay que hacer"
y se lo designa a un integrante del equipo (o lo deja abierto para quien lo tome primero). Quien la reclame
después con `/assign-claim` generará su propio track real, con contexto pre-cargado desde esta Asignación.

## Argumento recibido

Título de la tarea: **$ARGUMENTS**

(Si está vacío, pedile al usuario un título descriptivo antes de continuar.)

## Procedimiento

### 1. Verificar que el proyecto tenga SDD + Asignaciones inicializado

```bash
ls specs/ 2>/dev/null
ls specs/assignments/ 2>/dev/null
```

- Si `specs/` no existe → avisá que este proyecto no tiene SDD activo (ver `/spec-new` para inicializarlo primero).
- Si `specs/assignments/` no existe, créala y copiá `.claude/skills/sdd/templates/ASSIGNMENTS.md` a `specs/ASSIGNMENTS.md` (reemplazando `{{PROYECTO}}` por el nombre del repo/carpeta actual). Esto es un bootstrap silencioso, igual que `/spec-new` bootstrapea `ROADMAP.md` la primera vez.

### 2. Chequeo de sincronización (multi-rama)

```bash
git fetch origin --quiet 2>/dev/null
```

Detectá la rama principal remota (probá `origin/main`, si no existe probá `origin/master`). Si existe, comparar:

```bash
git diff --quiet HEAD origin/main -- specs/ASSIGNMENTS.md specs/assignments/ 2>/dev/null
```

Si hay diferencias (tu copia local está atrás), avisá:

```
⚠️  specs/ASSIGNMENTS.md tiene cambios en origin/<rama> que tu copia local no tiene.
    Puede que alguien haya creado o reclamado asignaciones en paralelo.
    Recomendado: git pull antes de continuar, para no pisar trabajo de otra persona.
```

y preguntale al usuario si quiere continuar igual o hacer `git pull` primero. Si el repo no tiene remoto configurado o el fetch falla, seguí sin bloquear (no es un error fatal, solo una advertencia best-effort).

### 3. Determinar el próximo ID

- Listar archivos existentes bajo `specs/assignments/` con patrón `ASG-NNN-*.md`
- El próximo ID es el máximo encontrado + 1, formateado a 3 dígitos (`001`, `002`, …)
- Si no hay ninguno, empezar en `001`

### 4. Generar slug del título

- Lowercase, sin acentos, espacios → guiones, solo `[a-z0-9-]`
- Ejemplo: "Migrar selects de Liquidaciones" → `migrar-selects-de-liquidaciones`

### 5. Recolectar metadata (preguntale al usuario, conversacionalmente)

- **Asignado a**: código de autor (revisá `specs/AUTHORS.md` si existe) o `cualquiera` (pool abierto, quien la tome primero se la queda). Si el código dado NO aparece en `specs/AUTHORS.md`, avisá pero no bloquees: "Ese código no está registrado en AUTHORS.md — asegurate de agregarlo ahí antes de que esa persona cree su primer track, para evitar colisiones de numeración."
- **Tipo sugerido**: `spec` / `fix` / `hotfix` — preguntale cuál cree que aplica mejor (podés sugerir uno basado en la descripción que te dé, pero confirmá con el usuario).
- **Prioridad**: P0 / P1 / P2.
- **Contexto/Objetivo breve**: 2-4 frases de qué hay que lograr y por qué — esto es lo más importante, porque se pre-carga tal cual cuando alguien reclame la asignación.
- **Archivos involucrados (opcional)**: si ya sabés qué archivos/paths probablemente toca, pedíselos al usuario o inferilos vos mismo del contexto que te dio (sin inventar rutas que no puedas verificar — si dudás, dejalo en blanco). Esto alimenta el chequeo de solapes de `/assign-claim`.

### 6. Crear `specs/assignments/ASG-NNN-slug.md`

Lee la plantilla `.claude/skills/sdd/templates/assignment.md` y reemplazá:
- `{{ID}}` → `ASG-NNN`
- `{{TITLE}}`, `{{DATE}}` (fecha actual `YYYY-MM-DD`), `{{OWNER}}`, `{{CREATED_BY}}` (código de autor de quien corre el comando, si `.claude/author.local.json` existe; si no, dejalo en blanco)
- `{{spec|fix|hotfix}}` → el tipo sugerido
- `{{P0|P1|P2}}` → la prioridad
- La sección "Contexto / Objetivo" con lo que te haya dado el usuario en el paso 5 (no la dejes en placeholder si ya tenés el contenido)
- La sección "Archivos involucrados" con los paths del paso 5 si los hay; si no, dejala en "Ninguno declarado" (nunca inventes rutas sin verificarlas)
- "Alcance sugerido", "Referencias" y "Notas" quedan con placeholders si el usuario no te dio ese detalle — no inventes contenido de negocio

### 7. Actualizar `specs/ASSIGNMENTS.md`

Agregá una fila a la tabla "Pendientes":

```
| ASG-NNN | {{título}} | {{owner}} | {{tipo}} | {{prioridad}} | {{created_by}} | — |
```

### 8. Reportar al usuario

```
✅ Asignación ASG-NNN creada en specs/assignments/ASG-NNN-slug.md
✅ specs/ASSIGNMENTS.md actualizado (tabla "Pendientes")

Asignada a: <owner>  |  Tipo sugerido: <tipo>  |  Prioridad: <prioridad>

⚠️  Multi-rama: commiteá y pusheá este cambio (specs/ASSIGNMENTS.md +
    specs/assignments/ASG-NNN-*.md) AHORA MISMO a la rama principal compartida,
    antes de seguir trabajando en otra cosa — así el resto del equipo ve la
    asignación nueva sin demora.

Próximos pasos:
  - Avisale a <owner> (o al equipo, si es "cualquiera")
  - Esa persona corre /assign-list para verla, y /assign-claim ASG-NNN para tomarla
```

## Reglas

- NO actives ningún track automáticamente — esto solo crea la Asignación, no toca `specs/.active`.
- NO redactes tú el Contexto/Objetivo sin que el usuario te lo dicte — es su declaración de qué hace falta, no la inventes.
- NO bloquees si el `git fetch` falla (repo sin remoto, sin conexión, etc.) — es una verificación best-effort, no un gate duro.
- Si el usuario invoca `/assign-new` sin argumento, pedile el título antes de hacer nada más.
