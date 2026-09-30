# Asignación ASG-i-027 — Testing: Asistencia Clase B, inasistencias y penalización

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-09-29
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

> **Checklist detallado:** `specs/testing-piloto/027-asistencia-clase-b.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

La asistencia tiene reglas de negocio con consecuencias fuertes: 2 inasistencias consecutivas
cancelan las clases futuras (penalización), la justificación las neutraliza y el reagendamiento
masivo las recupera. Además interviene un cron nocturno. Son reglas fáciles de romper sin que se
note en pantalla.

**Clasificación:** **Integración** · dificultad **Alta** · rutas: `/app/{admin,secretaria}/asistencia`
+ panel de inasistencias de la ficha.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de spec `0030-b` (layout dual asistencia), `fix-034-m` (justificar), `fix-035-m` (confirmar
  inasistencia), `fix-093-b` (botón recordar alertas), RPC `apply_class_b_absence_penalty()`.

**2. E2E manual**
- Marcar ausente solo cuando la hora de la clase ya pasó (no antes).
- 1 inasistencia → sin penalización; 2 consecutivas → clases futuras canceladas.
- 2 inasistencias NO consecutivas → sin penalización.
- Justificar → deja de contar; badge "Justificado" + motivo visible.
- Reagendar clases penalizadas (flujo 2 pasos) → vuelven a la agenda respetando Triple Match.
- Cron nocturno (con datos preparados o fecha simulada) → `no_show` correcto; clases `in_progress`
  quedan abiertas y destacadas.
- Alertas de asistencia en dashboard coinciden con lo real.

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Penalización por 2 consecutivas con datos sembrados (fechas en el pasado).
- Justificar → recalcula.

## Fuera de alcance

- Asistencia Profesional (oculta en el piloto).

## Referencias

- `docs/UAT-PLAN.md` Paquete 2 (casos de inasistencia) · spec `0030-b`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
- Necesita datos con fechas en el pasado: sembrarlos en vez de esperar al reloj real.
