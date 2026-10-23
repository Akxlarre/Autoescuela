# Hotfix: La autorización del certificado médico se reinicia al cambiar de tipo o matrícula
> id: hotfix-164-m-autorizacion-certificado-medico-se-reinicia
> refs: fix-447-m-testing-documentos-certificacion (E05)
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Problema
En "Subir documento", la casilla "El alumno autoriza expresamente…" (Ley 21.719, Art. 16) quedaba
marcada al cambiar a otro tipo y volver a Certificado Médico, o al cambiar de alumno o de
matrícula: la autorización de un alumno podía terminar usándose para otro, y el consentimiento
debe ser un acto afirmativo para ese documento (caso E05).

## Cambios
- **Archivo:** `src/app/features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.ts`
  — un `effect()` desmarca la casilla cada vez que cambian el tipo, el alumno o la matrícula.
  Verificado en navegador.
