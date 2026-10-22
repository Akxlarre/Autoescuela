# Asignación ASG-m-011 — Testing: Certificación Profesional en el piloto

> **status:** completada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-10-20
> **created_by:** m
> **claimed_by:** m
> **claimed_at:** 2026-10-22
> **resulting_track:** fix-480-m-testing-certificacion-profesional

---

## Contexto / Objetivo

Certificados Prof. estuvo bloqueado en el piloto hasta `fix-465-m` (2026-10-19). Por eso quedó
fuera de las dos tandas de testing que lo rodeaban: `ASG-i-025` (Clase Profesional) no lo incluía,
y `ASG-i-033` lo excluyó a propósito ("ocultos en el piloto"). Solo se revisó en el navegador una vez:
la ruta carga, las columnas son las correctas y "Generar" se deshabilita cuando falta el pago.
Nunca se generó un certificado Profesional de punta a punta. Es un documento con valor legal: si sale
con datos incorrectos o se emite a quien no corresponde, el problema es serio.

**Clasificación:** **Funcional** (con integración en la generación del PDF) · dificultad **Media** ·
rutas: `/app/admin/clase-profesional/certificados`, `/app/secretaria/profesional/certificados`.

## Alcance sugerido

- **Elegibilidad durante el piloto:** con el recorte activo, la secretaria solo depende del pago y
  el admin siempre es elegible (`fix-465-m`). La promoción tiene que estar finalizada (`fix-467-m`).
  No deben aparecer columnas ni motivos académicos (teoría, práctica, nota).
- **Emisión:** generar uno, "Generar pendientes" en lote, la confirmación previa (`fix-466-m`),
  regenerar (`fix-464-m`), un folio correlativo sin duplicados (`fix-461-m`), el historial de
  emisiones y el envío masivo.
- **PDF:** sale de la plantilla "Certificado Profesional" del editor (sede con Profesional). Revisar
  que los datos interpolados sean correctos: nombre, RUT, clase/categoría, convalidación,
  promoción, fechas y sede. Editar la plantilla y comprobar que el próximo PDF la use.
- **Notificaciones:** con el portal del alumno en piloto, al alumno no le llega nada (`fix-465-m`,
  `fix-448-m`).
- **Documentos:** el certificado emitido aparece en el DMS de la matrícula (`fix-470-m`) y en la
  ficha del alumno.
- **Transversal:** admin vs secretaria, aislamiento por sede (RLS + Storage), modo oscuro y claro,
  375 / 768 / 1280 / 1440 px y app-like.

## Fuera de alcance

- Archivo Profesional: ya se probó en `ASG-i-025` / `fix-319-m` (D3a).
- Relatores, Asistencia, Evaluaciones y Pre-inscritos: siguen bloqueados en el piloto.

## Referencias

- `fix-465-m`, `fix-466-m`, `fix-467-m`, `fix-464-m`, `fix-461-m`, `fix-448-m`, `fix-470-m`
- `fix-447-m` (ASG-i-033, certificación B): mismo patrón de testing
- `fix-319-m` (ASG-i-025): datos de prueba de Profesional que quedaron en la BD (E2E-ProfConv, etc.)

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno propio (testing).

## Notas para quien la reclame

- Registrar el resultado de cada caso (✅ / ❌ + evidencia) en el `fix.md` del track que se genere.
  **Cada bug encontrado va a su propio fix o hotfix.**
- Solo la sede 2 tiene Profesional. Para el aislamiento por sede, usar una secretaria de otra sede.
