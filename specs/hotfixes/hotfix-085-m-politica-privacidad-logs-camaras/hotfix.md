# Hotfix: Política de privacidad — corregir logs de accesos falsos y agregar cámaras
> id: hotfix-085-m-politica-privacidad-logs-camaras
> refs: —
> status: done
> created: 2026-08-21

## Problema
`privacy-policy.model.ts` (contenido publicado al alumno) declara un "registro de accesos al
sistema, con fines de seguridad" que no existe: `audit_log.ip` y `digital_contracts.signature_ip`
son columnas declaradas desde el día uno que nadie escribe nunca (confirmado en
`20260817130000_consents_table_and_rls.sql:26`). Solo `consents.ip` se escribe realmente, atada a
un consentimiento puntual — que es justo lo que dicen los `.md` de `.compliance/`. Declarar un
control de seguridad que no existe viola el deber de veracidad/transparencia (Art. 4, Ley 21.719).

En paralelo, las cámaras de seguridad (que sí existen físicamente y ya están declaradas en el
código publicado) no aparecen en ningún documento de `.compliance/` (política, RAT, EIPD) — el
expediente legal está incompleto respecto de un tratamiento real.

## Cambios
- **Archivo:** `src/app/core/models/ui/privacy-policy.model.ts` — quitar el bullet de "registro de
  accesos al sistema" (dejar solo IP atada al consentimiento) y la fila de finalidad "Registrar
  accesos al sistema para detectar usos indebidos" en ambas sedes (CONDUCTORES y AUTOESCUELA);
  ajustar la fila de retención de IP en `RETENTION_SECTION` para que quede atada al plazo del
  consentimiento, igual que el `.md`. Subir `PRIVACY_POLICY_VERSION`.
- **Archivo:** `.compliance/docs/autoescuela/21719-politica-privacidad.md` — agregar bullet de
  cámaras de seguridad (dato, finalidad, base de licitud, retención 30 días, señalización).
- **Archivo:** `.compliance/docs/conductores/21719-politica-privacidad.md` — ídem.
- **Archivo:** `.compliance/docs/autoescuela/21719-rat.md` — agregar videovigilancia como
  actividad de tratamiento (interés legítimo, retención 30 días).
- **Archivo:** `.compliance/docs/conductores/21719-rat.md` — ídem.
- **Archivo:** `.compliance/docs/autoescuela/21719-eipd.md` — evaluar/anotar videovigilancia
  (riesgo bajo, sin biometría, señalizada — no requiere EIPD completa, pero debe listarse).
- **Archivo:** `.compliance/docs/conductores/21719-eipd.md` — ídem.
