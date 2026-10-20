# Hotfix: El correo del certificado usa el nombre y los colores de la sede
> id: hotfix-159-m-correo-certificado-con-nombre-de-la-sede
> refs: fix-447-m-testing-documentos-certificacion (S13)
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Problema
`send-certificate-email` decía "Conductores Chillán" fijo (encabezado, pie y copyright) y usaba
siempre los colores azules, para alumnos de cualquier sede. El correo del contrato
(`send-enrollment-contract-email`) ya toma el nombre y el tema de `website_config` de la sede de
la matrícula.

Decisión de Matías (2026-10-20): el logo del PDF del certificado se mantiene igual para ambas
sedes; no se toca.

## Cambios
- **Archivo:** `supabase/functions/send-certificate-email/index.ts` — lee `branch_id` de la
  matrícula y la marca de `website_config`; nombre, iniciales y gradiente del encabezado salen de
  ahí (helpers de `_shared/contract-email.ts`). El nombre del alumno se escapa. Requiere deploy.
