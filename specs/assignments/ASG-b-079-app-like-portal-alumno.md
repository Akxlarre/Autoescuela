# Asignación ASG-b-079 — App-like: portal alumno (`clases`, `pagos`, `pruebas-online`, `pagar`)

> **status:** reclamada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-22
> **resulting_track:** fix-147-b-app-like-portal-alumno

---

## Contexto / Objetivo

Paso 12 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). Portal usado mayoritariamente en
mobile — el patrón app-like solo aporta en sesiones desktop/laptop, así que es prioridad menor
que el resto del rollout, pero de bajo-medio esfuerzo. `alumno/horario` y `alumno/dashboard`
están en otras piezas (ASG-b-070 y ASG-b-083 respectivamente).

### `/alumno/clases` (`AlumnoClasesComponent`)

Hero + selector-matrícula (opcional) + 1 card con TABS INTERNAS (Prácticas/Teoría, `activeTab`
signal) + banner final condicional (probablemente empty-state).

Plan: `--fill-screen-kpi`: hero=auto, selector=auto, card-de-tabs=fill (`bento-fill flex
flex-col h-full`). **Verificar al implementar** si el banner final (línea ~265 del componente
actual) es mutuamente excluyente con el contenido o se suma como 4ta fila — si se suma, agrupar
como en `alumno/horario` (ASG-b-070).

### `/alumno/pagos` (`AlumnoPagosComponent`)

Hero + selector-matrícula (opcional) + banner de estado (opcional, 1 de 2 variantes mutuamente
excluyentes: aviso saldo pendiente Profesional / "matrícula al día") + "Historial de pagos"
(siempre, salvo error). Mismo problema que `alumno/horario`: selector+banner-estado pueden
coexistir = 2 filas auto antes del fill.

Plan: agrupar selector + banner-de-estado en un wrapper único (mismo fix que `alumno/horario`),
historial-de-pagos como única celda `.bento-fill` en `--fill-screen-kpi`.

### `/alumno/pruebas-online` (`AlumnoPruebasOnlineComponent`)

Hero + banner con grid anidado de `bento-square` (stats) + banner con grid anidado de
`bento-wide` (lista de simuladores) — encaja bien como KPI-row + contenido.

Plan: `--fill-screen-kpi`: banner de stats=auto (fila KPI), banner de simuladores=fill.

### `/alumno/pagar` (`AlumnoPagarComponent`)

Stepper hand-rolled (no PrimeNG), 3 pasos: resumen de saldo, confirmación, pago Webpay —
contenido de cada paso es corto (cards de resumen, no formularios largos como matrícula).

**Posible reversión, verificar antes de tocar:** a diferencia de `matricula` (formularios
extensos por paso), acá el contenido por paso probablemente nunca produce overflow real →
podría calificar por el criterio #1 de `.claude/rules/visual-system.md` §"Cuándo NO aplica el
patrón" ("contenido corto sin overflow") en vez de necesitar el patrón full-height de
matrícula. **Primer paso: medir el alto real de cada uno de los 3 pasos.** Si nunca scrollea,
dejar la página como excepción y no tocar nada — documentar esa decisión en
`indices/APP-LIKE-ROLLOUT.md`.

## Checklist de cierre (rollout app-like, aplica a las 4)

- [ ] `force-compact` verificado con drawer abierto en las 3 que sí se toquen (pagar puede
      quedar exenta si se confirma la reversión)
- [ ] Sin `.spec.ts` nuevo obligatorio en ninguna (sin lógica de densidad nueva)
- [ ] `/verify` en 390×844, 1440×900 y 768 de alto, cada página que se toque

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas de las 4 páginas, sección "Alumno"

## Archivos involucrados

- `src/app/features/alumno/clases/alumno-clases.component.ts`
- `src/app/features/alumno/pagos/alumno-pagos.component.ts`
- `src/app/features/alumno/pruebas-online/alumno-pruebas-online.component.ts`
- `src/app/features/alumno/pagar/alumno-pagar.component.ts`
