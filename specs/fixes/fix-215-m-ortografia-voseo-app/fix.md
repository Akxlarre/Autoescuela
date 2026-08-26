# Fix: Ortografía y voseo argentino residual en toda la app

> id: fix-215-m-ortografia-voseo-app
> refs: ASG-i-001
> status: done
> closed: 2026-08-25
> created: 2026-08-25

## Root Cause

[Heredado de ASG-i-001, a confirmar]: Quedan restos de voseo argentino (vos/tenés/podés/hacé/creá)
mezclados con el tuteo (tú/tienes/puedes), que es la convención real del proyecto — confirmado por
el precedente `fix-002-i-voseo-configuracion-web` (ASG-b-021), que corrigió Configuración Web
convirtiendo voseo → tuteo, no al revés. El texto original de `ASG-i-001` está redactado de forma
ambigua/invertida ("verificar el uso correcto del voseo argentino... en vez de tú/tienes/puedes"),
pero tanto el precedente como confirmación explícita del dueño de negocio establecen que la
dirección correcta es **eliminar voseo, no imponerlo**.

Grep inicial (`\bvos\b|tenés|podés|hacé|creá|seleccioná|usá|querés|reconfigurá`) sobre `src/app`
encontró 3 instancias nuevas de voseo fuera de lo ya cubierto por `fix-002-i`:

- `src/app/features/tareas/task-detail-modal.component.ts:143` — "Seleccioná una tarea para ver el detalle."
- `src/app/core/facades/asistencia-clase-b.facade.ts:246` — "Podés reactivarlas después desde la misma alerta."
- `src/app/features/admin/configuracion-web/tabs/cursos-tab.component.ts:67` — "Hacé clic en \"Agregar Curso\" para crear una." (el fix-002-i barrió este tab con una regex más angosta y no lo detectó — regex a repetir/ampliar en este fix)

Además del voseo, el alcance de `ASG-i-001` incluye una revisión de ortografía general en toda la
app (sin ejemplos concretos pre-cargados por la asignación — queda pendiente de barrido manual/heurístico
al ejecutar este fix).

## ACs Afectados

Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio

Barrido de voseo argentino → tuteo en 4 archivos (los 3 detectados en el grep inicial + 1 más
encontrado en un segundo barrido con patrón de formas imperativas de voseo):

- `src/app/features/tareas/task-detail-modal.component.ts:143` — "Seleccioná una tarea..." → "Selecciona una tarea..."
- `src/app/core/facades/asistencia-clase-b.facade.ts:246` — "Podés reactivarlas..." → "Puedes reactivarlas..."
- `src/app/features/admin/configuracion-web/tabs/cursos-tab.component.ts:67` — "Hacé clic..." → "Haz clic..."
- `src/app/shared/components/task-reply-thread/task-reply-thread.component.ts:64` — placeholder "Escribí tu respuesta…" → "Escribe tu respuesta…"

**Fuera de alcance de este fix (scope adicional detectado durante la implementación):** la
revisión de ortografía general en toda la app. Un barrido inicial con palabras comunes sin tilde
(`aqui`, `facil`, `codigo`, `telefono`, `sesion`, etc.) devolvió mayormente falsos positivos —
identificadores de código (`data-llm-action`, nombres de propiedades como `telefono`/`sesion` en
modelos DTO/UI), no texto visible al usuario. Filtrar eso a mano en toda la app es un barrido no
acotado, ajeno a "un fix = una causa raíz". Se recomienda una asignación de equipo nueva
(`/assign-new`) dedicada solo a ortografía, con alcance explícito (qué carpetas/patrones) para no
repetir este ruido.

## Test de Regresión

Copy puro sin lógica de decisión (mismo caso que `fix-002-i`) — no aplica test automatizado según
`.claude/rules/testing-tdd.md`. Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit`
limpio en los 4 archivos tocados.
