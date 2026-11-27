import { Timestamp } from 'firebase/firestore';

export type PaymentStatus = 'paid' | 'partial' | 'unpaid';

export type ActiveTab = 'ledger' | 'members' | 'reminders' | 'reports';

export interface UserFund {
  fundId: string;
  fundName: string;
  currency: string;
  reminderTemplate: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FamilyMember {
  id: string;
  fundId: string;
  name: string;
  phone: string;
  relation: string;
  monthlyAmount: number;
  startMonth: string; // YYYY-MM
  isActive: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface MonthlyPayment {
  id: string; // `${memberId}_${monthKey}`
  fundId: string;
  memberId: string;
  monthKey: string; // YYYY-MM
  expectedAmount: number;
  paidAmount: number;
  status: PaymentStatus;
  paidDate: string; // YYYY-MM-DD or ''
  note: string;
  lastRemindedAt?: Timestamp;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Verbatim validation constants synced with firebase-blueprint.json and firestore.rules
 */
export const FIELD_LIMITS = {
  FUND_ID_MIN: 6,
  FUND_ID_MAX: 64,
  FUND_NAME_MAX: 80,
  CURRENCY_MAX: 12,
  REMINDER_TEMPLATE_MAX: 600,
  MEMBER_NAME_MAX: 80,
  PHONE_MAX: 24,
  RELATION_MAX: 40,
  AMOUNT_MIN: 0,
  AMOUNT_MAX: 1000000,
  NOTE_MAX: 160,
} as const;

export const FIELD_PATTERNS = {
  ID: /^[a-zA-Z0-9_-]+$/,
  FUND_ID: /^[a-zA-Z0-9_-]{6,64}$/,
  MONTH_KEY: /^[0-9]{4}-(0[1-9]|1[0-2])$/,
  DATE_STR: /^(|[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01]))$/,
  PHONE: /^[0-9+\-\s()]{0,24}$/,
} as const;

export const DEFAULT_FUND_ID = 'family_fund_main';
export const FUND_ID_STORAGE_KEY = 'family_fund_workspace_id';

export const DEFAULT_REMINDER_TEMPLATE =
  'السلام عليكم {الاسم}،\nنود تذكيرك بلطف باشتراك {اسم_الصندوق} لشهر {الشهر}.\nالمبلغ المقرر: {المبلغ_المقرر}\nالمتبقي للدفع: {المتبقي}\nجزاك الله خيراً على التزامك وتعاونك.';

export const FIXED_CURRENCY = 'د.ب';
export const FIXED_CURRENCY_LABEL = 'دينار بحريني (د.ب)';
