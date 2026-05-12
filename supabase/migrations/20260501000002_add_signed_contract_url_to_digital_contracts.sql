-- Agrega columna para almacenar el path del contrato FIRMADO en el bucket 'documents'.
-- Para matrículas presenciales, digital_contracts.file_url ya contiene el contrato firmado
-- (subido en el Paso 5 del wizard). Esta columna es para matrículas online donde el
-- contrato generado (file_url) puede ser firmado posteriormente y subido desde la ficha.
ALTER TABLE digital_contracts
  ADD COLUMN IF NOT EXISTS signed_contract_url TEXT;