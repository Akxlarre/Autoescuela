# Fix: Pagos de secretaria aplica solo la mitad del modo compacto y la fila se desarma
> id: fix-209-m-pagos-secretaria-modo-compacto-incompleto
> refs: —
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause
El modo compacto de la tabla de deudores (activo mientras hay un drawer abierto) son **dos
mitades que tienen que ir juntas**:

1. La regla que baja la grilla de 6 a 3 columnas:
   `.deudores-compact .deudores-row { grid-template-columns: minmax(0,1fr) auto auto !important }`
2. Las clases `.dc-rut / .dc-total / .dc-pagado` en las celdas sobrantes, más la regla que las
   oculta: `.deudores-compact .dc-* { display: none !important }`

`secretaria/pagos` se quedó con **la primera mitad sola**: aplica
`[class.deudores-compact]="layoutDrawer.isOpen()"` y tiene la regla de 3 columnas, pero ni las
clases en el markup ni la regla que las esconde. Resultado: al abrir cualquier drawer, seis
celdas se meten en tres columnas y la fila se desarma. Admin tiene las dos mitades.

Es el segundo síntoma del mismo problema de fondo que fix-208-m: `pagos` es el otro par que
**duplica su template** (638 vs 566 líneas) en vez de compartirlo.

## ACs Afectados
Ninguno — fix autónomo. Detectado en la auditoría de paridad admin/secretaria (2026-08-24).

## Cambio
- **Archivo:** `src/app/features/secretaria/pagos/secretaria-pagos.component.ts`
  **Qué cambia:** agrega las clases `dc-rut` / `dc-total` / `dc-pagado` a las 3 celdas de
  cabecera y a las 3 celdas de fila correspondientes, y la regla
  `.deudores-compact .dc-* { display: none !important }`, replicando exactamente el modo
  compacto de admin.

## Nota — por qué no se extrajo a contenido compartido
A diferencia de `instructores` (fix-208-m), acá reutilizar no es más barato: la página de
secretaria **sí difiere de la de admin por rol** (usa `AuthFacade.currentUser().branchId` en vez
de `BranchFacade`, y su modal de reporte no muestra el selector de sede), así que no se puede
resolver con un re-export de 10 líneas. Extraerla a un `*-content` compartido son ~640 líneas de
refactor para corregir **un** hallazgo que se arregla con 4 ediciones puntuales. La extracción
sigue siendo deseable como refactor propio para cerrar la clase de bug; queda registrada en
`docs/BACKLOG-DEUDA-TECNICA.md`.

## Test de Regresión
- `npx ng build` sin errores.
- `npm run test:ci` — el spec de `SecretariaPagosComponent` (151 líneas) queda verde.
- Verificación de paridad: ambos roles declaran las 3 clases `dc-*` y la regla que las oculta.
- Verificación manual: en secretaria, Pagos → abrir cualquier drawer → la fila de deudores
  queda en 3 columnas legibles (Alumno / Saldo / Acciones), sin celdas desbordadas.

- ✅ **Verificado visualmente por el dueño en el navegador (2026-08-24).**
