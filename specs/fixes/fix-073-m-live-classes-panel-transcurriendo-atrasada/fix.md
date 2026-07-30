---
# Fix: "Transcurriendo" se muestra para clases agendadas que aún no se inician
> id: fix-073-m-live-classes-panel-transcurriendo-atrasada
> refs: —
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

`LiveClassesPanelComponent.getRelativeTime()` (`live-classes-panel.component.ts:315-329`) calcula el
texto relativo comparando `scheduledAt` contra `now()` cuando el `status` no es `completed` ni
`in_progress`. Si la hora agendada ya pasó (`diffMs <= 0`), devuelve `'Transcurriendo'`
incondicionalmente — **sin verificar que la clase realmente se haya iniciado**
(`status === 'in_progress'`, seteado solo por `AsistenciaClaseBFacade.iniciarClase()` cuando alguien
hace clic en "Comenzar Clase").

Resultado: una clase `pending` cuya hora agendada ya pasó, pero que nadie ha iniciado todavía, se
etiqueta igual que una clase realmente en curso ("Transcurriendo"), aunque el estado real del
negocio es "debería haber empezado pero no ha empezado" — un estado distinto que el usuario necesita
distinguir (para saber si el instructor está atrasado en iniciarla).

## ACs Afectados

- Ninguno — fix autónomo, sin spec asociada.

## Cambio

- **Archivo:** `src/app/shared/components/live-classes-panel/live-classes-panel.component.ts`
  - `getRelativeTime(isoString, status)`: cuando `status !== 'in_progress'` y `diffMs <= 0`
    (hora agendada ya pasada pero la clase sigue `pending`), devolver `'Atrasada'` en vez de
    `'Transcurriendo'`. Los otros 3 casos quedan igual:
    - `status === 'completed'` → `'Concluida'`
    - `status === 'in_progress'` → `'Transcurriendo'`
    - `status === 'pending'` y hora aún no llega → `'En X min'` / `'En X h'`

## Test de Regresión

- Nuevo `live-classes-panel.component.spec.ts > getRelativeTime`:
  - `clase pending con hora futura → "En X min"/"En X h"` ✓
  - `clase pending con hora ya pasada (no iniciada) → "Atrasada"` ✓
  - `clase in_progress → "Transcurriendo" (sin importar la hora)` ✓
  - `clase completed → "Concluida"` ✓
- Suite completa (`npm run test:ci`): 1460/1460 en verde (8/8 en el nuevo
  `live-classes-panel.component.spec.ts`).
- `npm run lint:arch`: 0 errores, 165 advertencias (2 pre-existentes en este archivo — tamaño de
  clase y un token muerto — ninguna nueva).
- Verificación visual: NO ejecutada con Playwright MCP en esta sesión — el usuario (Matías) decidirá
  si la corre en `ng serve`.
