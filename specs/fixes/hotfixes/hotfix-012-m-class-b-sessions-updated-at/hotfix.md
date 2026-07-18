# hotfix-012-m — class_b_sessions.updated_at nunca se refresca

## Problema
`class_b_sessions.updated_at` tiene `DEFAULT NOW()` pero ningún trigger la
actualiza en `UPDATE`, por lo que se queda congelada en el valor del INSERT
original sin importar cuántas veces se edite la fila.

## Causa raíz
Los triggers existentes sobre la tabla (`trg_audit_class_b_sessions` para
auditoría, `trg_class_b_sessions_monthly_hours` para recálculo de horas) no
tocan la columna `updated_at`. Nunca se creó el trigger genérico
`set_updated_at` para esta tabla (sí existe para `professional_promotions`
y `website_config`).

## Cambio
Nueva migración `supabase/migrations/20260709003142_fix_class_b_sessions_updated_at_trigger.sql`
que reutiliza `public.set_updated_at()`:
```sql
CREATE OR REPLACE TRIGGER trg_class_b_sessions_updated_at
  BEFORE UPDATE ON public.class_b_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

## Acceptance Criteria
- [x] Existe un trigger `BEFORE UPDATE` en `class_b_sessions` que setea `NEW.updated_at = now()`
- [x] La migración es idempotente (`CREATE OR REPLACE TRIGGER`)
