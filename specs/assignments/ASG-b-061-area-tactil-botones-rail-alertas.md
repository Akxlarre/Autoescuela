# Asignación ASG-b-061 — Área táctil de los botones del rail de alertas por debajo de 44×44px

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-02
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-02
> **resulting_track:** fix-095-b-area-tactil-rail-alertas

---

## Contexto / Objetivo

Los botones "Recordar" / "Eliminar" / "Reactivar" del rail de alertas de Asistencia B
(`asistencia-clase-b-content.component.ts`, agregados en `fix-093-b`) usan el modificador
`btn-sm` del DS: `padding: 0.375rem 0.75rem` + `font-size: var(--text-xs)`. Medido en vivo con
`/verify` a 375px de ancho: **71×30px y 79×32px**.

**Corrección de encuadre respecto a cómo se levantó esto la primera vez:** ese tamaño **ya
cumple** WCAG 2.5.8 (Target Size Minimum, nivel AA, WCAG 2.2) — el piso real es 24×24px. Lo
que no cumple es 44×44px, que es guía de Apple/Google HIG y WCAG 2.5.5 (Target Size Enhanced,
nivel **AAA**, no obligatorio). No es una falla de cumplimiento, es una mejora de comodidad
táctil — el rail se usa en el taller, probablemente desde el celular, con alumnos con 10-12
faltas esperando una acción rápida.

## Alcance sugerido

- **No agrandar el botón visualmente.** `btn-sm` en esta franja es una decisión de diseño
  deliberada (`fix-086-m`, ASG-b-008): la información va densa a propósito. Agrandar el tamaño
  visual reabre esa discusión y afecta ~44 instancias en 3 componentes hermanos
  (`asistencia-clase-b-content`, `certificacion-clase-b-content`,
  `certificacion-profesional-content`).
- **Extender el área de toque de forma invisible** hasta 44×44px vía pseudo-elemento
  (`::before` con `min-height`/`min-width` + posicionamiento absoluto centrado, sin afectar el
  flujo del layout). Patrón estándar, sin precedente en este repo — `grep -rn "pointer: coarse"
  src/` no encuentra nada reusable.
- Escopar el cambio a los 3 botones del rail de alertas (`removeSchedule`, `reactivateSchedule`,
  `sendReminder`), no a `btn-sm` global — mantiene el blast radius en un componente.
- Verificar con `/verify` que el hit-area crece sin que el botón visualmente cambie de tamaño,
  y que no se solapa con las filas vecinas del rail (gap actual: `gap-1.5` entre alertas).

## Referencias

- `fix-093-b-boton-recordar-alertas-asistencia-b` — donde se agregaron estos botones.
- `fix-086-m-btn-sm-arch16-restante` — decisión de diseño de `btn-sm` como tamaño compacto
  deliberado para esta franja de componentes.
- WCAG 2.5.8 (AA, mínimo real: 24×24px) vs WCAG 2.5.5 (AAA, 44×44px) — no confundir ambos al
  redactar el AC de este fix.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`

## Notas para quien la reclame

- Prioridad P2 (no P1): es mejora de usabilidad, no incumplimiento de accesibilidad. No
  bloquea nada.
- Si en el camino se decide que vale la pena para los ~44 usos hermanos de `btn-sm`, coordinar
  aparte — no expandir el scope de este fix sin decisión explícita, dado el precedente de
  `fix-086-m` de tratar el tamaño compacto como decisión consciente.
