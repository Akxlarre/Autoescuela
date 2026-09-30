# Asignación ASG-i-024 — Testing: Base de Alumnos Clase B, ficha del alumno y ex-alumnos

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/024a-base-alumnos-b.md` y `specs/testing-piloto/024b-ficha-ex-alumnos.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

La Base de Alumnos y la ficha son donde la secretaria opera a diario sobre un alumno ya
matriculado: consulta el progreso, reprograma clases, justifica inasistencias, archiva, restaura
y re-matricula. La ficha agrega datos de clases, pagos, documentos y asistencia, así que es un
buen detector de inconsistencias entre módulos.

**Clasificación:** **Integración** · dificultad **Alta** · rutas: `/app/{admin,secretaria}/alumnos`,
`/alumnos/:id`, `/ex-alumnos` (+ papelera).

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de specs `0016-b` (split B/Profesional), `0006-i` (ficha app-like), `0007-i` (ex-alumnos
  unificado), `0038-b` (ventana de período en listas), `fix-039-i` (buscador tokeniza nombre +
  apellido), `fix-040-i` (re-matricular precarga datos).

**2. E2E manual**
- Buscar/filtrar por nombre, apellido, RUT, estado, curso; paginación / virtual scroll con muchos
  alumnos.
- Ficha: clases, pagos, saldo, documentos y asistencia coinciden con lo matriculado.
- Reprogramar clase desde la ficha → el slot anterior se libera y el nuevo se ocupa (verificar en
  Agenda).
- Archivar con y sin historial → confirmación correcta; papelera → restaurar.
- Alumno con 12/12 clases y saldo 0 → pasa a Ex-Alumnos; re-matricular desde ahí.
- Número de matrícula como dato principal (`ASG-b-049`).
- Admin "Todas las sedes" (columna Sede) vs secretaria (solo su sede).

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Búsqueda y filtros parametrizados.
- Archivar → papelera → restaurar.
- Coherencia ficha vs datos semilla conocidos.

## Fuera de alcance

- Base de Alumnos **Profesional** → `ASG-i-025`.
- Inasistencias y penalización en detalle → `ASG-i-027`.

## Referencias

- `docs/UAT-PLAN.md` Paquete 2 · specs `0016-b`, `0006-i`, `0007-i`, `0038-b`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
