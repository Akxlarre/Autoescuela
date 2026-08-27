# Spec 0012-m — Persistir borrador de Arqueo y Cierre de Caja

> **Status:** done
> **Created:** 2026-08-27
> **Closed:** 2026-08-27
> **Owner:** Matías
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** Hallazgo de UX durante UAT manual del Paquete 4 (Pagos, Cuadratura y Servicios
Especiales), item "Cierre de caja del día", tras implementar `fix-225-m` (botón "Cerrar Caja"
dentro del drawer de Arqueo y Cierre).

**Persona afectada:** Secretaria / Admin (quien opera la caja diaria).

**Problema que resuelve:** El drawer "Arqueo y Cierre Operativo" (`ArqueoCierreDrawerComponent`)
mantiene el fondo de apertura, el conteo de billetes/monedas y la justificación solo en signals
en memoria del `CuadraturaFacade`. Si la página se recarga (F5, cierre accidental de pestaña,
crash del navegador) a mitad de un arqueo físico, todo el conteo se pierde y hay que rehacerlo
desde cero — un problema real al contar efectivo físico, donde interrupciones (otro alumno,
llamada, corte de luz) son comunes. Además, el botón "Listo" del footer se presta a confundirse
con "Cerrar Caja" (la acción de negocio irreversible), cuando hoy solo cierra el panel sin
guardar nada.

**Hipótesis de valor:** Si el borrador se autoguarda, la secretaria puede interrumpir y retomar
el arqueo sin perder el conteo, y el lenguaje del botón dejará de sugerir que "Listo" cierra la
caja.

---

## 2. User Stories

- **US1**: Como Secretaria, quiero que el fondo de apertura, el conteo de billetes/monedas y mi
  justificación se guarden automáticamente mientras los ingreso, para no perderlos si la página
  se recarga a mitad del arqueo.
- **US2**: Como Secretaria, quiero que al reabrir el panel de Arqueo el mismo día se muestre mi
  último borrador guardado, para retomar el conteo donde lo dejé.
- **US3**: Como Secretaria, quiero que el botón que solo cierra el panel (sin cerrar la caja) no
  se confunda con la acción de cerrar caja, para no dudar si perdí mi trabajo al usarlo.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1**: Given la caja está abierta y el drawer de Arqueo está abierto, When la Secretaria
  edita el fondo de apertura, una cantidad de billetes/monedas o la justificación, Then el
  cambio se persiste en BD automáticamente (debounce ~800ms sin actividad), sin acción manual.
- **AC2**: Given hay un borrador guardado para hoy (branch_id + date), When la Secretaria recarga
  la página (F5) o vuelve a abrir el drawer de Arqueo, Then los valores del borrador (fondo,
  cantidades, notas, toggle de arqueo físico) se restauran tal como quedaron.
- **AC3**: Given hay un borrador guardado, When la Secretaria hace clic en "Cerrar panel" (antes
  "Listo"), Then el drawer se cierra y el borrador ya persistido en BD no se pierde ni se
  descarta.
- **AC4**: Given un borrador existe para hoy, When la Secretaria hace clic en "Cerrar Caja" (con
  `puedeCerrarCaja()` en true), Then la misma fila de `cash_closings` se actualiza a
  `status: 'closed'` / `closed: true` (no se crea una fila duplicada) y a partir de ahí queda
  bloqueada para edición (`cajaYaCerrada()`).
- **AC5**: Given una fila de borrador (`status: 'draft'`) para hoy, When se consulta
  `cajaYaCerrada()` (chequeo de caja ya cerrada al cargar la página), Then el borrador NO cuenta
  como caja cerrada — solo `status: 'closed'` bloquea.

### Edge cases obligatorios

- **AC-E1**: Given dos secretarias de la misma sede abren el drawer casi al mismo tiempo, When
  ambas editan el arqueo, Then el autoguardado no genera dos filas de borrador para el mismo
  `(date, branch_id)` (constraint de unicidad + upsert).
- **AC-E2**: Given un borrador quedó guardado un día y nunca se cerró, When llega el día
  siguiente y la Secretaria abre el drawer, Then NO se muestra el borrador del día anterior (el
  borrador es por `date` exacta — un día nuevo empieza en blanco).
- **AC-E3**: Given el autoguardado falla (ej. sin conexión), When la Secretaria sigue escribiendo,
  Then no se bloquea la UI ni se pierde lo ya tipeado en los signals — el fallo es silencioso con
  reintento en el próximo cambio (mismo criterio que `refreshSilently()` del patrón SWR).

---

## 4. Out of scope

- ❌ Sincronización en tiempo real entre dos usuarios editando el mismo borrador simultáneamente
  (solo se evita duplicar filas — no hay merge de cambios concurrentes).
- ❌ Historial de versiones del borrador (solo importa el último estado).
- ❌ Cambiar la lógica de cálculo de `saldoTeoricoEfectivo`/`diferenciaArqueo`/`puedeCerrarCaja`
  (ya verificada, fuera de alcance).
- ❌ Persistir borrador de otras secciones de cuadratura (ingresos/egresos) — ya se guardan de
  inmediato al registrarlos, no son parte de este problema.

---

## 5. Dependencias

### Specs previas
- Ninguna formal — construye sobre `spec 0004-i` (arqueo/cierre) y `fix-225-m` (botón dentro del
  drawer).

### Capacidades del proyecto que se asumen existentes
- `CuadraturaFacade` con signals `fondoInicial`, `cantidades`, `notasArqueo`, `realizarArqueo`.
- Tabla `cash_closings` con columnas `status` y `closed` ya existentes.
- Patrón `createRequestGuard()` para evitar carreras en fetch.

### Capacidades nuevas requeridas
- Migración SQL: constraint de unicidad `(date, branch_id)` en `cash_closings` para permitir
  upsert seguro del borrador.
- Migración SQL: policy `update_cash_closings` debe permitir a `secretary` actualizar (no solo
  `admin`) filas `status = 'draft'` de su propia sede (`branch_visible`) — hoy solo admin puede
  hacer UPDATE.
- Método nuevo en `CuadraturaFacade`: `guardarBorrador()` (upsert debounced) + carga del borrador
  en `initialize()`/`checkCajaStatus()`.

---

## 6. Datos y modelo (preliminar)

- **Tabla modificada:** `cash_closings` — sin columnas nuevas (reutiliza `status`/`closed`
  existentes). Se agrega constraint único sobre `(date, branch_id)` (considerar
  `branch_id IS NULL` para sedes sin filtro — usar índice único parcial o `COALESCE`).
- **RLS:** ampliar `update_cash_closings` para `secretary` sobre filas `status = 'draft'` de su
  sede. Filas `status = 'closed'` siguen bloqueadas para UPDATE de secretaria (ya lo están).
- **Modelos UI:** ninguno nuevo — mismo `CierrePayload` existente.

---

## 7. UX y flujos (preliminar)

- **Pantalla afectada:** `ArqueoCierreDrawerComponent` (`Contabilidad → Cuadratura → Arqueo y
  Cierre`).
- **Flujo principal:** la Secretaria abre el drawer, edita fondo/cantidades/notas → cada cambio
  se autoguarda tras ~800ms de inactividad, sin indicador intrusivo (podría agregarse un
  micro-label discreto tipo "Guardado" si el owner lo pide, pero no es AC obligatorio).
  Al recargar o reabrir el mismo día, el borrador se restaura automáticamente.
- **Botón renombrado:** "Listo" → "Cerrar panel" (footer del drawer, junto a "Cerrar Caja").
- **Estados especiales:** autoguardado fallido → silencioso, sin toast de error (no interrumpe el
  conteo); reintenta en el siguiente cambio o al cerrar caja.

---

## 8. Métricas de éxito post-launch

- Cero reportes de "perdí el conteo del arqueo" tras un F5 accidental (seguimiento informal vía
  feedback directo del owner/secretarias).

---

## 9. Notas / decisiones abiertas

- [x] Trigger de guardado: auto-guardado con debounce (confirmado con el owner, 2026-08-27).
- [x] Nuevo label del botón "Listo": "Cerrar panel" (confirmado con el owner, 2026-08-27).
- [ ] ¿Vale la pena un indicador visual discreto de "Guardado" en el drawer? No es AC obligatorio
  — a definir en `/spec-plan` o dejarlo fuera si no aporta.

---

## Changelog

- 2026-08-27 — draft inicial por Matías, a partir de hallazgo de UX en UAT + discusión de diseño
  con el owner sobre trigger de autoguardado y renombre de botón.
