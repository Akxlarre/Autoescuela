# Fix: Completar la QA pendiente de ajustes de cuadratura (cadena 0002-i → fix-018-i)

> id: fix-148-b-qa-ajustes-cuadratura-completada
> refs: ASG-b-095
> status: done
> closed: 2026-08-23
> created: 2026-08-23

## Root Cause

No hay bug de producto: es **deuda de verificación**. La spec `0002-i` cerró ⚠️ PARCIAL (10/10 ACs
por test, 0 por QA visual) delegando en `fix-018-i`, que a su vez cerró `done` dejando fuera lo
más importante. El gap quedó invisible: los 3 artefactos decían `done` y nada apuntaba al residuo.

**Sin cambios de código.** Este track solo aporta evidencia.

## Cómo se destrabó

El bloqueo declarado en `fix-018-i` era "falta de Playwright MCP". Falso a esta altura: lo que
faltaba era acceso SQL admin para sembrar y limpiar datos de prueba. El owner agregó la regla de
permiso para `npx supabase db query --linked` (scopeada a ese subcomando, no a `npx supabase *`)
y autorizó explícitamente las escrituras contra la base compartida.

Protocolo aplicado: lecturas libres, y **cada escritura mostrada al owner antes de ejecutarla**.
Las 3 filas creadas se identificaron con el prefijo `QA-ASG-b-095` para poder borrarlas sin
ambigüedad.

## Verificado

### ✅ AC7 — la secretaria no puede crear ajustes (con control inverso)

Es el que más costaba aislar, porque `AC-E1` ya oculta el botón en cierres no cerrados: sin un
cierre **cerrado y visible** para la secretaria, no se distingue el guard de rol del de estado.

| Sesión | Mismo cierre (id 8, 23/08, sede 1) | Resultado |
|---|---|---|
| `secretaria@test.com` | Detalle abierto | Sección AJUSTES presente, **sin** enlace "Registrar ajuste" |
| `admin@test.com` | Detalle abierto | **`button "Registrar ajuste"`** presente |

Mismo componente, mismo dato, distinto rol. Eso aísla el guard sin ambigüedad.

### ✅ Golden path funcional — el ajuste llega a Contabilidad

Registrado por UI como admin sobre el cierre sembrado: tipo "Gasto olvidado", categoría
Combustible, monto 1.234, motivo `QA-ASG-b-095 IGNORAR`.

- BD: `cuadratura_adjustments` id 2, `monto -1234`, **`expense_id 8`** — creó y vinculó la fila
  de gasto.
- `expenses` id 8: `amount 1234`, `branch_id 1`, `category 'combustible'`, `date 2026-08-23`.
- **UI (Caja Diaria)**: aparece en "Egresos / Retiros" como `Combustible · QA-ASG-b-095 IGNORAR ·
  $1.234`, con `TOTAL EGRESOS $1.234`, y propaga a la conciliación:
  `Egresos / Retiros (-) $1.234` → `DEBE HABER EN CAJA $-1.234`.

Este era **el ítem de más valor de toda la asignación** y el que nadie había ejecutado nunca.

### ✅ Campos condicionales y preview de signo (estaban en la lista de no cubiertos de fix-018-i)

- Al elegir "Gasto olvidado" aparecen **Categoría** (requerida) y **Vehículo/Patente** (opcional),
  y **desaparece** el toggle Resta/Suma — coherente: un gasto siempre resta.
- Bajo el monto se muestra *"El total vigente cambiará en -1.234"* en rojo. El preview funciona.
- La validación de Categoría dispara al intentar enviar: borde rojo, *"Seleccione una categoría."*
  y el CTA pasa a deshabilitado.

## NO verificado, y por qué

- **AC-E2** (dos ajustes se suman en vez de pisarse): habría requerido una **segunda** escritura
  sobre la base compartida. Ya está cubierto por test unitario en `historial-cuadraturas.facade.spec.ts`
  y el riesgo de que esté mal es bajo, así que se prefirió minimizar escrituras en producción.
  Decisión consciente, no olvido.
- **AC-E1** (rechazo si la cuadratura no está cerrada): no se forzó el caso.

## Limpieza — verificada

Las 3 filas creadas fueron borradas en orden de dependencia (ajuste → gasto → cierre) y se
confirmó con conteo: `residuo_ajustes 0`, `residuo_gastos 0`, `residuo_cierres 0`. Totales de
vuelta al estado previo (1 ajuste, 6 gastos, 7 cierres).

## Hallazgo nuevo (fuera del alcance) — para triage

**La secretaria solo ve cierres de los últimos 2 días.** La policy de SELECT:

```sql
(auth_user_role() = 'admin')
OR (auth_user_role() = 'secretary' AND date >= CURRENT_DATE - '2 days' AND branch_visible(branch_id))
```

Consecuencia: su página "Historial de Cuadraturas" está vacía casi siempre, y el estado vacío
dice *"Ajusta los criterios de búsqueda o filtros"* — sugiere un filtro mal puesto cuando en
realidad es un **límite de permisos**. El mensaje manda al usuario a buscar un problema que no
existe. Si la ventana de 2 días es intencional, el texto debería decirlo.

## Corrección a la nota previa de ASG-b-095

La sesión anterior concluyó *"AC7 no verificable: ninguna secretaria tiene un cierre cerrado en su
sede"*. **Era falso**: cada sede tiene uno (id 7 → sede 1, id 6 → sede 2), pero RLS se los oculta
por antigüedad. La observación desde la UI fue correcta; la explicación, equivocada.

**Regla que deja:** si una lista sale vacía y hay RLS de por medio, verificar la policy antes de
concluir que faltan datos. La UI no distingue "no hay filas" de "no podés verlas".
