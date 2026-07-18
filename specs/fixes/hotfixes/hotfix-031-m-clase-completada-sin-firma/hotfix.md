# Hotfix: Clase finalizada sin firmas no se ve visualmente completada

## Problema
En la vista de detalle del alumno (`admin-alumno-detalle.component.ts`), tanto
la card "Clases Prácticas" como la "Ficha Técnica" determinan el estado visual
de cada clase a partir del flag `completada` calculado en
`admin-alumno-detalle.facade.ts:665`:

```ts
completada: !!(ses.student_signature && ses.instructor_signature),
```

Es decir, "completada" dependía exclusivamente de que **ambas firmas**
estuvieran presentes, ignorando `ses.status`. Pero al finalizar una clase
(`asistencia-clase-b.facade.ts:344`, método que registra km_end/grade/checklist)
se setea `status: 'completed'` y las firmas son opcionales — no se exigen para
finalizar. Resultado: una clase ya dictada, con km y observaciones registradas,
pero sin firma, se pintaba igual que una clase agendada a futuro (mismo
celeste/brand), sin ninguna señal visual de que ya ocurrió.

## Fix
Cambiar el criterio de `completada` para que se base en el estado real de la
sesión en BD (`ses.status === 'completed'`) en lugar de las firmas, que son un
dato administrativo aparte y no determinan si la clase se dictó.

## AC
- Una clase con `status = 'completed'` en `class_b_sessions` se muestra en
  verde/completada en la card "Clases Prácticas" y en la Ficha Técnica, tenga
  o no firmas registradas.
- Las firmas (`alumnoFirmo`/`instructorFirmo`) se siguen exponiendo igual para
  quien los necesite mostrar aparte (ej. columna "Validación" en Ficha
  Técnica), sin cambios.

## Cierre
- `admin-alumno-detalle.facade.ts:665`: `completada` ahora es `ses.status === 'completed'` en vez de depender de ambas firmas.
- `admin-ficha-tecnica.component.ts`: agregada clase `.fila-completada` (tinte verde, mismo patrón que `.fila-ausente`/`.fila-cancelada`) para que las filas completadas se distingan visualmente de las agendadas/pendientes.
- Corregido el placeholder "Pendiente de sesión" (desktop) y "Sesión aún no realizada" (mobile) que aparecían incluso en clases ya completadas sin observaciones — ahora solo se muestran si la clase no está completada.
- `npm run test:ci` (admin-alumno-detalle.facade.spec.ts, 21 tests) y `tsc --noEmit` limpios.
