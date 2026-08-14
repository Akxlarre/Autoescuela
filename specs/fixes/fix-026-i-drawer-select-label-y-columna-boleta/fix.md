# Fix: Drawer no muestra el servicio prellenado + falta columna N° Boleta en historial
> id: fix-026-i-drawer-select-label-y-columna-boleta
> refs: fix-025-i-ux-servicios-especiales-parte-2
> status: done
> created: 2026-08-14

## Root Cause
QA visual de fix-025-i (screenshots del usuario) detectó 2 gaps:

1. Al abrir el drawer desde "Vender" en una tarjeta específica, el Monto se prellena
   correctamente ($20.000) pero el combobox "Servicio" sigue mostrando el placeholder
   "Seleccionar servicio..." en vez de la etiqueta del servicio. Causa: el prellenado
   (`RegistrarVentaDrawerComponent` constructor, fix-025-i) hace
   `patchValue({ servicioId: String(preseleccionado.id) })` — un **string**. El `p-select`
   compara ese valor contra `catalogoOptions` cuyo `optionValue="value"` son **number**
   (`value: s.id`). El `valueChanges` interno ya normaliza con `Number(id)` (fix del bug de
   selección manual, también de fix-025-i) así que el precio sí se autocompleta — pero el
   propio `p-select` nunca encuentra el option que hace match visualmente porque compara
   el string crudo del FormControl contra sus opciones numéricas.
2. El historial de ventas ahora captura `document_number` (fix-025-i) pero la tabla no lo
   muestra en ningún lado — se pierde visualmente un dato que ya se guarda.

## Decisiones de negocio
Ninguna nueva — ambos son terminaciones directas de fix-025-i, no requieren decisión de negocio
adicional.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
1. `RegistrarVentaDrawerComponent`: el prellenado pasa `preseleccionado.id` (number) en vez de
   `String(preseleccionado.id)` — consistente con el tipo que ya usa `catalogoOptions`.
2. `servicios-especiales-content.component.ts`: nueva columna "N° Boleta" en la tabla desktop
   del Historial de Ventas (entre Monto y Fecha, o junto a Servicio) mostrando
   `venta.documentNumber ?? '—'`. Vista mobile: agrega el dato como texto secundario junto a la
   fecha (sin agregar una fila nueva, para no romper el layout de card).
3. `VentaServicio` (ui model): agrega `documentNumber: string | null`.
4. `mapVentaDto()`: mapea `dto.document_number` a `documentNumber`.
5. `fetchData()` en `ServiciosEspecialesFacade`: agrega `document_number` al `select()` de
   `special_service_sales` si no estaba ya.

## Test de Regresión
- `mapVentaDto()` propaga `document_number` → `documentNumber`.
- `/verify` — abrir "Vender" desde una tarjeta específica: el combobox muestra la etiqueta del
  servicio (no el placeholder). Historial de Ventas muestra la columna N° Boleta con el dato o
  "—" si no se capturó.

## Resultado
`npm run test:ci`: 2088/2093 (5 skipped, pre-existentes). `npm run lint:arch`: 0 errores.
`npx ng build`: limpio (solo warning de bundle budget, pre-existente).

`/verify` (Playwright, admin, `/app/admin/servicios-especiales`):
- "Vender" desde la tarjeta "Psicotecnico" → drawer abre con el combobox mostrando
  "$20.000 — Psicotecnico" (antes mostraba el placeholder pese a tener el precio prellenado).
- Historial de Ventas: nueva columna "N° Boleta" visible entre Monto y Fecha, mostrando el
  valor real capturado ("55555") o "—" cuando la venta no lo tenía.

**Ajuste post-QA (feedback visual del usuario):** la celda de N° Boleta usaba `font-mono`
(JetBrains Mono). El tamaño y color computados eran idénticos a la celda "Fecha" (14px,
`rgb(161,161,170)` — confirmado con `getComputedStyle`), pero la fuente monoespaciada se ve
visualmente más chica/fina que la tipografía normal de la tabla (Bricolage Grotesque), dando
la impresión de una columna "rota" pese a no tener ningún error de estilo real. Se quitó
`font-mono` para que la celda comparta tipografía con el resto de la fila.
