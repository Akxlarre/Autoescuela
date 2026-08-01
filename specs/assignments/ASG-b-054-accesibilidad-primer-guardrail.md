# Asignación ASG-b-054 — Accesibilidad: 94 botones sin nombre accesible + foco en menús + primer guardrail a11y

> **status:** reclamada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-07-31
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-07-31
> **resulting_track:** fix-079-b-accesibilidad-nombres-y-foco

---

## Contexto / Objetivo

**Las prioridades de enforcement del DS están invertidas.** Hoy hay 8 reglas ARCH
automatizadas vigilando higiene de color y clases muertas, y **cero** vigilando
accesibilidad. El resultado es que la deuda de color está medida al dígito y la de a11y
estaba estimada en "2 archivos conocidos, puede haber más".

Auditado hoy (2026-07-31), el número real:

- **94 botones icon-only sin `aria-label`, en 41 archivos.** Heurístico conservador:
  `<button>` que contiene un `<app-icon>`, **ningún** texto visible ni interpolación, y
  **ningún** `aria-label`. Para un lector de pantalla esos 94 botones se anuncian como
  "botón", sin más. El backlog registraba 2.
- **`section-hero.component.ts` — el menú desplegable no tiene manejo de foco**: solo
  cierra por click-outside. No cierra con `Escape`, no devuelve el foco al trigger al
  cerrar, no lleva el foco al primer ítem al abrir. Es el menú de acciones de ~50 páginas,
  o sea el control de navegación más reutilizado de la app.

## Alcance sugerido

1. **Poner nombre accesible a los 94 botones.** No es mecánico como los badges: cada uno
   necesita un nombre que describa *la acción*, no el ícono ("Eliminar alumno", no
   "Basurero"). El script de auditoría que produjo la lista está en el historial de esta
   sesión; se re-genera fácil (ver "Cómo reproducir el conteo" abajo).
   > ⚠️ **`pTooltip` no cuenta como nombre accesible.** Varios de los 94 tienen tooltip
   > de PrimeNG — eso resuelve el descubrimiento visual con mouse, no el anuncio a un
   > lector de pantalla ni la navegación por teclado. Si el botón ya tiene tooltip, lo más
   > probable es que el texto del tooltip sea exactamente el `aria-label` correcto.
2. **Arreglar el foco del menú de `section-hero`**: `Escape` cierra, foco al primer ítem
   al abrir, foco de vuelta al trigger al cerrar. Es el patrón estándar de menu button
   (WAI-ARIA). Blast radius alto pero comportamiento aditivo.
3. **Primer guardrail a11y en `lint:arch`** — como *ratchet* con baseline, igual que
   ARCH-15/16/17, no como error duro (si no, no pasa nunca). Regla mínima viable:
   `<button>` con ícono y sin texto ni `aria-label` → violación. Baseline 94, y que solo
   falle si el número **sube**.

## Por qué vale la pena

Un guardrail a11y aunque sea de una sola regla cambia el default del equipo (y de los
agentes): hoy nada impide que el botón 95 entre igual. Y a diferencia del resto del
backlog de DS, esto no es estética — es gente que no puede usar la app.

## Cómo reproducir el conteo

```
git ls-files "src/app/**/*.ts"
```

Para cada archivo, capturar bloques `<button ...>…</button>`, y contar los que:
cumplen `/<app-icon/`, **no** cumplen `/aria-label/`, y cuyo contenido con tags removidos
e interpolaciones `{{ }}` sustituidas por texto queda vacío. Resultado esperado hoy:
`94 botones / 41 archivos`.

## Archivos involucrados (parcial — los 25 primeros de 41)

- `features/admin/alumno-detalle/components/ficha-tecnica/admin-ficha-tecnica.component.ts` (2)
- `features/admin/alumno-detalle/reprogramar-clase-drawer/admin-reprogramar-clase-drawer.component.ts` (2)
- `features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts` (4)
- `features/admin/alumnos/pre-inscritos/admin-pre-inscrito-drawer.component.ts` (2)
- `features/admin/certificacion/drawers/historial-emisiones-drawer.component.ts`
- `features/admin/configuracion-horario/configurador-horarios-drawer.component.ts`
- `features/admin/configuracion-web/tabs/hero-tab.component.ts` (2)
- `features/admin/contabilidad-anticipos/admin-contabilidad-anticipos.component.ts` (2)
- `features/admin/contabilidad-cursos/admin-contabilidad-cursos.component.ts` (2)
- `features/admin/contabilidad-cursos/admin-curso-singular-inscribir-drawer.component.ts`
- `features/admin/documentos/dms-instructor-docs-drawer/dms-instructor-docs-drawer.component.ts`
- `features/admin/documentos/dms-student-docs-drawer/dms-student-docs-drawer.component.ts`
- `features/admin/flota/vehicle-documents-drawer/vehicle-documents-drawer.component.ts`
- `features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.ts` (2)
- `features/admin/instructores/admin-instructor-crear-drawer.component.ts`
- `shared/components/section-hero/section-hero.component.ts` — punto 2

## Referencias

- `docs/BACKLOG-DEUDA-TECNICA.md` §"Fase 5 — Accesibilidad + limpieza puntual" — esta
  asignación la reemplaza y le pone números.
- `.claude/rules/visual-system.md` — el checklist del DS menciona contraste WCAG AA pero
  no nombres accesibles ni foco.
- `scripts/lib/class-discipline.baseline.json` — formato de baseline de los ratchets.

## Notas para quien la reclame

- Los 3 puntos son **independientes**: se pueden cerrar en commits separados y el track
  sigue teniendo sentido si solo se hace 1 y 3.
- El punto 2 toca un componente con ~50 páginas de blast radius (mismo caso que
  fix-043-m con el chip de `section-hero`) → verificar con Playwright real, no solo build.
- Al terminar, actualizar el checklist de `.claude/rules/visual-system.md` para que el
  nombre accesible sea parte del contrato de "componente entregado".
