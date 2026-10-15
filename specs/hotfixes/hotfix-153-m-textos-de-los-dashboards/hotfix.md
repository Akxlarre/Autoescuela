# Hotfix: textos de los dashboards que no dicen lo que el dato mide
> id: hotfix-153-m-textos-de-los-dashboards
> refs: fix-395-m-testing-dashboards (casos Q11, H06, G04; sospechas S17c, S18)
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Problema
1. La alerta "N alumnos con deuda mayor a 2 meses — Tienen saldo pendiente con más de 60 días sin
   pagar" no mide días sin pagar: cuenta matrículas activas con saldo creadas hace más de 60 días.
   Un alumno que abonó ayer aparece igual.
2. En el Dashboard ejecutivo, los estados vacíos de "Cartera por cobrar" y "Horas de instrucción"
   dicen "en esta sede" también cuando el admin está en "Todas las sedes".

## Cambios
- **Archivo:** `src/app/core/facades/dashboard-alerts.facade.ts` — título y descripción de la alerta dicen lo que mide (matrículas de más de 60 días con saldo)
- **Archivo:** `src/app/shared/components/receivables-aging-panel/receivables-aging-panel.component.ts` — estado vacío sin "en esta sede"
- **Archivo:** `src/app/shared/components/instructor-hours-table/instructor-hours-table.component.ts` — estado vacío sin "en esta sede"
- **Archivo:** specs de esos archivos, si citan el texto

## Verificación
- [x] Tests de los archivos tocados en verde
