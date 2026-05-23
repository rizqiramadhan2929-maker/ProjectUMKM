export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  timestamp: string; // ISO string
  description: string;
  amount: number;
  type: TransactionType;
  category: string;
  isDraft: boolean; // True if it's from rapid numpad entry
  source: 'manual' | 'numpad_draft' | 'chat_bot' | 'shortcut';
}

export interface ShortcutWidget {
  id: string;
  label: string;
  amount: number;
  type: TransactionType;
  category: string;
}

export interface ReconciliationRecord {
  id: string;
  timestamp: string;
  expectedBalance: number;
  actualBalance: number;
  discrepancy: number; // actual - expected
  status: 'match' | 'surplus' | 'short';
  denom100k: number;
  denom50k: number;
  denom20k: number;
  denom10k: number;
  denom5k: number;
  denom2k: number;
  denom1k: number;
  denomCoin: number;
}

export interface ChangeSuggestion {
  denom: string;
  value: number;
  count: number;
  reason: string;
}

export interface ChangeFloatAdvice {
  id: string;
  timestamp: string;
  totalNeeded: number;
  suggestions: ChangeSuggestion[];
  aiAnalysis: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  parsedTransaction?: {
    description: string;
    amount: number;
    type: TransactionType;
    category: string;
  };
}
