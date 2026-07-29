# fix-026-m — Propagar `app-drawer-form` a drawers de solo lectura y especiales

## Contexto

fix-025 propagó el shell `app-drawer-form` a los 20 drawers de **formulario**,
pero dejó fuera intencionalmente los drawers de **solo lectura/datos** (ver-
detalle, agenda, pago-detalle, etc.) y un grupo de drawers "especiales"
(configurador-horarios, ajustes, pre-inscrito, iniciar/finalizar-clase). El
dueño pidió extender la unificación visual (superficie `bg-surface` tipo card,
cuerpo scrolleable, footer fijo si aplica) a esos drawers también — excepto
`iniciar-clase` y `finalizar-clase`, que quedan fuera por ahora.

## Cambio

Envolver el cuerpo de cada drawer listado en `<app-drawer-form>`:
- `[hasFooter]="false"` cuando el drawer no tiene acciones de footer (solo
  lectura pura).
- Footer proyectado (`ngProjectAs="[drawer-form-footer]"`) cuando el drawer sí
  tiene botones de acción (ej. cerrar, aprobar, guardar) que hoy viven sueltos
  en el template.

### Drawers de solo lectura / detalle

- [x] admin-instructor-ver-drawer
- [x] admin-promocion-ver-drawer
- [x] admin-relator-ver-drawer
- [x] admin-secretarias-ver-drawer
- [x] admin-curso-singular-detalle-drawer
- [x] admin-pago-detalle-drawer
- [x] agenda-slot-detail-drawer
- [x] student-drawer-detail
- [x] alerts-drawer
- [x] recent-activity-drawer
- [x] alumnos-por-vencer-drawer
- [x] admin-instructor-horas-drawer
- [x] admin-instructor-horario-drawer
- [x] vehicle-agenda-drawer
- [x] vehicle-documents-drawer

### Drawers "especiales" (antes marcados "evaluar aparte" en fix-025)

- [x] configurador-horarios-drawer
- [x] admin-pre-inscrito-drawer
- [x] ajustes-drawer

**Fuera de alcance (excluidos explícitamente por el dueño):** iniciar-clase,
finalizar-clase.

## Acceptance Criteria

- [x] Los 18 drawers listados usan `<app-drawer-form>` como wrapper de su
      contenido, preservando toda su funcionalidad actual.
- [x] `ng build` verde.
- [x] `npm run test:ci` sin regresiones nuevas (comparado con baseline de
      fix-025: 1081 pass / 1 fail preexistente en `auth.facade.spec`).

## Cierre

Los 18 drawers de solo lectura y especiales quedaron envueltos en
`app-drawer-form`, usando footer proyectado cuando había una acción única
clara (editar, cerrar, aplicar cambios) y `[hasFooter]="false"` en los de
lista/tabs/wizard sin footer canónico único (curso-singular-cobro/inscribir,
admin-sesion, admin-pre-inscrito, pago-detalle, curso-singular-detalle,
recent-activity, alerts, instructor-horas/horario). `ng build` verde;
`npm run test:ci` = 1081 pass / 1 fail preexistente sin relación
(`auth.facade.spec` timeout en `whenReady`, archivo no tocado). Quedan fuera
`iniciar-clase` y `finalizar-clase`, excluidos explícitamente por el dueño.
Verificación visual en `ng serve` pendiente (Playwright MCP inactivo en esta
máquina).
