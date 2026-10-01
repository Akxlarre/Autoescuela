# Tasks 0047-b — RLS: aislamiento por sede para la secretaria (tablas del piloto)

> **Plan:** [plan.md](./plan.md) · **Spec:** [spec.md](./spec.md)
> **Created:** 2026-10-01

Sin cambios en `src/app`: solo migración SQL + test de RLS.

---

- [x] **T1** — Confirmar policies vigentes en la BD remota y medir la fuga actual
  - **AC ref:** contexto
  - **DoD:** `pg_policies` leído; fuga medida por impersonación (1.728 clases, 176/61 pagos, 4 ventas)

- [ ] **T2** — Test de RLS `supabase/tests/rls/0047-b-aislamiento-por-sede.sql`
  - **AC ref:** AC1–AC5, AC-E1..E3
  - **DoD:** corre contra la BD actual y **falla** (demuestra la fuga) antes de la migración

- [ ] **T3** — Migración `supabase/migrations/20261001150000_rls_aislamiento_por_sede.sql`
  - **AC ref:** AC1–AC6
  - **DoD:** helpers + 17 tablas; idempotente (`CREATE OR REPLACE`, `DROP POLICY IF EXISTS`)

- [ ] **T4** — Ensayo en `BEGIN; migración; test; ROLLBACK;` contra la BD remota
  - **AC ref:** AC1–AC6
  - **DoD:** test en verde dentro de la transacción; snapshot de `pg_policies` confirma AC6

- [ ] **T5** — Aplicar en la BD remota (requiere visto bueno del owner) y re-correr el test
  - **AC ref:** todos
  - **DoD:** migración aplicada y registrada; test en verde fuera de transacción

- [ ] **T6** — Índices y cierre: `indices/DATABASE.md` (policies), `indices/DOMAIN-GOTCHAS.md` si aplica, `acceptance.md`
