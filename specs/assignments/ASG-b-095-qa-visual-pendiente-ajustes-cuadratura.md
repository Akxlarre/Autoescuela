# Asignación ASG-b-095 — QA visual pendiente de la cadena `0002-i` → `fix-018-i` (ajustes de cuadratura)

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Detectado en la auditoría de higiene del tablero del 2026-08-22. **El gap de QA visual de la
spec `0002-i-cuadratura-editable-ajustes` se difirió dos veces y hoy es invisible**: los tres
artefactos de la cadena dicen `done`/`completada` y nada apunta al residuo.

La cadena:

1. **`0002-i-cuadratura-editable-ajustes`** cierra el 2026-08-06 con veredicto ⚠️ **PARCIAL**:
   10/10 ACs cumplidos con test automatizado, **0 con QA visual en navegador**. El owner acepta
   el gap explícitamente y pide un fix de seguimiento que lo absorba.
2. **`fix-018-i-mejorar-visual-editar-cuadratura`** se crea ese mismo día y cierra `done` el
   2026-08-08. Sí mejoró visualmente `detalle-cuadratura-modal` (el usuario confirmó sobre
   capturas reales), pero **dejó fuera explícitamente** la mayor parte de la QA heredada.
3. **`ASG-b-037`**, la asignación que originó la spec, figura como `completada` en el tablero.

El motivo declarado en el cierre de `fix-018-i` fue *"no ejecutada por falta de Playwright MCP
en esta sesión y decisión del usuario de cerrar sin ese paso"*. **Ese bloqueo ya no aplica** —
Playwright MCP está operativo en el proyecto (ver `.claude/skills/verify/SKILL.md`).

## Alcance sugerido

Los 4 ítems que `fix-018-i` listó como no cubiertos, en orden de valor:

1. **Golden path funcional** (el más importante, no es cosmético): registrar un ajuste →
   confirmar que aparece efectivamente en **Contabilidad > Gastos**. Es plata: si el `INSERT`
   en `expenses` no se refleja donde el usuario lo busca, el ajuste existe pero nadie lo ve.
2. **AC7 — la secretaria no puede crear ajustes.** Hoy está verificado solo por test unitario
   (guard client-side) + policy RLS `insert_cuadratura_adjustments`. Nunca se confirmó en
   navegador que la secretaria efectivamente no vea el botón.
3. **Revisión visual del drawer `RegistrarAjusteCuadraturaDrawerComponent`**
   (`src/app/features/admin/contabilidad-cuadratura/`): toggle Resta/Suma, preview del signo,
   campos condicionales de "Gasto olvidado".
4. **AC-E1 / AC-E2 y modo oscuro**: ajuste rechazado si la cuadratura no está cerrada; dos
   ajustes seguidos se suman en vez de pisarse.

Aplicar `/verify` como validación principal — es visual y funcional, no lógico. La lógica ya
tiene 47 tests verdes de `0002-i` más 51 de regresión en `fix-018-i`; **no hace falta reescribir
tests**, hace falta mirar.

## Notas para quien la reclame

- El owner natural es **`i`** (autor de la spec y del fix), pero se deja en `cualquiera` para no
  asignar trabajo sin coordinar. Si `i` la toma, numera su track con su propio contador.
- **No reabrir `0002-i` ni `fix-018-i`.** Ambos están correctamente cerrados según lo que
  decidieron en su momento; esto es trabajo nuevo, no una corrección de esos cierres.
- Lección de proceso (vale más allá de este caso): cuando un track cierra difiriendo trabajo a
  otro track, y **ese segundo track también cierra difiriendo**, el trabajo desaparece del
  tablero sin que ningún artefacto quede en rojo. La cadena de `refs:` no alcanza — hace falta
  una Asignación abierta, que es lo que este archivo repara.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/features/admin/contabilidad-cuadratura/registrar-ajuste-cuadratura-drawer.component.ts`
- `src/app/shared/components/detalle-cuadratura-modal/detalle-cuadratura-modal.component.ts`
- `src/app/core/facades/historial-cuadraturas.facade.ts`

## Referencias

- `specs/specs/0002-i-cuadratura-editable-ajustes/acceptance.md` (§"Deuda técnica detectada")
- `specs/fixes/fix-018-i-mejorar-visual-editar-cuadratura/fix.md` (§"No cubierto en esta pasada")

---

## Resultados de la QA visual parcial ejecutada (2026-08-22, por `b`)

Se ejecutó la parte **read-only** de la QA pendiente con Playwright, sobre `ng serve` en :4210
y el usuario `admin@test.com`. **No se ejecutó ninguna escritura** — el motivo está abajo, es el
hallazgo más importante de esta pasada.

### ✅ Verificado en navegador (antes solo por test unitario)

| Ítem | Resultado |
|---|---|
| **AC1** — botón "Registrar ajuste" visible para Admin en cuadratura cerrada | ✅ Visible en el detalle del cierre del 06/08/2026 |
| **AC4** — total vigente sin sobrescribir el snapshot original | ✅ "CIERRE TOTAL $0" (original intacto) y "Vigente: $-50.000" en una línea aparte, debajo |
| **AC6** — cada ajuste muestra motivo, monto, autor y fecha | ✅ Los 4 presentes: badge "Gasto olvidado", `06/08/2026 03:58`, `$-50.000`, motivo, "Registrado por PEPITO ADMI" |
| **Ítem 3** — revisión visual del drawer `RegistrarAjusteCuadraturaDrawerComponent` | ✅ Correcto. Tipo de ajuste, toggle Resta/Suma con iconos −/+, monto con prefijo `$`, motivo, CTA deshabilitado con el form vacío |
| **Modo oscuro** | ✅ Aplica bien en el detalle y en el drawer (`body` en `rgb(9,9,11)`), todo legible |

**Detalle a destacar del drawer** (no estaba documentado en ningún lado): tiene un callout
ámbar que avisa *"Este ajuste se sumará a la cuadratura del 06/08/2026, no a la de hoy"*.
Resuelve exactamente la confusión que AC2 intenta prevenir, y se ve bien en ambos temas.

### 🛑 Bloqueado — NO ejecutar sin decisión explícita

**El golden path funcional (ítem 1), AC-E1 y AC-E2 requieren un INSERT, y ese INSERT es
permanente e irreversible contra la base de datos compartida.** Dos razones que se suman:

1. `supabase/migrations/20260806010000_cuadratura_adjustments.sql` crea **solo** las policies
   `select_cuadratura_adjustments` y `insert_cuadratura_adjustments`. **No hay UPDATE ni
   DELETE** — la inmutabilidad es intencional (AC5), pero implica que un ajuste de prueba
   **no se puede borrar desde la app**.
2. `src/environments/` tiene **un solo** `environment.ts` y `angular.json` no define
   `fileReplacements`, así que `ng serve` apunta al **mismo proyecto Supabase remoto** que el
   resto del equipo — no a un Supabase local.

Un ajuste de prueba dejaría, de forma permanente: una fila en `cuadratura_adjustments` y —si es
"gasto olvidado"— una fila falsa en `expenses`, que es justamente el módulo de Contabilidad que
el cliente mira. **Quien reclame esta asignación debe resolver esto primero**: levantar
`npx supabase start` local, o sembrar un cierre desechable, o pedir autorización explícita del
owner para ensuciar el ambiente compartido con un ajuste identificable.

### ⚠️ AC7 (secretaria sin botón) — no verificable con el seed actual

Se intentó con `secretaria@test.com` y `secretaria2@test.com`: **ninguna de las dos ve un cierre
cerrado** en `/app/secretaria/contabilidad/historial-cuadraturas` (agosto muestra solo la sesión
en curso, julio sale "Sin Actividad"). El cierre del 06/08 solo es visible para el admin.

Sin una cuadratura **cerrada dentro del scope de sede de una secretaria** no se puede aislar el
guard de rol del guard de estado (AC-E1 ya oculta el botón en cierres no cerrados). Hace falta
sembrar ese dato antes de poder verificar AC7 de verdad.

### 🐛 Hallazgos nuevos (fuera del alcance original, para triage)

1. **Error de consola real**: `InvalidStateError: Transition was aborted because of invalid
   state` (code 11) al operar los drawers de esta página. Es la View Transitions API abortando —
   probablemente dos transiciones solapadas. No rompe la funcionalidad (el drawer abre igual,
   con un retardo perceptible) pero ensucia la consola y sugiere una transición mal encadenada.
2. **Formato inconsistente de moneda negativa** en la misma pantalla: la lista de la izquierda
   muestra `- $50.000` (signo antes del `$`, con espacio) y la fila del ajuste muestra
   `$-50.000` (signo después del `$`). Deberían usar el mismo formateo.
