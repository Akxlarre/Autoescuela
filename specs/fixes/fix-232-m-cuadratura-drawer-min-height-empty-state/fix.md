# Fix: Cuadratura Diaria — empty-state de 200px fijo hace scrollear la página con el drawer abierto
> id: fix-232-m-cuadratura-drawer-min-height-empty-state
> refs: fix-230-m, fix-231-m
> status: done
> closed: 2026-08-31
> created: 2026-08-31

## Root Cause
En `cuadratura-content.component.ts`, el empty-state de "Registro de Ingresos" y "Registro de
Egresos" usa `min-h-50` (200px) de forma incondicional, con el comentario explícito
"caja de ~200px cuando la card es de alto natural (drawer abierto)" (fix-230-m). Esa asunción
resultó incorrecta: medido en el navegador con el drawer de Arqueo abierto (viewport 1280×800),
la card de Ingresos vacía mide 481px (top 406 → bottom 887) — ya excede los 800px de viewport
por sí sola — y la de Egresos (911 → 1392) queda completamente fuera de la vista. El `main`
angostado por el drawer saca ambas cards del modo fill-screen (correcto, ver fix-230-m/231-m),
pero el `min-h-50` fijo sigue reservando el mismo alto generoso pensado para cuando el
`.bento-fill` mide "el resto del viewport" (500px+) en modo fill-screen — no tiene sentido en
modo compacto, donde no sobra ese espacio. Resultado: con caja vacía y drawer abierto, la
página fuerza scroll para ver contenido que debería caber sin problema — la asimetría/corte que
el dueño señaló en el demo del 2026-08-31 tras cerrarse fix-231-m.

## ACs Afectados
Ninguno — fix autónomo (hallado en verificación visual de fix-231-m).
- AC-1: Con el drawer de Arqueo/Cierre abierto y ambas listas vacías, los paneles de Ingresos
  y Egresos usan un empty-state compacto (no el `min-h-50` de modo fill-screen), de forma que
  ambos paneles + la franja de KPIs quepan razonablemente en un viewport de laptop estándar
  sin depender de scroll para ver el estado vacío.
- AC-2: Sin drawer abierto (modo fill-screen normal), el empty-state centrado de 200px+ se
  mantiene sin cambios — el fix es exclusivo del modo compacto.

## Cambio
- **Archivo:** `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts`
- **Qué cambia:** el `min-h-50` de ambos empty-states pasa a ser condicional —
  `[class.min-h-50]="!isDrawerOpen()"` + un mínimo compacto bajo (ej. sin altura forzada,
  solo el padding natural de `app-empty-state`) cuando `isDrawerOpen()` es `true`.

## Test de Regresión
- Verificación visual con Playwright (`/verify`): abrir Arqueo y Cierre con Ingresos y Egresos
  vacíos en viewport 1280×800, confirmar que ambos paneles + KPIs son visibles sin necesitar
  scroll (o con mucho menos scroll que antes). Confirmar que sin drawer abierto el empty-state
  fill-screen no cambió.
