---
# Fix: "Atrasada" repite la misma palabra dos veces (izquierda y derecha)
> id: fix-074-m-live-classes-panel-atrasada-elapsed
> refs: fix-073-m-live-classes-panel-transcurriendo-atrasada
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

fix-073 corrigió que una clase `pending` con hora ya vencida mostrara "Transcurriendo" (correcto
solo para `in_progress`), reemplazándolo por "Atrasada" en `getRelativeTime()`. Pero el label de la
izquierda (`statusLabel()`) sigue mostrando "Por Iniciar" para todo status `pending` sin importar la
hora — quedando una tarjeta con "POR INICIAR" a la izquierda y "Atrasada" a la derecha
simultáneamente. El usuario (Matías) lo señaló como confuso/redundante tras ver el resultado en
`ng serve`.

## ACs Afectados

- Ninguno — fix autónomo, sin spec asociada.

## Cambio

- **Archivo:** `src/app/shared/components/live-classes-panel/live-classes-panel.component.ts`
  - `statusLabel()` se mantiene igual (decisión del usuario: la izquierda sigue mostrando "Por
    Iniciar" como estado bruto de BD, sin lógica de tiempo).
  - `getRelativeTime()`: cuando `status !== 'in_progress'` y `diffMs <= 0` (pending atrasada), en vez
    de devolver el string fijo `'Atrasada'`, devolver el tiempo transcurrido: `Hace X min` / `Hace X h`
    (mismo formato que el caso futuro `En X min`/`En X h`, pero con signo invertido). Los otros 3
    casos quedan igual (`Concluida`, `Transcurriendo`, `En X min`/`En X h`).

## Test de Regresión

- `live-classes-panel.component.spec.ts > getRelativeTime (fix-073)`:
  - actualizar el test `clase pending con hora ya pasada (no iniciada) → "Atrasada"` para esperar
    `"Hace 10 min"` en vez de `"Atrasada"`.
  - agregar caso `clase pending con hora pasada hace más de 1h → "Hace X h"`.
- Suite completa (`npm run test:ci`): 1461/1461 en verde (9/9 en `live-classes-panel.component.spec.ts`).
- `npm run lint:arch`: 0 errores, 165 advertencias (mismas pre-existentes de fix-073, ninguna nueva).
- Verificación visual: NO ejecutada con Playwright MCP en esta sesión — el usuario (Matías) decidirá
  si la corre en `ng serve`.
