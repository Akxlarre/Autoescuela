# Hotfix: DMS — hueco vertical bajo tabs (falta rows-fit) + tabs deben wrapear, no scroll horizontal
> id: hotfix-047-b-dms-gap-vertical-y-tabs-wrap
> status: done
> closed: 2026-08-10
> created: 2026-08-10

## Nota de troubleshooting (dev environment, no del código)

El código compiló correctamente desde el primer intento (confirmado vía `ng build` standalone:
el bundle de producción sí contenía `wrap` en el chunk de `TabsComponent`). El `ng serve` local
del owner no reflejaba el cambio pese a varios restarts + `ng cache clean` porque un proceso
`node.exe` zombie (PID 4796, arrancado horas antes) seguía escuchando en el puerto 4200 sin que
los restarts lo mataran realmente (típico en Windows cuando Ctrl+C no mata bien el proceso
hijo). Se mató el proceso manualmente (`Stop-Process -Id 4796 -Force`) y tras levantar `ng
serve` de nuevo (PID nuevo, confirmado por `StartTime`), el cambio se reflejó de inmediato.

## Problema

El owner marcó un hueco vacío grande entre las tabs y la card "Alumnos con documentos", y
pidió que las tabs se reacomoden en vez de scrollear horizontalmente.

1. **Hueco vertical:** medido en vivo — la fila de tabs mide 120px pero el contenido real
   (píldoras segmentadas) mide solo 40px, dejando 80px vacíos. Causa: `--bento-row-min: 120px`
   (piso del sistema bento para que `.bento-square` luzca cuadrado) se aplica también a filas
   `.bento-banner` cuando el contenedor está bajo `lg` (`--fill-screen-kpi` no está activo ahí,
   así que las filas caen al comportamiento base `grid-auto-rows: minmax(120px, auto)`). Es
   EXACTAMENTE el mismo bug que `alumno-horario.component.ts` ya resolvió en fix-127-b
   agregando `bento-grid--rows-fit` junto a `--fill-screen-kpi` — a `dms-list-content` (fix-129-b)
   se me olvidó agregarle ese segundo modificador.
2. **Tabs con scroll horizontal:** `variant="segmented"` de `TabsComponent` usa
   `overflow-x-auto` como fallback cuando las tabs no caben. El owner pidió que en vez de
   scrollear, las tabs bajen de línea (wrap).

## Cambios

- **Archivo:** `src/app/shared/components/dms-list-content/dms-list-content.component.ts`
  - Root `bento-grid bento-grid--fill-screen-kpi` → agrega `bento-grid--rows-fit` (mismo combo
    que `alumno-horario.component.ts`).
  - `<app-tabs ... variant="segmented">` → agrega `[wrap]="true"`.
- **Archivo:** `src/app/shared/components/tabs/tabs.component.ts`
  - Nuevo input opcional `wrap = input<boolean>(false)` (default `false` — no cambia el
    comportamiento de ningún consumidor existente de `variant="segmented"`, ej.
    `alumno-horario`).
  - Contenedor de `variant="segmented"`: cuando `wrap()` es `true`, `flex-wrap: wrap` en vez de
    `overflow-x-auto` + scrollbar oculta.
