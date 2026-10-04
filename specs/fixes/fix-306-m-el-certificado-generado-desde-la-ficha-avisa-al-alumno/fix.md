# Fix: El certificado generado desde la ficha avisa al alumno
> id: fix-306-m-el-certificado-generado-desde-la-ficha-avisa-al-alumno
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
`CertificacionClaseBFacade.generarCertificado()` avisa al alumno ("Tu certificado está listo",
Spec 0024 AC7) buscándolo en su propia lista (`_alumnos()`), que solo se carga al entrar a la
pantalla de Certificaciones B. La ficha del alumno llama al mismo método sin haber cargado esa
lista: el alumno no se encuentra y el aviso no se envía, sin error ni mensaje. El mismo certificado
avisa o no según desde qué pantalla se genere. Es el último punto de `024b` S10, confirmado en la
4ª pasada de `fix-264-m` (`024b` L07). Es B45.

## ACs Afectados
- `024b` L07 / Spec 0024 AC7: al generar el certificado desde la ficha, el alumno recibe el aviso.

## Cambio
- **Archivo:** `src/app/core/facades/certificacion-clase-b.facade.ts` — si la matrícula no está en
  la lista cargada, se consulta (alumno y curso) solo para armar el aviso. Sigue sin bloquear ni
  romper la generación si esa consulta o el aviso fallan.

## Test de Regresión
- `certificacion-clase-b.facade.spec.ts > notificaciones de certificado (Spec 0024, AC7) > fix-306-m: …` (2 tests) ✓
- `e2e/alumnos-b-ficha.spec.ts > cuarta pasada > L02 · L04 · L05 · L07` (falla antes del arreglo:
  0 avisos para el alumno) ✓
