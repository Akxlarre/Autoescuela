export interface FixedExpense {
  id: number;
  branch_id?: number | null;
  category: 'salary' | 'utility' | 'insurance' | 'repair' | 'rent' | 'other';
  description: string;
  amount: number;
  date: string; // DATE → ISO string YYYY-MM-DD
  created_by?: number | null;
  created_at: string;
}
