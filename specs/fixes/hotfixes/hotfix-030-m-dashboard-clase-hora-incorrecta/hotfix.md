# Hotfix: Detalle de clase en Dashboard muestra hora incorrecta y sin hora de fin

## Problema
En `dashboard.component.ts` y `secretaria-dashboard.component.ts`, el método
`handleLiveClassAction()` (rama informativa, clases no-`pending`) construye el
`slot` para `AgendaSlotDetailDrawerComponent` con:

```ts
startTime: cls.scheduledAt.split('T')[1].substring(0, 5),
endTime: '',
```

Esto extrae la hora directamente del string ISO crudo (UTC), sin convertir a
zona horaria local (`America/Santiago`), a diferencia del panel
`live-classes-panel.component.ts` que sí usa
`new Date(isoString).toLocaleTimeString('es-CL', ...)`. Resultado: la card del
dashboard muestra la hora correcta (ej. 11:00) pero el drawer de detalle
muestra la hora UTC cruda (ej. 15:00). Además `endTime` queda vacío porque
nunca se calcula, mostrando "11:00 – " en el drawer.

## Fix
- Mover `addMinutesToTime()` (ya usado en `agenda.facade.ts`) a
  `core/utils/date.utils.ts` como util exportado compartido.
- En ambos `handleLiveClassAction()`, usar `to24hTime(cls.scheduledAt)` (ya
  importado, usado en la rama `pending`) para `startTime`, y calcular
  `endTime` con `addMinutesToTime(startTime, 45)` (duración fija de una
  sesión práctica de Clase B).
- Actualizar `agenda.facade.ts` para importar el util compartido en lugar de
  su copia local.

## AC
- Al hacer clic en una clase (completada o agendada) desde "Clases Actuales"
  del Dashboard (admin y secretaria), la hora mostrada en el drawer de
  detalle coincide con la hora mostrada en la card del panel.
- El drawer de detalle muestra hora de inicio Y hora de fin (inicio + 45 min).

## Cierre
- `addMinutesToTime()` movido a `core/utils/date.utils.ts` (export compartido).
- `agenda.facade.ts` actualizado para usar el util compartido (elimina duplicado local).
- `dashboard.component.ts` y `secretaria-dashboard.component.ts`: `startTime` ahora usa `to24hTime()` (conversión a `America/Santiago`) en vez de `split('T')[1]` sobre el string ISO crudo; `endTime` se calcula con `addMinutesToTime(startTime, 45)`.
- `tsc --noEmit` limpio.
