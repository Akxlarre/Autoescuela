# Asignación ASG-i-020 — `[disabled]="true"` en control reactivo dispara warning de Angular

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** hotfix
> **priority:** P3
> **created:** 2026-09-22
> **created_by:** i
> **claimed_by:** i
> **claimed_at:** 2026-09-24
> **resulting_track:** hotfix-006-i-disabled-attribute-reactive-form-configuracion-web

---

## Contexto / Objetivo

Encontrado durante el QA de `fix-037-i-qa-visual-piloto` (ASG-i-012). En
`general-tab.component.ts:81` (pestaña "General" de Configuración Web), un `<p-select
formControlName="theme">` usa `[disabled]="true"` en el atributo del template — Angular
recomienda fijar `disabled` en el `FormControl` (Reactive Forms), no en el template, y emite
un warning de consola en cada carga de la pestaña. Sin impacto funcional (el selector sí se ve
bloqueado).

## Alcance sugerido

Ver `specs/hotfixes/hotfix-006-i-disabled-attribute-reactive-form-configuracion-web/hotfix.md`
— quitar `[disabled]="true"` del template y crear/deshabilitar el `FormControl` de `theme` ya
deshabilitado en el `FormGroup` (o `.disable()` tras construirlo).

## Archivos involucrados

- `src/app/features/admin/configuracion-web/tabs/general-tab.component.ts`

## Notas para quien la reclame

El track `hotfix-006-i-disabled-attribute-reactive-form-configuracion-web` ya existe con el
diagnóstico completo. Hotfix trivial — buen candidato para alguien con poco tiempo disponible.
