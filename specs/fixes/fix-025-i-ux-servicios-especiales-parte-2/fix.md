# Fix: UX Servicios Especiales parte 2 — drawer prellenado, N° boleta, cobro inmediato
> id: fix-025-i-ux-servicios-especiales-parte-2
> refs: —
> status: done
> created: 2026-08-13

## Root Cause
Lista de pendientes de UX dejada por el usuario tras cerrar fix-022-i/023-i/024-i (ver
`indices/DOMAIN-GOTCHAS.md` no aplica — son 4 gaps de UX/producto, no bugs de lógica):

1. `ServiciosEspecialesFacade.openRegistrarVentaDrawer(servicio?)` ya setea `_selectedServicio`,
   pero `RegistrarVentaDrawerComponent` nunca lo lee — el drawer siempre abre vacío aunque el
   usuario haya venido de la tarjeta "Vender" de un servicio específico.
2. `special_service_sales` no tiene forma de capturar N° de boleta — el ingreso en Caja Diaria
   siempre muestra `nBoleta: null` para servicios especiales.
3. `mapSpecialServiceSaleToIngreso()` fuerza el monto al bucket `claseB` (efectivo) — un
   servicio especial no es una clase de manejo, el usuario quiere que vaya en `otros`.
4. El toggle "Registrar como ya cobrado" del drawer y las columnas "Estado"/"Cobro" del
   historial son vestigiales: desde fix-023-i, `estado` y `cobrado` se derivan ambos de la
   misma columna `paid` — son 100% redundantes. Decisión de negocio confirmada con el usuario
   (2026-08-13): toda venta de Servicio Especial se cobra al momento de la venta — no existe
   más un estado "pendiente" para este módulo.

## Decisiones de negocio (confirmadas con el usuario, 2026-08-13)
1. El drawer de "Vender" prellena `servicioId` (y por ende `precio`, ya derivado por el
   `valueChanges` existente) cuando `facade.selectedServicio()` no es null al montar.
2. Nuevo campo opcional "N° de boleta" en el drawer de venta → nueva columna
   `special_service_sales.document_number` (mismo patrón que `payments.document_number`) →
   se propaga a `IngresoRow.nBoleta` en Caja Diaria.
3. `mapSpecialServiceSaleToIngreso()` cambia el bucket de `claseB` a `otros`.
4. `registrarVenta()` ya NO acepta `cobrado` como opción — toda venta se inserta directo con
   `paid: true, status: 'completed'`. Se elimina el toggle del drawer. Se eliminan las columnas
   "Estado" y "Cobro" del historial de ventas (y el botón "Cobrar", que deja de tener sentido).
   No se agrega nada nuevo en su lugar — las columnas restantes (Cliente, Servicio, Monto,
   Fecha, Acciones) se reparten el espacio.

## ACs Afectados
Ninguno — fix autónomo (evolución de decisiones ya tomadas en fix-023-i).

## Migración SQL
Dar en chat primero (el usuario la corre manualmente), luego persistir en
`supabase/migrations/` como archivo numerado (convención confirmada en fix-024-i).

```sql
ALTER TABLE special_service_sales ADD COLUMN IF NOT EXISTS document_number TEXT;
```

## Cambio
1. `RegistrarVentaDrawerComponent`: lee `facade.selectedServicio()` en el constructor/effect y
   hace `patchValue({ servicioId })` si no es null — reutiliza el `valueChanges` existente para
   que el precio se autocomplete igual que si el usuario lo eligiera a mano. Nuevo campo
   `documentNumber` (opcional) en el form. Elimina el control `cobrado` y su bloque del template.
2. `ServiciosEspecialesFacade.registrarVenta()`: acepta `documentNumber?: string`, lo inserta en
   `document_number`; ya no recibe `cobrado` — siempre inserta `paid: true, status: 'completed'`.
3. `CuadraturaFacade`: `mapSpecialServiceSaleToIngreso()` — bucket `otros` en vez de `claseB`,
   `nBoleta: s.documentNumber ?? null`. `fetchSpecialServiceSales()` selecciona `document_number`
   también.
4. `servicios-especiales-content.component.ts`: quita columnas "Estado" y "Cobro" de la tabla de
   historial (y el output `cobroRegistrado` que ya no se usa desde esta tabla — revisar si algún
   Smart Component lo sigue consumiendo antes de borrar el wiring completo).
5. `VentaServicio` (ui model): revisar si `estado`/`cobrado` siguen usándose en algún otro punto
   (KPIs de "Pend. de cobro") antes de removerlos del modelo — si los KPIs los necesitan, se
   quedan en el modelo pero fuera de la tabla visual.

## Test de Regresión
- `registrarVenta()` sin `cobrado` en el payload → inserta `paid: true, status: 'completed'`
  siempre.
- `registrarVenta({ documentNumber: 'B-123' })` → inserta `document_number: 'B-123'`.
- `mapSpecialServiceSaleToIngreso()` → bucket `otros`, `claseB: 0`; `nBoleta` refleja
  `documentNumber`.
- Drawer: `selectedServicio` no-null al montar → `servicioId` y `precio` prellenados.
- `/verify` — abrir "Vender" desde una tarjeta específica confirma prellenado visual; ingreso en
  Caja Diaria aparece en columna "Otros" con el N° de boleta ingresado; tabla de historial sin
  columnas Estado/Cobro, sin quedar rota visualmente.

## Resultado
`npm run test:ci`: 2087/2092 (5 skipped, pre-existentes). `npm run lint:arch`: 0 errores.
`npx ng build`: limpio (solo warning de bundle budget, pre-existente).

**Bug adicional descubierto y corregido durante QA (confirmado con el usuario, mismo archivo):**
`RegistrarVentaDrawerComponent` comparaba `String(s.id) === idStr` en el `valueChanges` de
`servicioId` para autocompletar el precio. El `p-select` con `optionValue="value"` entrega el
id como `number` al seleccionarse a mano (no como string), así que esa comparación siempre
fallaba en selección manual — el precio nunca se autocompletaba salvo cuando el prellenado de
este mismo fix pasaba explícitamente un string. Corregido a `s.id === Number(id)`.

`/verify` (Playwright, admin, `/app/admin/servicios-especiales` + `/app/admin/contabilidad/cuadratura`):
- "Vender" desde una tarjeta específica (Psicotecnico) → drawer abre con `servicioId` y
  `precio` ($20.000) ya prellenados.
- Selección manual del servicio en el drawer genérico → precio también se autocompleta
  (verificado el fix del bug de tipos).
- RUT autocompleta DV correctamente (comportamiento preexistente, sigue intacto).
- Historial de Ventas: tabla sin columnas "Estado"/"Cobro", sin botón "Cobrar" — solo Cliente,
  Servicio, Monto, Fecha, Acciones. Vista mobile también actualizada (solo ícono borrar,
  alineado a la derecha).
- Venta de prueba con N° de boleta "B-9001" registrada → `POST special_service_sales` 201 tras
  correr la migración `20260813070000` (el primer intento falló con `PGRST204`, columna
  faltante, hasta que el usuario corrió la migración).
- Caja Diaria: el ingreso apareció con N° Boleta "B-9001", monto en columna "Otros" (no "Clase
  B"), Total Día correcto.
- Venta y su ingreso en Caja Diaria limpiados tras la verificación (no quedan datos de prueba).
