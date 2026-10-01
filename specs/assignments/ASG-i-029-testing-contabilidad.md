# Asignación ASG-i-029 — Testing: Contabilidad (cuadratura, historial, reportes, anticipos, liquidaciones, cursos)

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/029-contabilidad.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

Contabilidad es donde se cierra la caja y se sacan los números del negocio. Todo lo que se
cobra, egresa o liquida en otros módulos tiene que cuadrar acá, al peso, y los PDFs/Excel que
generan las edge functions tienen que coincidir con lo que muestra la pantalla.

**Clasificación:** **Integración** · dificultad **Alta** · rutas:
`/app/{admin,secretaria}/contabilidad/{cuadratura,historial-cuadraturas,reportes,liquidaciones,cursos}`,
`/app/admin/contabilidad/anticipos`.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de specs `0002-i` (cuadratura editable + egresos de combustible), `0003-i` (reportes
  app-like), `0004-i` (cuadratura app-like), `0012-m` (borrador de arqueo persistido), `0014-m`
  (tarifa por hora de instructores por sede), `0015-m` (evolución mensual), `fix-226-m`
  (historial: fondo real y conciliación), `fix-237-m` (filtro de mes en rentabilidad).

**2. E2E manual**
- Día completo: fondo de apertura + pagos (varios medios) + egresos + servicios especiales →
  cierre de caja; teórico = fondo + ingresos en efectivo − egresos en efectivo; diferencia contra
  el arqueo físico.
- Borrador de arqueo: cerrar el navegador y volver → se conserva.
- Historial de cuadraturas → cifras idénticas al cierre original; exportar PDF/Excel = pantalla.
- Reportes contables del período → suman lo mismo que Pagos + Servicios especiales − Egresos.
- Liquidaciones de instructores con la tarifa por sede; anticipos descontados.
- Rentabilidad por curso con el filtro de mes.
- Admin por sede vs "Todas las sedes" → la suma de las sedes = el total.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Escenario sembrado de un día → assert de los totales del cierre.
- Export: respuesta 200 y archivo no vacío.

## Fuera de alcance

- Portal del instructor para ver su liquidación (fuera del piloto).

## Referencias

- `docs/UAT-PLAN.md` Paquete 4 · specs `0002-i`, `0003-i`, `0004-i`, `0012-m`, `0014-m`, `0015-m`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
- Conviene correrla después de `ASG-i-028` (Pagos) y `ASG-i-031` (Servicios especiales), sobre
  los mismos datos.
