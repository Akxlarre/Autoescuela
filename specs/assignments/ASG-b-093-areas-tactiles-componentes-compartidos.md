# Asignación ASG-b-093 — Áreas táctiles bajo 44×44 en componentes compartidos (`app-tabs`, `app-section-hero`)

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-08-22
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-24
> **resulting_track:** fix-150-b-areas-tactiles-compartidos

---

## Contexto / Objetivo

Detectado durante la verificación móvil de `fix-147-b` (rollout app-like del portal alumno),
midiendo en dispositivos reales con `isMobile`/`hasTouch`:

| Elemento | Medido | Mínimo |
|---|---|---|
| Tabs de `<app-tabs variant="segmented">` | **94×32** y **73×32** | 44×44 |
| Link "volver" de `<app-section-hero>` (`backLabel`) | **50×16** | 44×44 |

Los 32px y 16px de **alto** están muy por debajo del mínimo táctil. No es cosmético: el portal
alumno se usa mayoritariamente en móvil, y en `/alumno/clases` las tabs Prácticas/Teoría son el
control principal de la pantalla. Ya existe precedente exacto del criterio en `ASG-b-061` (área
táctil del rail de alertas), así que el estándar del proyecto ya está fijado — esto es aplicarlo
a dos componentes que quedaron fuera.

## Alcance sugerido

- Subir el área táctil de ambos componentes a **≥44×44** en móvil sin engordar el diseño en
  desktop (el patrón habitual es padding/min-height por breakpoint o container query, no un
  tamaño único).
- Barrer si hay otros compartidos con el mismo problema en vez de arreglar solo estos dos —
  el mismo barrido que hizo `ASG-b-061`, pero sobre el vocabulario de controles del DS.
- **Probablemente amerite un guardrail** en `scripts/architect.js` para que no reaparezca, en la
  línea del primer guardrail de a11y que dejó `fix-079-b`. Evaluarlo, no darlo por hecho.

## Referencias

- `specs/fixes/fix-147-b-app-like-portal-alumno/fix.md` §"Verificación móvil" — la medición que
  originó esta asignación, con los números por dispositivo
- `ASG-b-061` — precedente del criterio de 44×44 (rail de alertas de Asistencia B)
- `fix-079-b` — precedente del primer guardrail de accesibilidad en `architect.js`

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/shared/components/tabs/tabs.component.ts`
- `src/app/shared/components/section-hero/section-hero.component.ts`
- `scripts/architect.js` (solo si se decide agregar el guardrail)

## Notas para quien la reclame

- ⚠️ **Es transversal, no del portal alumno.** `app-tabs` se usa en `admin`, `alumno` e
  `instructor`, y entre los dos componentes suman **58 archivos** que los referencian. Verificar
  las rutas consumidoras de los 4 portales antes de cerrar — es exactamente el edge case
  "si el componente es `shared`, verificar TODAS las rutas consumidoras" del checklist del
  rollout app-like.
- `tabs.component.ts` **ya tiene `.spec.ts`**; si se toca lógica, mantenerlo verde.
- Se dejó fuera de `fix-147-b` a propósito: ese fix era layout del portal alumno y tocar los
  compartidos habría ampliado el alcance a los 4 portales sin contrato que lo cubriera.
