# Asignación ASG-b-062 — El ícono del modal de confirmación es `alert-triangle` incluso para `info`/`success`/`secondary`

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-02
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-02
> **resulting_track:** fix-096-b-icono-modal-confirmacion

---

## Contexto / Objetivo

`app-shell.component.ts:98` resuelve el ícono del modal de confirmación con un ternario binario:
`severity === 'danger' ? 'circle-alert' : 'alert-triangle'`. Cualquier severidad que no sea
`danger` — incluidas `info`, `success` y `secondary` (el default cuando no se pasa `severity`)
— muestra un triángulo de advertencia. Un modal informativo ("Re-matricular alumno") o neutral
se ve como si algo estuviera mal.

Detectado como observación no corregida al cerrar `fix-094-b` (que arregló el **color** del CTA,
no el ícono, para no estirar el alcance de ese fix).

## Corrección de conteo (para no repetir el error de `fix-094-b`)

`fix-094-b` reportó "24 llamadas con `severity: 'danger'`" contando el string en **todo el
repo** (incluye `p-tag`/badge/toast, que comparten el mismo vocabulario de severidad pero son
componentes distintos). Escopado de verdad a `confirmModal.confirm(...)`:

```
danger      10 llamadas
warn         4 llamadas
info         4 llamadas
success      0 llamadas (declarada en ConfirmSeverity, sin uso hoy)
secondary    4 llamadas (implícito — no pasan severity)
```

(+ 3 facades que reenvían un `config` recibido del caller sin severidad propia —
`asistencia-profesional.facade.ts`, `dms.facade.ts`, `enrollment.facade.ts` — su severidad la
define quien las llama, ya contada arriba en la categoría que corresponda).

Los 4 `info` + 4 `secondary` (8 de 22) muestran hoy el triángulo incorrecto.

## Alcance sugerido

- Reusar el mismo vocabulario de íconos que ya existe en `alert-card.component.ts` (canon del
  DS para severidad → ícono): `error → circle-alert`, `warning → alert-triangle`,
  `info → info`, `success → circle-check`. Los 4 íconos ya están registrados en
  `app.config.ts` (`Info`, `CircleCheck`, `AlertTriangle`, `CircleAlert`) — cero registro nuevo.
- `secondary` no tiene equivalente en `alert-card` (esa severidad no existe ahí). Candidato:
  reusar el ícono `info` — `--state-info` y `--color-primary` son el mismo azul en modo oscuro
  y casi idénticos en claro (`src/styles/tokens/_variables.scss:209/228/454/461`), así que
  visualmente no choca con el tratamiento `bg-brand-muted`/`text-brand` que ya tiene `secondary`.
  No es la única opción válida — quien reclame puede decidir otra si tiene mejor criterio.
- Cambio acotado a `app-shell.component.ts` (mismo archivo que tocó `fix-094-b`), sin tocar
  color/fondo del ícono (ya correctos desde antes).

## Referencias

- `fix-094-b-confirm-modal-severity-cta` — corrigió el color del CTA; esta es la deuda de
  ícono que quedó anotada como "Observación no corregida" en su `fix.md`.
- `alert-card.component.ts` (`shared/components/alert-card/`) — canon existente de
  severidad → ícono, para no inventar un vocabulario nuevo.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/layout/app-shell.component.ts`

## Notas para quien la reclame

- Prioridad P2: es semántica visual, no bloquea nada ni es incumplimiento de accesibilidad.
- Si el mapeo de `secondary` a `info` no convence al revisar la captura, es la única parte de
  esta asignación con margen de criterio — el resto (`danger`/`warn`/`info`/`success`) es
  mecánico, copiado del canon existente.
