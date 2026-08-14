# Fix: Day Tab Strip mobile — evitar píldoras cortadas en el borde
> id: fix-180-m-day-strip-mobile-sin-scroll
> refs: fix-179-m-mi-horario-mobile-timeline (agregó la nav de semana; este fix resuelve un
> efecto colateral visual reportado por el dueño tras QA de ese cambio)
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
El day tab strip de `DailyScheduleTimelineComponent` (mobile) sigue el patrón de scroll
horizontal (`overflow-x-auto` + píldoras `min-w-[64px]` con `shrink-0`), igual que el resto de
tiras horizontales del proyecto (tabs, etc.). En anchos de mobile angostos esto corta visualmente
la última píldora a la mitad en el borde del viewport — aunque el usuario puede deslizar para ver
el resto, el corte se ve como un bug de layout, no como una afordancia de scroll intencional.

Como ya son solo 7 píldoras (Lun-Dom) y el dato relevante (día + número) es compacto, no hace
falta scroll: caben las 7 en el ancho de un mobile real si se comprimen un poco y se sacan los
botones de navegación de semana de la misma fila (así las píldoras usan el 100% del ancho
disponible en vez de competir con los chevrons).

## ACs Afectados
Ninguno — fix autónomo (continuación visual de fix-179-m).

## Cambio
- **Archivo:** `src/app/shared/components/daily-schedule-timeline/daily-schedule-timeline.component.ts`
  - **Qué cambia:** los chevrons prev/next semana quedan flanqueando el day tab strip (izquierda
    y derecha de las píldoras, misma fila — ajuste pedido por el dueño tras ver la primera
    versión con los chevrons arriba); el strip deja de tener `overflow-x-auto`/`min-w` y pasa a
    `flex` con píldoras `flex-1` (reparto equitativo del ancho) dentro de un contenedor
    `flex-1 min-w-0` entre ambos chevrons. Tipografía del número compactada (`text-2xl` →
    `text-lg`) y tracking del label aflojado para que quepa en columnas angostas. Además se
    excluye **Domingo** del strip (regla de negocio: nunca hay clases ese día — pedido explícito
    del dueño), dejando 6 columnas en vez de 7 y dando aún más aire a cada píldora.
- **Archivo:** `src/app/core/utils/daily-schedule-timeline.utils.ts`
  - **Qué cambia:** nueva función pura `filterVisibleWeekDays` (excluye "Domingo") para mantener
    la lógica testeable sin TestBed, mismo patrón que `filterRemainingBlocks`/
    `shouldShowEmptyDayState` de fix-179-m.

## Test de Regresión
- `core/utils/daily-schedule-timeline.utils.spec.ts > filterVisibleWeekDays > excludes Domingo — never has classes` ✓
- `core/utils/daily-schedule-timeline.utils.spec.ts > filterVisibleWeekDays > returns an empty array when weekDays is undefined` ✓
El resto del cambio es layout/CSS puro (posición de los chevrons, tamaños) — no aplica test
unitario adicional. Verificación visual pendiente: `/verify` (Playwright) en viewport mobile
angosto (375px y 360px) confirmando que las 6 píldoras (Lun-Sáb) son visibles completas sin
scroll horizontal y los chevrons quedan a los costados.
