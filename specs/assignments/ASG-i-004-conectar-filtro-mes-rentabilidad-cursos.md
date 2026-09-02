# Asignación ASG-i-004 — El filtro "Aplicar" (mes) no afecta la pestaña Rentabilidad

> ⚠️ **Este `ASG-i-004` es sobre el filtro de mes en Rentabilidad — NO tiene relación con
> "Migrar funciones de negocio del cliente a Edge Functions".** Ese fue un `ASG-i-004`
> distinto (título literal "Migrar funciones de negocio del cliente a Edge Functions"),
> eliminado el 2026-08-25 por ser un duplicado fantasma de `ASG-i-002` (ver nota completa
> en `specs/ASSIGNMENTS.md` → Convenciones). Si buscabas ese tema, es `ASG-i-002` /
> `0011-m-print-flows-edge-functions`, no este archivo.
>
> **Renombrada de `ASG-i-005` a `ASG-i-004` el 2026-08-25** para ocupar el número que
> había quedado libre al eliminar el `ASG-i-004` fantasma de arriba. Excepción puntual a
> "los IDs nunca se reutilizan": ese `ASG-i-004` nunca fue una asignación real, así que
> no hay contenido histórico que perder al reasignar el número.

> **status:** reclamada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-25
> **created_by:** i
> **claimed_by:** m
> **claimed_at:** 2026-09-02
> **resulting_track:** fix-237-m-conectar-filtro-mes-rentabilidad-cursos

---

## Contexto / Objetivo

Detectado durante QA visual de la spec `0003-i-app-like-reportes-contables`: en
`/admin/contabilidad/reportes` y `/secretaria/contabilidad/reportes`, cambiar el rango de fechas
y hacer clic en "Aplicar" actualiza correctamente Hero, Categorías, Evolución Mensual, Detalle
Diario y Gastos Fijos — pero **la pestaña "Rentabilidad" no cambia nunca**, sin importar el
rango de fechas seleccionado.

Causa raíz identificada (lectura de código, no confirmada aún con el dueño de negocio si el
dato real ya existe): `rentabilidad-cursos.component.ts` tiene `datosRentabilidad` como un
`signal<RentabilidadCurso[]>([...])` con datos **hardcodeados** (mock), no un `input()` que
reciba datos reales filtrados por rango — y `mesActual` es un `computed()` que no depende del
`filtros()` del padre. El componente nunca recibió el rango de fechas ni datos reales desde
`reportes-contables-content.component.ts` ni desde `ReportesContablesFacade`.

## Alcance sugerido

1. Confirmar con el dueño de negocio si "Rentabilidad Estimada por Tipo de Curso" debe ser un
   cálculo real sobre datos de matrículas/pagos del rango filtrado, o si por ahora es
   intencionalmente un placeholder (RF-040 lo marca como "mock" en `indices/COMPONENTS.md`).
2. Si es real: definir qué tablas/campos alimentan el cálculo de rentabilidad por tipo de curso
   (¿matrículas × precio - costos operativos por curso? ¿ya existe ese dato en algún reporte?).
3. Convertir `datosRentabilidad` de signal interno a `input()` recibido desde
   `reportes-contables-content.component.ts`, que a su vez lo recibiría del
   `ReportesContablesFacade` (o un Facade nuevo si el cálculo no encaja en el existente).
4. `mesActual` debe derivarse del `filtros()` real, no de la fecha de hoy.
5. Verificar que "Aplicar" dispare la actualización de Rentabilidad igual que las demás
   secciones.

## Referencias

- Spec `0003-i-app-like-reportes-contables` (donde se detectó, QA visual 2026-08-25)
- `indices/COMPONENTS.md` → entrada de `RentabilidadCursosComponent` ("✅ UI Ready (mock)")

## Archivos involucrados

- `src/app/shared/components/rentabilidad-cursos/rentabilidad-cursos.component.ts`
- `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts`
  (para pasar el input nuevo)
- `src/app/core/facades/reportes-contables.facade.ts` (posible fuente de datos reales)

## Notas para quien la reclame

- No asumas que el cálculo de rentabilidad ya existe en algún lado — confirma con el dueño antes
  de diseñar el query. Si el dato no existe en BD, esto puede ser más grande que un `fix` simple
  (evaluar `spec` en vez de `fix` si implica modelo de datos nuevo).
