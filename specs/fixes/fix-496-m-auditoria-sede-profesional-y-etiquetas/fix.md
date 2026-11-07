# Fix: Auditoría — registros de Profesional sin sede y detalles con datos crudos
> id: fix-496-m-auditoria-sede-profesional-y-etiquetas
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: open
> created: 2026-11-07

## Root Cause

Revisión de cobertura (C01–C24 de `fix-485-m`) contra el último registro de cada tabla auditada
en la BD de dev. `log_change()` (versión de `20261107120000`, fix-490-m) tiene estos huecos:

1. **Profesional sin sede.** Las ramas de `promotion_courses`, `class_book`,
   `professional_theory_sessions`, `professional_practice_sessions` y
   `professional_module_grades` nunca asignan `v_branch_id`. Los 5.700 registros de esas tablas
   tienen `branch_id` NULL: el admin que elige "Conductores Chillán" en el topbar no ve ninguna
   acción de Clase Profesional.
2. **Pre-inscripción sin curso.** La etiqueta usa `desired_course_class`, que siempre es NULL;
   la clase pedida vive en `requested_license_class`. Sale "Inscripción Web: Clase  - Antonio
   Adán". La sede se toma del usuario temporal y no de la fila (`branch_id`).
3. **Excepción de pago como "id=7".** `enrollment_payment_overrides` cae en la rama por defecto:
   "Registrado: id=7", sin sede.
4. **Tipos de documento del alumno sin traducir.** `student_documents.type` usa claves en español
   (`cedula_identidad`, `hoja_vida_conductor`, `autorizacion_notarial`…) y el diccionario de
   `audit_humanize_enum_value()` solo tiene las inglesas: "Registrado: autorizacion_notarial de
   QA Setenta Menor".
5. **Columnas de las tablas que agregó fix-490-m sin traducir.** "Value: 5 -> 7" en descuentos;
   lo mismo en `cash_closings` (`qty_bill_20000` → "Qty Bill 20000"), `cuadratura_adjustments`,
   `courses` y `discount_applications`.
6. **Montos del detalle de un cambio sin miles** ("Monto: 1234 -> 4321"), y un pago pendiente
   sin medio de pago sale "(Desconocido)".
7. **Concordancia:** "Cursos modificado (2 ítems)" en el detalle de Configuración web.
8. **Ruido:** un texto que pasa de NULL a vacío deja "Notas: Sin asignar -> ".
9. **Certificado:** la sede sale del usuario del alumno y no de la matrícula.

## ACs Afectados

- Ninguno de spec; hallazgos del testing de `fix-485-m` (cobertura C y atribución D).

## Cambio

- Migración `supabase/migrations/20261107200000_fix496m_audit_log_sede_profesional_y_etiquetas.sql`:
  - `audit_humanize_column()`: columnas de `courses`, `discounts`, `discount_applications`,
    `cash_closings`, `cuadratura_adjustments`.
  - `audit_humanize_enum_value()`: tipos de documento en español, tipos de ajuste de cuadratura,
    tipo de excepción de pago.
  - `audit_website_config_diff()`: "Cursos: lista actualizada (2 ítems)".
  - `log_change()`: sede de Profesional desde la promoción (o la matrícula), pre-inscripción con
    `requested_license_class` y `branch_id` de la fila, rama propia de
    `enrollment_payment_overrides`, sede del certificado desde la matrícula, montos con miles en
    el detalle de un cambio, "Pendiente" para un pago sin medio, y vacío = sin asignar.
  - Rellena `audit_log.branch_id` de los registros de Profesional existentes.

## Test de Regresión

- `supabase/tests/audit/fix-496-m-auditoria-sede-profesional.sql` (bloque que aborta, sin efectos).
- Después de aplicar: acciones reales por API y lectura de `audit_log`.
