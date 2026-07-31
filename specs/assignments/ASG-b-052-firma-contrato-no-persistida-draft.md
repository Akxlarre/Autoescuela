# Asignación ASG-b-052 — Firma del contrato no se persiste en el draft de matrícula pública

> **status:** completada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P3
> **created:** 2026-07-29
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-07-29
> **resulting_track:** fix-070-b-firma-contrato-no-persistida-draft

---

## Contexto / Objetivo

Hallazgo encontrado durante fix-069-b (H-033) al verificar en vivo el fix de "el draft
sobrevive a un pago rechazado": el objeto `PublicEnrollmentDraft` que persiste
`saveDraft()` en `public-enrollment.facade.ts` **no incluye `contractSignatureBase64`**.
Confirmado tanto leyendo el código como en un flujo real completo (formulario real, 12
clases reales, foto real, firma real, pago real cancelado en el sandbox de Transbank):
al reanudar la matrícula con `?resume=true&branchId=X`, el wizard aterriza correctamente
en el paso "Contrato" con nombre, curso, horario y foto intactos — pero el checkbox de
aceptación y la firma digital vuelven vacíos, obligando a firmar de nuevo.

No es tan grave como perder todo el draft (eso ya lo resolvió fix-069-b), pero sigue
siendo fricción evitable: el alumno ya firmó una vez y tiene que repetir el trámite.

## Alcance sugerido

- Agregar `contractSignatureBase64` (y el estado de "términos aceptados") al objeto que
  arma `saveDraft()` en `public-enrollment.facade.ts`.
- Restaurarlo en `restoreDraft()` para que el paso "Contrato" aparezca ya firmado si el
  alumno solo está reanudando tras un pago rechazado (no cambió nada del contrato).
- Ojo: si el alumno volvió atrás manualmente para revisar/editar algo (no vía resume),
  puede tener sentido pedir que reconfirme la firma — decidir si el comportamiento debe
  distinguir "resume tras rechazo" de "volver atrás dentro de la misma sesión".

## Referencias

- fix-069-b-matricula-publica-varios (`specs/fixes/fix-069-b-matricula-publica-varios/fix.md`)
  — sección "Hallazgos adicionales"
- `indices/FLOWS-QA-AUDIT.md` H-033 (causa raíz relacionada, ya resuelta)

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/public-enrollment.facade.ts` (`saveDraft()`, `restoreDraft()`,
  `PublicEnrollmentDraft` interface)

## Notas para quien la reclame

- No se investigó si guardar la firma en `localStorage` (potencialmente un blob base64
  de tamaño no trivial) es aceptable — puede valer la pena guardar solo un flag
  "ya firmó" + la firma real en el backend (`payment_attempts.draft_snapshot`, que ya
  existe según el comentario de `initiatePayment()`), en vez de duplicarla en el draft
  local.
