# Hotfix: Card del calendario de `/alumno/horario` deja hueco vacío grande en desktop

> id: hotfix-043-b-alumno-horario-calendario-hueco-vertical-desktop
> status: done
> closed: 2026-08-09
> created: 2026-08-09

## Problema

Reportado por el usuario revisando `/alumno/horario` en desktop (1440×900): la card del
calendario semanal es `.bento-fill` (ocupa el resto del viewport, ~600px+ de alto), pero su
contenido real (nav de semana + grilla de 7 días + leyenda) es corto — un alumno nunca tiene
muchas sesiones por semana (máximo 2 clases/semana en la práctica) — así que todo el contenido
queda pegado arriba (`flex flex-col`, sin `justify-content`) dejando un hueco vacío grande
abajo, permanente (no es un artefacto de datos de prueba: el contenido real de un alumno
siempre va a ser corto).

## Cambios

- **Archivo:** `src/app/features/alumno/horario/alumno-horario.component.ts` — la card del
  calendario (`class="horario-calendar-card bento-banner bento-fill card flex flex-col gap-4
  h-full"`) agrega `justify-center overflow-y-auto`: centra el bloque nav+grilla+leyenda
  verticalmente dentro del alto disponible en vez de dejarlo pegado arriba; `overflow-y-auto`
  es defensivo (si alguna semana excepcional tuviera más sesiones de las que caben, scrollea en
  vez de recortarse).
