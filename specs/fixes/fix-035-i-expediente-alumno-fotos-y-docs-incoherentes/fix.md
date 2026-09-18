# Fix: Expediente de alumno no detecta la foto de matrícula actual y exige documentos que nunca se piden
> id: fix-035-i-expediente-alumno-fotos-y-docs-incoherentes
> refs: —
> status: done
> closed: 2026-09-18
> created: 2026-09-18

## Root Cause

`getExpedienteStatus()` (`core/utils/alumno-status.utils.ts`) calcula el badge
"Completo/Parcial/Pendiente · n/4" de la Base de Alumnos contando 4 documentos
(`ci`, `foto`, `medico`, `semep`), derivados en `AdminAlumnosFacade.deriveExpediente()`
(`core/facades/admin-alumnos.facade.ts:562-570`) comparando `student_documents.type`
contra 4 claves fijas. Dos de esas claves ya no corresponden a lo que el sistema
realmente pide o permite subir hoy:

1. **`foto` compara contra `'foto_carnet'`, una clave legacy.** El wizard de matrícula
   actual (`secretaria-matricula.component.ts:684`, y el flujo público) guarda la foto
   del carnet con el tipo **`'id_photo'`** (confirmado en `dms.facade.ts:32`, que ya
   documenta `foto_carnet` como `'Foto Carnet (legacy)'`, `dms.facade.ts:46`). Resultado:
   un alumno matriculado hoy con foto **siempre** muestra `Foto: No`, porque
   `deriveExpediente()` nunca mira la clave que el sistema realmente usa.

2. **`medico` y `semep` cuentan como documentos requeridos, pero ninguno de los dos se
   pide durante la matrícula, y no siempre son obtenibles después:**
   - Certificado médico: el propio código lo documenta como excepción —
     `dms-upload-drawer.component.ts:358-360`: *"Este es el ÚNICO punto de la app por
     donde entra: no se pide en la matrícula, solo llega cuando un alumno justifica
     inasistencias (confirmado por el dueño, 17-08-2026)"*. Es decir, es un documento
     **situacional**, no parte del expediente de ingreso.
   - SEMEP: `'semep'` ni siquiera aparece en `studentDocTypes` de
     `dms-upload-drawer.component.ts:387-395` (la lista de tipos de documento que se
     pueden subir manualmente para un alumno) — no existe ningún punto de la UI donde
     alguien pueda subir un documento con `type: 'semep'` para un alumno. Es una
     etiqueta huérfana en `LABELS_TIPO_ALUMNO` (`dms.facade.ts:38`) que se confunde con
     `credencial_semep`, que es un documento de **instructor**
     (`instructor-doc-types.util.ts:12`), no de alumno.

   Consecuencia combinada: ningún alumno matriculado por el flujo normal puede llegar
   nunca a "Completo" — el badge queda en rojo/"Pendiente" o "Parcial" de forma
   permanente y engañosa, independientemente de que la secretaria haya subido todo lo
   que el sistema realmente le pidió.

## ACs Afectados

Ninguno — fix autónomo (bug reportado directamente sobre la Base de Alumnos en
producción, sin spec asociada).

## Cambio

- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts` — `deriveExpediente()`:
  detectar la foto vía `types.has('id_photo')` (clave actual), manteniendo
  `types.has('foto_carnet')` como fallback para no perder el estado de alumnos antiguos
  matriculados antes del rename.
- **Archivo:** `src/app/core/utils/alumno-status.utils.ts` — `getExpedienteStatus()`:
  el estado Completo/Parcial/Pendiente y el conteo `n/2` se calculan solo sobre `ci` y
  `foto` — los dos únicos documentos que el sistema efectivamente puede pedir/registrar
  para **todo** alumno en el flujo de matrícula. `medico` y `semep` dejan de contar para
  el estado y el denominador, pero se preservan en `AlumnoExpediente` y se siguen
  mostrando como información adicional donde ya se listan (tooltips de
  `alumno-card.component.ts` y `alumnos-list-content.component.ts`) sin afectar el
  badge — siguen siendo datos útiles para la secretaria (ej. si un alumno ya justificó
  una inasistencia con médico), solo dejan de ser parte de la promesa "expediente
  completo".
- Fuera de alcance: no se toca `AlumnoExpediente` (sigue con los 4 campos, para no
  romper los consumidores que ya leen `.medico`/`.semep` individualmente), ni el DMS de
  subida manual, ni la etiqueta huérfana `semep` en `LABELS_TIPO_ALUMNO` (limpieza de
  copy no relacionada con este bug).

## Test de Regresión

- `src/app/core/utils/alumno-status.utils.spec.ts`: actualizar `getExpedienteStatus()`
  para reflejar que el cálculo es sobre 2 documentos (`ci`, `foto`), no 4 — casos
  Completo (ambos true), Pendiente (ambos false), Parcial (uno true). Casos nuevos:
  `medico`/`semep` en `true` o `false` no cambian el resultado cuando `ci`+`foto` ya
  están completos (label sigue "Completo", count sigue "2/2").
- `src/app/core/facades/admin-alumnos.facade.spec.ts`: test nuevo que confirma que un
  alumno con un documento `type: 'id_photo'` en `student_documents` resulta en
  `expediente.foto === true` (regresión directa del bug reportado), y que uno con
  `type: 'foto_carnet'` (legacy) también sigue resultando en `true`.
- `npm run test:ci` completo debe quedar verde.

## Evidencia de Verificación (2026-09-18)

- `alumno-status.utils.spec.ts` y `admin-alumnos.facade.spec.ts` (34 tests, incluyendo
  los 8 nuevos/actualizados de este fix): **PASS**.
- `npm run test:ci` completo: **2508 tests passed**, 5 skipped (no relacionados), 0
  failed. Sin regresiones en otros consumidores de `AlumnoExpediente`
  (`alumno-card.component.ts`, `alumnos-list-content.component.ts`, drawers de "Por
  Vencer").
- QA visual en navegador no se ejecutó en esta sesión (el usuario tomó el control del
  servidor de desarrollo local para seguir trabajando desde su propia terminal); la
  corrección queda validada por los tests unitarios de `deriveExpediente()` (clave
  `id_photo` + fallback `foto_carnet`) y de `getExpedienteStatus()` (denominador 2,
  `medico`/`semep` ya no afectan el resultado).
