# Fix: botones y títulos se recortan a mitad de palabra
> id: fix-003-i-textos-recortados-flex-truncate
> refs: ASG-b-025
> status: in_progress
> created: 2026-07-30

## Root Cause
[Heredado de ASG-b-025, a confirmar]: En la ficha de alumno (`/app/admin/alumnos/{id}`), los 6 botones de acción bajo la foto de perfil ("Reagendar Clases (2)", "Ver Contrato", "Carnet", etc.) se muestran cortados a mitad de palabra ("Reag...", "Ca...") sin puntos suspensivos ni tooltip — el texto completo SÍ está en el DOM. Causa raíz confirmada: son contenedores flex con un `<span class="truncate">` interno, pero el hijo flex no tiene `min-width: 0` (por defecto un ítem flex se niega a encogerse por debajo de su ancho de contenido), así que el truncado de Tailwind nunca se activa. Segunda instancia del mismo patrón: en el panel "Detalle de Instructor", el título de página "Instructores" se recorta a "Instruc...".

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio
- **Archivo:** `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — agregado `min-w-0` a los 3 `<span class="truncate">` que sostienen los 6 botones de acción: el del `@for (action of secondaryActions())` (cubre los 4 dinámicos: Reagendar/Contrato/Carnet/Certificado) + los 2 estáticos "Inasistencias" y "Ficha Técnica". El `<span>` es un ítem flex directo dentro de un `<button class="btn-secondary ... justify-center ...">` (flex container) — sin `min-w-0` el ítem se negaba a encoger por debajo de su ancho de contenido y el `truncate` de Tailwind nunca se activaba.
- **`src/app/features/admin/instructores/admin-instructores.component.ts` — sin cambios.** Investigado: el título "Instructores" se pasa vía `<app-section-hero title="Instructores">`, y en `SectionHeroComponent` el `<h1>` ya vive dentro de `<div class="min-w-0 flex-1">` (cadena `min-w-0` completa) y usa `line-clamp-2`, no `truncate` — no reproduje el corte a mitad de palabra descrito en el hallazgo original. Probablemente ya se corrigió en un hotfix posterior al audit (candidato: `hotfix-034-m-hero-slim-acciones-overflow-compact`). No se tocó el componente compartido sin una reproducción real, para no arriesgar una regresión en las decenas de páginas que usan `SectionHeroComponent`.

## Test de Regresión
- Fix CSS/Flexbox puro sin lógica — no aplica test automatizado (sin `computed()` ni ramas de decisión, per `.claude/rules/testing-tdd.md`).
- Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio, `ng build --configuration=development` exitoso, `npm run lint:arch` sin hallazgos nuevos, `admin-alumno-detalle.component.spec.ts` 12/12 verde (lógica no relacionada, sin regresión).
- Verificación visual pendiente: revisar en el navegador que los 6 botones bajo la foto de perfil en `/app/admin/alumnos/{id}` ahora truncan con `…` en vez de cortar la palabra a la mitad.
