# Fix: Testing — Certificación Profesional en el piloto
> id: fix-480-m-testing-certificacion-profesional
> refs: ASG-m-011
> status: open
> created: 2026-10-22

> **Track de testing, no de corrección.** Acá se registra el resultado de cada caso (✅ / ❌ +
> evidencia). **Cada bug encontrado va a su propio fix/hotfix**; no se corrige dentro de este
> track.
>
> No hay checklist previo en `specs/testing-piloto/` para este módulo: los casos salen del
> alcance de la ASG (abajo) y se registran en "Resultados".

## Root Cause

[Heredado de ASG-m-011, a confirmar]: Certificados Prof. estuvo bloqueado en el piloto hasta
`fix-465-m` (2026-10-19), así que quedó fuera de `ASG-i-025` (Clase Profesional) y de `ASG-i-033`
(lo excluyó a propósito). Solo se revisó en el navegador una vez: la ruta carga, las columnas son
las correctas y "Generar" se deshabilita cuando falta el pago. Nunca se generó un certificado
Profesional de punta a punta. Es un documento con valor legal: si sale con datos incorrectos o se
emite a quien no corresponde, el problema es serio.

**Clasificación:** Funcional (con integración en la generación del PDF) · dificultad Media ·
rutas: `/app/admin/clase-profesional/certificados`, `/app/secretaria/profesional/certificados`.

### Alcance

1. **Elegibilidad en el piloto** — secretaria: solo depende del pago; admin: siempre elegible
   (`fix-465-m`). Promoción finalizada (`fix-467-m`). Sin columnas ni motivos académicos
   (teoría, práctica, nota).
2. **Emisión** — generar uno, "Generar pendientes" en lote, confirmación previa (`fix-466-m`),
   regenerar (`fix-464-m`), folio correlativo sin duplicados (`fix-461-m`), historial de emisiones
   y envío masivo.
3. **PDF** — plantilla "Certificado Profesional" del editor (sede 2). Datos interpolados: nombre,
   RUT, clase/categoría, convalidación, promoción, fechas y sede. Editar la plantilla y comprobar
   que el próximo PDF la use.
4. **Notificaciones** — con el portal del alumno en piloto, al alumno no le llega nada
   (`fix-465-m`, `fix-448-m`).
5. **Documentos** — el certificado emitido aparece en el DMS de la matrícula (`fix-470-m`) y en
   la ficha del alumno.
6. **Transversal** — admin vs secretaria, aislamiento por sede (RLS + Storage; secretaria de otra
   sede), modo oscuro y claro, 375 / 768 / 1280 / 1440 px y app-like.
7. **Pendiente heredado de `fix-447-m` (S4):** `export-certificates-zip` sigue aceptando
   `type: 'professional'`; ahora que Profesional está habilitado, revisar que respete sede y rol.

Los hallazgos se corrigen en la misma sesión, cada uno en su propio fix/hotfix.

### Fuera de alcance

- Archivo Profesional (ya probado en `ASG-i-025` / `fix-319-m`, D3a).
- Relatores, Asistencia, Evaluaciones y Pre-inscritos (siguen bloqueados en el piloto).

## Progreso

- [ ] Revisión en código: elegibilidad, emisión, folio, edge functions del PDF/envío/ZIP
- [ ] Datos de prueba: promoción finalizada en sede 2 con alumnos pagados y no pagados
- [ ] Casos en navegador (admin y secretaria)
- [ ] PDF: datos interpolados y cambio de plantilla
- [ ] DMS de la matrícula y ficha del alumno
- [ ] Aislamiento por sede
- [ ] Modos claro/oscuro, anchos y app-like
- [ ] Test de regresión del track
- [ ] `/fix-close`

## Resultados

_(se completa durante la ejecución)_

## Fix

No aplica: cada hallazgo va a su propio track.

## Test de regresión

_(por definir: e2e de emisión de un certificado Profesional elegible y bloqueo del no elegible)_
