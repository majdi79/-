import { FamilyMember, MonthlyPayment, PaymentStatus } from '../types';

export const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

export function getCurrentMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addMonths(monthKey: string, delta: number): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const date = new Date(year, month + delta, 1);
  const nextY = date.getFullYear();
  const nextM = String(date.getMonth() + 1).padStart(2, '0');
  return `${nextY}-${nextM}`;
}

export function formatMonthArabic(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const monthIndex = Number(monthStr) - 1;
  if (monthIndex < 0 || monthIndex > 11 || !yearStr) {
    return monthKey;
  }
  return `${ARABIC_MONTHS[monthIndex]} ${yearStr}`;
}

export function getMonthsBetween(fromMonth: string, toMonth: string): string[] {
  if (!fromMonth || !toMonth) return [];
  const start = fromMonth <= toMonth ? fromMonth : toMonth;
  const end = fromMonth <= toMonth ? toMonth : fromMonth;
  const months: string[] = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 120) {
    months.push(cursor);
    cursor = addMonths(cursor, 1);
    guard += 1;
  }
  return months;
}

export function formatNumber(amount: number): string {
  const rounded = Math.round(amount * 1000) / 1000;
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: Number.isInteger(rounded) ? 0 : 3,
    maximumFractionDigits: 3,
  }).format(rounded);
}

export function formatAmount(amount: number, currency: string): string {
  return `${formatNumber(amount)} ${currency}`;
}

/**
 * Strips formatting from a phone number to produce digits suitable for https://wa.me/<digits>
 */
export function sanitizePhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1);
  }
  return cleaned.replace(/\D/g, '');
}

/**
 * Cleans user phone input to match Firestore pattern ^[0-9+\-\s()]{0,24}$
 */
export function normalizePhoneInput(raw: string): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const normalized = raw.replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)));
  return normalized.replace(/[^0-9+\-\s()]/g, '').slice(0, 24).trim();
}

export function computePaymentStatus(paidAmount: number, expectedAmount: number): PaymentStatus {
  if (expectedAmount <= 0) {
    return paidAmount > 0 ? 'paid' : 'paid';
  }
  if (paidAmount >= expectedAmount) return 'paid';
  if (paidAmount > 0) return 'partial';
  return 'unpaid';
}

export function getStatusLabelArabic(status: PaymentStatus): string {
  switch (status) {
    case 'paid':
      return 'مدفوع';
    case 'partial':
      return 'دفع جزئي';
    case 'unpaid':
      return 'لم يدفع';
  }
}

export interface ResolvedMonthEntry {
  member: FamilyMember;
  monthKey: string;
  payment?: MonthlyPayment;
  expectedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: PaymentStatus;
  paidDate: string;
  note: string;
}

/**
 * Determines whether a member should appear in a specific month's billing calculations.
 * A member appears if they have an existing payment record for that month, OR if they are active and started on or before that month.
 */
export function isMemberApplicableForMonth(
  member: FamilyMember,
  monthKey: string,
  payment?: MonthlyPayment
): boolean {
  if (payment) return true;
  if (!member.isActive) return false;
  return member.startMonth <= monthKey;
}

export function resolveMemberMonthEntry(
  member: FamilyMember,
  monthKey: string,
  payment?: MonthlyPayment
): ResolvedMonthEntry {
  const expectedAmount = payment ? payment.expectedAmount : member.monthlyAmount;
  const paidAmount = payment ? payment.paidAmount : 0;
  const remainingAmount = Math.max(0, Math.round((expectedAmount - paidAmount) * 1000) / 1000);
  const status: PaymentStatus = payment
    ? payment.status
    : expectedAmount <= 0
      ? 'paid'
      : 'unpaid';

  return {
    member,
    monthKey,
    payment,
    expectedAmount,
    paidAmount,
    remainingAmount,
    status,
    paidDate: payment?.paidDate ?? '',
    note: payment?.note ?? '',
  };
}

export function formatShortDateArabic(isoDate: string): string {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const [y, m, d] = parts;
  const monthIdx = Number(m) - 1;
  if (monthIdx < 0 || monthIdx > 11) return isoDate;
  return `${Number(d)} ${ARABIC_MONTHS[monthIdx]} ${y}`;
}
