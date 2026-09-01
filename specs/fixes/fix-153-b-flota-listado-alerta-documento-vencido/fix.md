# Fix: El listado de Flota no destaca los vehículos con documentos vencidos

> id: fix-153-b-flota-listado-alerta-documento-vencido
> refs: ASG-b-099 (specs/assignments/ASG-b-099-flota-listado-sin-alerta-documento-vencido.md)
> status: done
> created: 2026-09-01

## Root Cause

**[Heredado de ASG-b-099, confirmado por lectura de código]:** detectado en el barrido UAT de
Paquete 5. El Nissan Versa tiene un SOAP realmente vencido en la BD ("Vence: 06 MAY 2025", badge
rojo visible al abrir su panel de Documentación), pero su card en el listado de `/app/admin/flota`
muestra "Disponible" en verde **sin ningún indicador**: hay que entrar vehículo por vehículo para
descubrirlo. El Dashboard sí lo detecta ("1 Documento vencido"), así que el sistema tiene el dato.

**Confirmado al leer el código — y el diagnóstico de la asignación era más pesimista que la
realidad.** La asignación suponía que habría que "leer el estado de documentos en el facade o
agregar el query si no existe". No hace falta: `FlotaFacade.fetchVehiclesData()` **ya trae**
`vehicle_documents(type, expiry_date, status, file_url)` en su `select`, y `mapToTableRow()` ya
los mapea a `VehicleTableRow.documents: VehicleDocSummary[]` con el estado **ya resuelto** por
`resolveDocStatus()` (`'valid' | 'expiring_soon' | 'expired'`).

O sea: el dato ya viaja en cada fila del listado. `flota-list-content.component.ts` simplemente
nunca lo lee — cero referencias a `documents` o a vencimiento en todo el archivo.

Por lo tanto **no se toca el facade ni se agrega ninguna query**: el fix es puramente
presentacional, y no hay riesgo de que el cálculo diverja del que ya usan los otros consumidores.

## ACs Afectados

Ninguno — fix autónomo originado en QA manual (Paquete 5 de `docs/UAT-PLAN.md`, owner B).

## Cambio

- **Archivo:** `src/app/shared/components/flota-list-content/flota-list-content.component.ts`
- **Qué cambia:** se agrega un indicador de advertencia en las dos vistas del listado (tabla
  desktop y tarjetas mobile) cuando un vehículo tiene algún documento vencido o por vencer.
  El estado y el texto se derivan con las funciones puras que ya existen en
  `core/utils/vehicle-document-status.utils.ts` (`buildVehicleDocWarningMap`,
  `vehicleDocWarningLabel`) — las mismas que `fix-164-m`/`fix-165-m` usan en los flujos de
  agendamiento, para que el listado hable el mismo idioma que el resto de la app y el tooltip
  nombre los documentos específicos afectados.

## Test de Regresión

- Verificación en vivo con el dato real del seed: el Nissan Versa (SOAP vencido 06-MAY-2025) debe
  mostrar el indicador en el listado, y los vehículos sin documentos vencidos no.
- `npm run lint:arch` en exit 0.

### Resultado de la verificación (2026-09-01) ✅

Medido en `/app/admin/flota` con sede "Todas las sedes" (el Versa vive en Conductores Chillán, no
en la sede por defecto — con el filtro de sede en Chillán el vehículo ni siquiera aparece, hay que
cambiarlo para verlo):

| Vehículo | Indicador | `aria-label` |
|---|---|---|
| RTRE29 Nissan Versa 2019 | ✅ presente | "Vehículo RTRE29: SOAP vencido" |
| Los otros 6 vehículos | ausente | — |

Cero falsos positivos: el indicador aparece exactamente en el único vehículo con documento vencido,
y el tooltip nombra el documento específico.

**Contraste medido (WCAG 1.4.11 exige 3:1 para elementos no textuales), contra el fondo efectivo
real de la card, no contra el fondo asumido:**

| Modo | Color | Fondo | Ratio |
|---|---|---|---|
| Oscuro — vencido | `#f87171` | `rgb(45,45,48)` | **4.96:1** ✅ |
| Claro — vencido | `rgb(185,28,28)` | `rgb(228,228,231)` | **5.10:1** ✅ |
| Claro — por vencer (ámbar) | `rgb(180,83,9)` | `rgb(228,228,231)` | **3.96:1** ✅ |

⚠️ Trampa de verificación encontrada en el camino: `lucide-icon` traduce su input `color` al
**atributo `stroke`** del SVG, no a la propiedad CSS `color`. Medir `getComputedStyle(svg).color`
devuelve el color de texto heredado (gris) y hace parecer que el binding no se aplicó. Hay que
medir `stroke`.

`npm run lint:arch` → exit 0, 0 errores. El warning ARCH-09 (clase de 637 líneas) sobre este
archivo es **pre-existente**: verificado corriendo el lint con el cambio stasheado, aparece igual.

`npm run test:ci` → **2262 passed, 2 failed, 5 skipped**. Los 2 fallos son **pre-existentes y
ajenos a este fix** — verificado empíricamente corriendo ambos specs con el cambio stasheado:
fallan idénticos (`git stash push` → mismo `AssertionError` y mismo `TypeError`). El componente
tocado ni siquiera tiene `.spec.ts` propio.

| Spec que falla | Causa | Naturaleza |
|---|---|---|
| `core/facades/student-horario.facade.spec.ts` — "weekMeta arranca en lunes y cierra 6 días después" | Calcula el largo de la semana restando timestamps y dividiendo por 86400000, asumiendo días de 24h. Chile entra en horario de verano el **domingo 6-sep-2026** (offset 240 → 180 min, verificado con `getTimezoneOffset()`), así que la semana Lun 31-ago → Dom 6-sep mide 5.958333 días. | **Flaky latente**: falla solo en las 2 semanas del año con cambio de hora. Pasaba ayer, pasará la semana que viene. |
| `features/secretaria/contabilidad-cuadratura/...component.spec.ts` — "openIngresoDrawer (fix-080)" | El método `openIngresoDrawer` ya no existe en el componente; las únicas 2 referencias en la carpeta están dentro del propio spec. Quedó huérfano tras un refactor (último commit del componente: `48dea2b1`, spec 0004-i). | **Falla siempre**, y deja a fix-080 sin cobertura de regresión hasta que se repare. |

Ambos quedaron registrados como tareas aparte — no se arreglan acá porque están fuera del alcance
de este track (un fix = una causa raíz).
