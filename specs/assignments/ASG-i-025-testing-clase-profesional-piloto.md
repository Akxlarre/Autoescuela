# Asignación ASG-i-025 — Testing: Clase Profesional en el piloto (Alumnos, Promociones, Libro de clases)

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

> **Checklist detallado:** `specs/testing-piloto/025-clase-profesional-piloto.md` — casos, datos de prueba, sospechas de bug y pasos. Este archivo es el resumen; el checklist es lo que se ejecuta.

## Contexto / Objetivo

De Clase Profesional solo quedan visibles en el piloto **Base de Alumnos Profesional**,
**Promociones** (`fix-257-m`) y **Libro de clases** (`fix-260-m`); el resto está bloqueado por
`pilotPhaseGuard('clase-profesional-recorte')`. Hay que probar a fondo lo visible y confirmar
que lo visible no depende de pantallas ocultas para funcionar (por ejemplo, un botón que navegue
a un módulo bloqueado).

**Clasificación:** **Integración** · dificultad **Alta** · rutas:
`/app/admin/clase-profesional/{alumnos,promociones}`, `/app/admin/libro-de-clases`,
`/app/secretaria/profesional/{alumnos,promociones}`, `/app/secretaria/libro-de-clases`.

## Alcance sugerido

**1. Funcional (contra ACs ya documentados)**
- ACs de specs `0002-m` (promociones con cadencia automática), `0005-i` (libro de clases
  app-like), `0017-m` (PDF réplica exacta del libro), `0018-m` (libros de convalidación A-3/A-4),
  `fix-098-m` (código de autorización editable).

**2. E2E manual**
- Matricular un alumno Profesional (`ASG-i-023`) → aparece en su Base y en la promoción
  correspondiente.
- Promociones: cadencia automática, matrícula tardía, convalidaciones.
- Libro de clases: generar PDF, comparar contra el libro físico, convalidación A-3 / A-4.
- **Links y botones internos que apunten a módulos ocultos** (relatores, asistencia,
  evaluaciones, certificados, archivo, pre-inscritos, ex-alumnos profesional) → no deben dejar
  al usuario en un callejón ni romper la pantalla.
- Secretaria de sede sin Profesional → no ve nada de esto (`professionalBranchGuard`).

**3. Candidatos a Playwright (requiere `ASG-i-021`)**
- Listado de alumnos Profesional + filtros.
- Generación del PDF del libro (respuesta 200 + descarga no vacía).

## Fuera de alcance

- Los 7 módulos ocultos por el recorte (solo se prueba que estén bloqueados → `ASG-i-022`).

## Referencias

- `specs/fixes/fix-256-m-*`, `fix-257-m-*`, `fix-260-m-*` · specs `0002-m`, `0005-i`, `0017-m`, `0018-m`

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Tanda de testing del piloto (ver `specs/ASSIGNMENTS.md`). Registrar el resultado de cada caso
  (✅ / ❌ + evidencia) en el `fix.md` del track que genere esta asignación. **Cada bug
  encontrado va a su propio fix/hotfix**, no se corrige dentro de este.
