-- ============================================================================
-- 05 — Pagos, Contabilidad y Finanzas (RF-026 a RF-040)
-- ============================================================================
-- Depende de: 01 (users, branches), 02 (enrollments), 03 (instructors), 04 (students)
-- ============================================================================

-- ============================================================================
-- SII_RECEIPTS — Boletas y facturas emitidas (RF-033)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sii_receipts (
  id                  SERIAL PRIMARY KEY,
  type                TEXT    NOT NULL DEFAULT 'boleta',  -- 'boleta' | 'factura'
  folio               INTEGER NOT NULL,
  amount              INTEGER NOT NULL,
  -- Desglose por concepto para cuadratura planilla
  amount_class_b      INTEGER NOT NULL DEFAULT 0,
  amount_class_a      INTEGER NOT NULL DEFAULT 0,         -- incluye todos los Profesionales
  amount_sensometry   INTEGER NOT NULL DEFAULT 0,
  amount_other        INTEGER NOT NULL DEFAULT 0,
  -- Constraint: desglose debe sumar el total
  CONSTRAINT chk_receipt_breakdown
    CHECK (amount_class_b + amount_class_a + amount_sensometry + amount_other = amount),
  issued_at           TIMESTAMPTZ,
  status              TEXT,                                -- 'issued' | 'cancelled'
  recipient_tax_id    TEXT,                                -- RUT del receptor
  recipient_name      TEXT,
  branch_id           INT    REFERENCES branches(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(type, folio, branch_id)
);

COMMENT ON TABLE sii_receipts IS 'Boletas y facturas SII con desglose por concepto para cuadratura (RF-033)';

-- ============================================================================
-- PAYMENTS — Ingresos por matrícula y servicios (RF-026, RF-027)
-- ============================================================================
CREATE TABLE IF NOT EXISTS payments (
  id                SERIAL PRIMARY KEY,
  enrollment_id     INT    NOT NULL REFERENCES enrollments(id),
  type              TEXT,                    -- 'enrollment' | 'monthly_fee' | 'complement' | 'special_service'
  document_number   TEXT,                    -- N° voucher / transferencia / cheque (RF-027)
  total_amount      INTEGER NOT NULL,
  cash_amount       INTEGER DEFAULT 0,
  transfer_amount   INTEGER DEFAULT 0,
  card_amount       INTEGER DEFAULT 0,
  voucher_amount    INTEGER DEFAULT 0,
  status            TEXT,                    -- 'paid' | 'pending' | 'partial'
  payment_date      DATE,
  receipt_url       TEXT,
  requires_receipt  BOOLEAN DEFAULT true,    -- RF-033: "Falta Boleta"
  receipt_id        INT    REFERENCES sii_receipts(id),
  registered_by     INT    REFERENCES users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE payments IS 'Pagos por matrícula y servicios: efectivo, voucher, transferencia, tarjeta (RF-026, RF-027)';

-- Constraint: monto positivo
ALTER TABLE payments ADD CONSTRAINT chk_positive_amount
  CHECK (total_amount > 0);

-- ============================================================================
-- PAYMENT_DENOMINATIONS — Desglose de billetes y monedas (Módulo 4)
-- ============================================================================
-- Solo cuando payments.cash_amount > 0.
CREATE TABLE IF NOT EXISTS payment_denominations (
  id            SERIAL PRIMARY KEY,
  payment_id    INT      NOT NULL REFERENCES payments(id),
  denomination  INTEGER  NOT NULL,
  quantity      SMALLINT NOT NULL CHECK (quantity > 0),
  created_at    TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT chk_valid_denomination
    CHECK (denomination IN (20000, 10000, 5000, 2000, 1000, 500, 100, 50, 10)),
  UNIQUE(payment_id, denomination)
);

COMMENT ON TABLE payment_denominations IS 'Desglose de billetes y monedas por transacción en efectivo';

-- ============================================================================
-- EXPENSES — Gastos categorizados (RF-028)
-- ============================================================================
CREATE TABLE IF NOT EXISTS expenses (
  id              SERIAL PRIMARY KEY,
  branch_id       INT    REFERENCES branches(id),
  category        TEXT,                      -- 'fuel' | 'rent' | 'cleaning' | 'materials' | 'other'
  description     TEXT   NOT NULL,
  amount          INTEGER NOT NULL,
  date            DATE   NOT NULL,
  receipt_url     TEXT,
  registered_by   INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE expenses IS 'Gastos categorizados de la escuela (RF-028)';

-- ============================================================================
-- CASH_CLOSINGS — Cuadratura diaria (RF-029, RF-032)
-- ============================================================================
CREATE TABLE IF NOT EXISTS cash_closings (
  id                SERIAL PRIMARY KEY,
  branch_id         INT    REFERENCES branches(id),
  date              DATE   NOT NULL,
  -- Totales por método de pago (ingresos del día)
  cash_amount       INTEGER DEFAULT 0,
  transfer_amount   INTEGER DEFAULT 0,
  card_amount       INTEGER DEFAULT 0,
  voucher_amount    INTEGER DEFAULT 0,
  total_income      INTEGER,
  total_expenses    INTEGER,
  balance           INTEGER,                 -- RF-029: Ingresos Cash − Gastos Cash
  payments_count    INTEGER,
  -- Arqueo de caja física
  qty_bill_20000    SMALLINT DEFAULT 0,
  qty_bill_10000    SMALLINT DEFAULT 0,
  qty_bill_5000     SMALLINT DEFAULT 0,
  qty_bill_2000     SMALLINT DEFAULT 0,
  qty_bill_1000     SMALLINT DEFAULT 0,
  qty_coin_500      SMALLINT DEFAULT 0,
  qty_coin_100      SMALLINT DEFAULT 0,
  qty_coin_50       SMALLINT DEFAULT 0,
  qty_coin_10       SMALLINT DEFAULT 0,
  arqueo_amount     INTEGER,                 -- total contado físico
  difference        INTEGER,                 -- arqueo_amount − balance
  -- Estado del cierre
  status            TEXT DEFAULT 'open',     -- 'open' | 'closed' | 'descuadre'
  closed            BOOLEAN DEFAULT false,   -- RF-037: bloquea edición
  closed_by         INT    REFERENCES users(id),
  closed_at         TIMESTAMPTZ,
  notes             TEXT,                    -- justificación cuando descuadre

  -- Constraint: arqueo_amount coincide con suma de denominaciones
  CONSTRAINT chk_arqueo_amount
    CHECK (arqueo_amount IS NULL OR
           arqueo_amount = (qty_bill_20000*20000 + qty_bill_10000*10000 + qty_bill_5000*5000 +
                            qty_bill_2000*2000   + qty_bill_1000*1000   +
                            qty_coin_500*500     + qty_coin_100*100     +
                            qty_coin_50*50       + qty_coin_10*10)),
  -- Una sola cuadratura por sede y día
  UNIQUE(branch_id, date)
);

COMMENT ON TABLE cash_closings IS 'Cuadratura diaria con arqueo físico de billetes/monedas (RF-029, RF-032, RF-037)';

-- ============================================================================
-- INSTRUCTOR_ADVANCES — Anticipos a instructores (RF-038)
-- ============================================================================
CREATE TABLE IF NOT EXISTS instructor_advances (
  id              SERIAL PRIMARY KEY,
  instructor_id   INT    NOT NULL REFERENCES instructors(id),
  date            DATE   NOT NULL,
  amount          INTEGER NOT NULL,
  reason          TEXT,                      -- 'salary' | 'allowance' | 'materials' | 'other'
  description     TEXT,
  status          TEXT,                      -- 'pending' | 'deducted'
  deducted_on     DATE,
  registered_by   INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE instructor_advances IS 'Cuenta corriente interna de anticipos a instructores (RF-038)';

-- ============================================================================
-- INSTRUCTOR_MONTHLY_PAYMENTS — Liquidación mensual instructores (RF-038)
-- ============================================================================
CREATE TABLE IF NOT EXISTS instructor_monthly_payments (
  id                  SERIAL PRIMARY KEY,
  instructor_id       INT    NOT NULL REFERENCES instructors(id),
  period              TEXT   NOT NULL,           -- "2026-03"
  base_salary         INTEGER NOT NULL,          -- horas × tarifa
  advances_deducted   INTEGER NOT NULL DEFAULT 0,
  net_payment         INTEGER NOT NULL,          -- base_salary − advances_deducted
  payment_status      TEXT    DEFAULT 'pending', -- 'pending' | 'paid'
  paid_at             TIMESTAMPTZ,
  paid_by             INT    REFERENCES users(id),
  notes               TEXT,

  CONSTRAINT chk_net_payment
    CHECK (net_payment = base_salary - advances_deducted),
  UNIQUE(instructor_id, period)
);

COMMENT ON TABLE instructor_monthly_payments IS 'Liquidación mensual: base_salary − anticipos = net_payment (RF-038)';

-- ============================================================================
-- SERVICE_CATALOG — Catálogo de servicios especiales (RF-034)
-- ============================================================================
CREATE TABLE IF NOT EXISTS service_catalog (
  id          SERIAL PRIMARY KEY,
  name        TEXT    NOT NULL,              -- 'Examen Psicotécnico' | 'Arriendo Maquinaria' | etc.
  description TEXT,
  base_price  INTEGER NOT NULL,              -- precio base en CLP
  active      BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE service_catalog IS 'Catálogo dinámico de servicios especiales con precio configurable (RF-034)';

-- ============================================================================
-- SPECIAL_SERVICE_SALES — Venta de servicios especiales (RF-034)
-- ============================================================================
CREATE TABLE IF NOT EXISTS special_service_sales (
  id              SERIAL PRIMARY KEY,
  student_id      INT    NOT NULL REFERENCES students(id),
  service_id      INT    NOT NULL REFERENCES service_catalog(id),
  sale_date       DATE   NOT NULL,
  price           INTEGER NOT NULL,
  metadata        JSONB,                     -- datos variables por tipo de servicio
  registered_by   INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE special_service_sales IS 'Venta individual de servicios especiales con metadata variable por tipo (RF-034)';

-- ============================================================================
-- STANDALONE_COURSES — Cursos singulares grupales (RF-035)
-- ============================================================================
CREATE TABLE IF NOT EXISTS standalone_courses (
  id              SERIAL PRIMARY KEY,
  name            TEXT    NOT NULL,          -- "Operador de Grúa Horquilla" etc.
  type            TEXT    NOT NULL,          -- 'sence' | 'particular'
  billing_type    TEXT    NOT NULL,          -- 'sence_franchise' | 'boleta' | 'factura'
  base_price      INTEGER NOT NULL,
  duration_hours  INTEGER NOT NULL,
  max_students    SMALLINT NOT NULL,
  start_date      DATE    NOT NULL,
  end_date        DATE,
  status          TEXT,                      -- 'upcoming' | 'active' | 'completed' | 'cancelled'
  branch_id       INT    REFERENCES branches(id),
  registered_by   INT    REFERENCES users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE standalone_courses IS 'Cursos singulares grupales: SENCE, Grúa, Retroexcavadora, Maquinaria (RF-035)';

-- ============================================================================
-- STANDALONE_COURSE_ENROLLMENTS — Inscripción a cursos singulares (RF-035)
-- ============================================================================
-- Nota: certificate_id referencia certificates (creada en 08), FK agregada allí.
CREATE TABLE IF NOT EXISTS standalone_course_enrollments (
  id                      SERIAL PRIMARY KEY,
  standalone_course_id    INT    NOT NULL REFERENCES standalone_courses(id),
  student_id              INT    NOT NULL REFERENCES students(id),
  amount_paid             INTEGER NOT NULL,
  payment_status          TEXT,              -- 'paid' | 'pending' | 'partial'
  certificate_id          INT,               -- FK a certificates(id) se agrega en 08
  registered_by           INT    REFERENCES users(id),
  enrolled_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(standalone_course_id, student_id)
);

COMMENT ON TABLE standalone_course_enrollments IS 'Inscripción individual a cursos singulares grupales (RF-035)';
