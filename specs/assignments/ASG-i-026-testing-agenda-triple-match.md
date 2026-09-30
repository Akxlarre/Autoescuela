# Asignación ASG-i-026 — Testing: Agenda Clase B y Triple Match

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/026-agenda-triple-match.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

La Agenda aplica la regla central del producto, el **Triple Match**: alumno, instructor y
vehículo tienen que calzar en el mismo horario, sin choques. Además, hay 4 flujos distintos que
agendan (nueva matrícula, reagendamiento masivo, reprogramación desde la ficha y agenda semanal).
Todos deben respetar las mismas reglas, y en el pasado no lo hicieron (`fix-164-m` vs `fix-165-m`).

**Clasificación:** **Integración/E2E** · dificultad **Alta** · rutas: `/app/{admin,secretaria}/agenda`
+ los grids de agendamiento dentro de matrícula y ficha.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de `fix-152-m` (constraint anti doble-agendado en BD), `fix-162-m` (límite de semanas),
  `fix-164/165/166-m` (advertencia de vehículo con documentos vencidos), `fix-028-i` (instructor
  "ambas sedes" en el picker), spec `0004-m` (instructores/vehículos multi-sede), spec `0001-i`
  (ciclo de vida de la clase).

**2. E2E manual**
- Doble agendamiento del mismo instructor / vehículo / alumno en el mismo horario → imposible en
  los 4 flujos, también con **2 secretarias simultáneas** (2 navegadores o perfiles distintos).
- Vehículo con SOAP / revisión técnica vencida → advertencia visible en los 4 flujos.
- Navegación de semanas: flechas, "Hoy", salto de fecha, límite configurado (clics rápidos).
- Filtro por instructor; instructor multi-sede visible en ambas sedes.
- Leyenda de estados (disponible / agendada / en curso / completada / no asistió) coherente.
- ⚠️ **Resolver primero:** con el portal Instructor oculto en el piloto, ¿quién inicia y cierra
  las clases (KM, estado `in_progress` → `completed`)? Confirmar el flujo real de la
  secretaria/admin y probarlo. Si no existe, es un hallazgo P0 del piloto.
- Cron de fin de jornada: clases `scheduled` no resueltas pasan a `no_show`.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Intento de doble agendamiento (esperar rechazo), con 2 contextos en paralelo.
- Límite de navegación de semanas con clics rápidos.

## Fuera de alcance

- Portal Instructor ("Mis clases hoy", iniciar clase desde el instructor): fuera del piloto.

## Referencias

- `docs/PRODUCT-VISION.md` §Triple Match · `docs/UAT-PLAN.md` Paquete 3
- `indices/DOMAIN-GOTCHAS.md`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
