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
