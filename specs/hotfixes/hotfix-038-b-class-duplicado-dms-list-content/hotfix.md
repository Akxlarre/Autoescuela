# Hotfix: class duplicado en dms-list-content (case 'school')
> id: hotfix-038-b-class-duplicado-dms-list-content
> status: done
> closed: 2026-08-22 — cierre tardío (el auto-cierre de hotfix no corrió). Verificado en `dms-list-content.component.ts:474` — un solo atributo `class` con las utilities fusionadas (`w-10 h-10 rounded-lg ... bg-error-subtle text-error`).
> created: 2026-08-10

## Problema
En `dms-list-content.component.ts`, dentro del `@case ('school')`, el `<div>` wrapper
del ícono `file-text` tiene dos atributos `class="..."` en el mismo elemento HTML. En
HTML el segundo `class` pisa al primero, así que el div pierde
`w-10 h-10 rounded-lg flex items-center justify-center shrink-0` y queda solo con
`bg-error-subtle text-error` — la caja de 40x40 con bordes redondeados colapsa.
Encontrado fuera de scope durante fix-129-b (app-like rollout de esa página).

## Cambios
- **Archivo:** `src/app/shared/components/dms-list-content/dms-list-content.component.ts` — fusionar los dos atributos `class="..."` del div wrapper del ícono en uno solo.
