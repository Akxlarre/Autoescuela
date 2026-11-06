# Tasks 0057-b — La disponibilidad de Clase B dice de qué sede es cada horario

## Progreso

- [x] Migración `20261106150000_spec0057b_disponibilidad_por_sede.sql` (copia de la vista de spec 0052-b + `branch_ids`)
- [x] Test SQL `supabase/tests/agenda/0057-b-disponibilidad-por-sede.sql`: 8/8 sobre una copia de la vista en producción, en una consulta revertida (AC1, AC2, AC3, AC5, AC-E1, AC-E2). Mismas filas que la vista actual a 30 días (0 diferencias)
- [x] AC9 medido sobre la copia, revertido: admin 28 días 682 vs 679 ms; secretaria semana 168 vs 169 ms (tras agrupar por `slot_status`, no por `is_available`)
- [x] Facades con TDD: Agenda (AC2–AC5), Enrollment (AC6), AdminAlumnoDetalle (AC7), PublicEnrollment (AC8, cliente)
- [x] Edge function `public-enrollment` → `load-schedule` filtra si llega `branchId` (AC8, servidor)
- [x] `npm run test:ci` (4666 ok; 1 intermitente ajeno, `instructor-clases`, 30/30 solo) y `npm run lint:arch` (0 errores)
- [x] Índices: `DATABASE.md`, `FACADES.md`
- [x] Migración aplicada en producción (2026-11-06, con confirmación del owner)
- [x] Test SQL sobre la vista real: 8/8, sin cambios residuales (0 instructores y 0 vehículos "Ambas")
- [x] Edge function `public-enrollment` desplegada (v75, 2026-11-06, CLI v2, `--no-verify-jwt` como antes). La llamada HTTP a `load-schedule` responde 503 porque la inscripción pública está cerrada a propósito (`PUBLIC_ENROLLMENT_ENABLED`, fix-193-b): el filtro se comprobó con la misma consulta en SQL (instructor 223 de la sede 1: 1071 bloques en la sede 1, 0 en la sede 2)
- [ ] e2e F08 en `agenda-4.spec.ts` → esperar 0 horarios en la sede 2 (el archivo vive en el PR #371, aún no en `main`)
- [x] Agenda como secretaria2: la consulta lleva `branch_ids=cs.{2}` → 200, consola sin errores, se ven los bloques de la sede
- [ ] Commit, PR y `acceptance.md`
