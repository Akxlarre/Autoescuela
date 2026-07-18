# Fix: Validaciones faltantes en formulario público de datos personales
> id: fix-001-b-public-personal-data-validaciones
> refs: spec-0009 (flujo inscripción pública)
> status: done
> closed: 2026-06-04
> created: 2026-06-04

## Root Cause
`PublicPersonalDataComponent` fue implementado como versión simplificada del wizard admin
(`app-personal-data-step`) sin portar las validaciones críticas. El `canAdvance()` solo
verifica que 4 campos sean truthy, sin validar formato ni restricciones legales.

## ACs Afectados
- **AC-datos-1:** RUT debe ser válido (formato + dígito verificador) antes de poder avanzar
- **AC-datos-2:** Email debe tener formato válido antes de poder avanzar
- **AC-datos-3:** Menores de 17 años no pueden matricularse (requisito legal Chile)
- **AC-datos-4:** Menores de 20 años no pueden pre-inscribirse en Clase Profesional
- **AC-datos-5:** El campo género debe ser seleccionable (no hardcodeado a 'M')
- **AC-datos-6:** Teléfono y fecha de nacimiento son requeridos para contacto y verificación de edad
- **AC-datos-7:** Apellido materno debe aparecer como campo opcional visible

## Cambio
- **Archivo:** `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts`
- **Qué cambia:**
  1. Agregar campos: `maternalLastName`, `gender` (selector M/F), `birthDate` (requerido), `phone` (requerido)
  2. Portar `rutValid` computed con `validateRut()` + auto-formato + feedback visual rojo/verde
  3. Portar `emailValid` computed con `validateEmail()` o usar `<app-email-input>`
  4. Portar `ageStatus` computed con `calcAge()` → alertas inline para <17, 17-18, <20 profesional
  5. Actualizar `canAdvance()` para requerir: `rutValid() && emailValid() && ageStatus() !== 'under-17' && ageStatus() !== 'under-20-professional' && phone.length >= 8 && birthDate.length > 0`

## Test de Regresión
- `src/app/shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.spec.ts`
  - `canAdvance() es false con RUT inválido` ✓
  - `canAdvance() es false con email inválido` ✓
  - `canAdvance() es false con birthDate vacío` ✓
  - `canAdvance() es false con alumno menor de 17 años` ✓
  - `canAdvance() es false con alumno menor de 20 en flujo profesional` ✓
  - `canAdvance() es true con todos los campos válidos y edad >= 18` ✓

## Prioridad
**Alta** — datos corruptos (género siempre 'M') y riesgo legal (sin restricción de edad)

## Dependencias
- `validateRut()` → ya existe en `core/utils/rut.utils.ts`
- `validateEmail()` → ya existe en `core/utils/email.utils.ts`
- `calcAge()` → ya existe en `core/utils/age.utils.ts`
- `<app-email-input>` → ya existe en `shared/components/email-input/`
- Sin dependencias de BD ni migraciones
