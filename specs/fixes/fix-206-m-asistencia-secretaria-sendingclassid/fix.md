# Fix: Secretaria no pasa [sendingClassId] → el envío de Zoom permite doble envío
> id: fix-206-m-asistencia-secretaria-sendingclassid
> refs: —
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause
`secretaria/asistencia` no le pasa el input `[sendingClassId]` a
`AsistenciaClaseBContentComponent`, que lo reenvía a `CiclosTeoricosContentComponent`. Admin sí
lo pasa. Ese único input alimenta **tres** comportamientos del envío de Zoom, y los tres se
degradan del lado de secretaria (el input cae a su default `null`):

1. `ciclos-teoricos-content.component.ts:288` — el botón "Enviar a N" nunca muestra su spinner.
2. `ciclos-teoricos-content.component.ts:469,524,532` — el botón nunca queda `[disabled]`
   durante el envío, así que **se puede disparar el envío dos veces**.
3. `ciclos-teoricos-content.component.ts:713` — el `effect` que cierra el panel de destinatarios
   compara `sendingClassId` con `previousSendingClassId`; con el valor siempre en `null` la
   condición nunca se cumple y el panel queda abierto tras enviar.

## ACs Afectados
Ninguno — fix autónomo. Detectado en la auditoría de paridad admin/secretaria (2026-08-24).

## Cambio
- **Archivo:** `src/app/features/secretaria/asistencia/secretaria-asistencia.component.ts`
  **Qué cambia:** agrega `[sendingClassId]="ciclos.sendingClassId()"` al
  `<app-asistencia-clase-b-content>`, igual que su par de admin.

## Test de Regresión
- `npx ng build` sin errores.
- Verificación de paridad: ambos roles pasan `[sendingClassId]` al content compartido (grep).
- Verificación manual: en secretaria, Asistencia → Ciclos Teóricos → enviar Zoom muestra
  spinner, deja el botón deshabilitado durante el envío y cierra el panel al terminar.

- ✅ **Verificado visualmente por el dueño en el navegador (2026-08-24).**
