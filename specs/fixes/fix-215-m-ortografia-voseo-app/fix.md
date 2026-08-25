# Fix: Ortografía y voseo argentino residual en toda la app

> id: fix-215-m-ortografia-voseo-app
> refs: ASG-i-001
> status: in_progress
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

_(pendiente — completar al implementar)_

## Test de Regresión

_(pendiente — completar al implementar; probablemente copy puro sin lógica de decisión, similar a `fix-002-i`)_
