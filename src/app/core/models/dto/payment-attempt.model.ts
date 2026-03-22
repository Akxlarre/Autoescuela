export type PaymentAttemptStatus = 'pending' | 'confirmed' | 'failed';

export interface PaymentAttempt {
  id: number;
  session_token: string;
  status: PaymentAttemptStatus;
  draft_snapshot: Record<string, unknown>;
  enrollment_id: number | null;
  transbank_token: string | null;
  created_at: string;
  expires_at: string;
}
