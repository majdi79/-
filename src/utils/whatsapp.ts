import { FamilyMember } from '../types';
import {
  formatAmount,
  formatMonthArabic,
  getStatusLabelArabic,
  ResolvedMonthEntry,
  sanitizePhoneForWhatsApp,
} from './format';

export function getWhatsAppUrl(message: string, phone?: string): string {
  const encoded = encodeURIComponent(message);
  if (phone) {
    const digits = sanitizePhoneForWhatsApp(phone);
    if (digits.length >= 7) {
      return `https://wa.me/${digits}?text=${encoded}`;
    }
  }
  return `https://wa.me/?text=${encoded}`;
}

export function buildPersonalReminderMessage(params: {
  template: string;
  memberName: string;
  fundName: string;
  monthKey: string;
  expectedAmount: number;
  paidAmount: number;
  currency: string;
}): string {
  const remaining = Math.max(0, Math.round((params.expectedAmount - params.paidAmount) * 1000) / 1000);
  return params.template
    .replaceAll('{الاسم}', params.memberName)
    .replaceAll('{اسم_الصندوق}', params.fundName)
    .replaceAll('{الشهر}', formatMonthArabic(params.monthKey))
    .replaceAll('{المبلغ_المقرر}', formatAmount(params.expectedAmount, params.currency))
    .replaceAll('{المدفوع}', formatAmount(params.paidAmount, params.currency))
    .replaceAll('{المتبقي}', formatAmount(remaining, params.currency));
}

export function buildGroupUnpaidReminderMessage(params: {
  fundName: string;
  monthKey: string;
  entries: ResolvedMonthEntry[];
  currency: string;
}): string {
  const unpaidEntries = params.entries.filter((e) => e.remainingAmount > 0);
  const totalRemaining = unpaidEntries.reduce((sum, e) => sum + e.remainingAmount, 0);
  const lines: string[] = [
    `*تذكير باشتراكات ${params.fundName}*`,
    `الشهر: ${formatMonthArabic(params.monthKey)}`,
    '——————————————',
    'السلام عليكم جميعاً، تذكير لطيف للإخوة الذين لم يُكملوا اشتراك هذا الشهر:',
    '',
  ];

  unpaidEntries.forEach((entry, index) => {
    const statusNote =
      entry.status === 'partial'
        ? ` (متبقي ${formatAmount(entry.remainingAmount, params.currency)} من ${formatAmount(entry.expectedAmount, params.currency)})`
        : ` (${formatAmount(entry.remainingAmount, params.currency)})`;
    lines.push(`${index + 1}. ${entry.member.name}${statusNote}`);
  });

  lines.push('');
  lines.push(`*إجمالي المتبقي:* ${formatAmount(totalRemaining, params.currency)}`);
  lines.push('جزاكم الله خيراً وبارك فيكم.');
  return lines.join('\n');
}

export interface GroupPeriodMemberSummary {
  member: FamilyMember;
  monthsCount: number;
  paidMonthsCount: number;
  expectedTotal: number;
  paidTotal: number;
  remainingTotal: number;
}

export function buildGroupReportMessage(params: {
  fundName: string;
  fromMonth: string;
  toMonth: string;
  memberSummaries: GroupPeriodMemberSummary[];
  currency: string;
  includeUnpaidList: boolean;
  includePaidList: boolean;
}): string {
  const isSingleMonth = params.fromMonth === params.toMonth;
  const periodTitle = isSingleMonth
    ? `شهر ${formatMonthArabic(params.fromMonth)}`
    : `من ${formatMonthArabic(params.fromMonth)} إلى ${formatMonthArabic(params.toMonth)}`;

  const totalExpected = params.memberSummaries.reduce((s, r) => s + r.expectedTotal, 0);
  const totalPaid = params.memberSummaries.reduce((s, r) => s + r.paidTotal, 0);
  const totalRemaining = params.memberSummaries.reduce((s, r) => s + r.remainingTotal, 0);
  const rate = totalExpected > 0 ? Math.round((totalPaid / totalExpected) * 100) : 0;

  const fullyPaid = params.memberSummaries.filter((r) => r.remainingTotal <= 0 && r.expectedTotal > 0);
  const withBalance = params.memberSummaries.filter((r) => r.remainingTotal > 0);

  const lines: string[] = [
    `*تقرير ${params.fundName}*`,
    `الفترة: ${periodTitle}`,
    '——————————————',
    `*ملخص التحصيل:*`,
    `• إجمالي المطلوب: ${formatAmount(totalExpected, params.currency)}`,
    `• إجمالي المحصّل: ${formatAmount(totalPaid, params.currency)} (${rate}%)`,
    `• المتبقي: ${formatAmount(totalRemaining, params.currency)}`,
    `• الملتزمون بالكامل: ${fullyPaid.length} من ${params.memberSummaries.length}`,
  ];

  if (params.includePaidList && fullyPaid.length > 0) {
    lines.push('');
    lines.push(`*المسددون بالكامل (${fullyPaid.length}):*`);
    fullyPaid.forEach((row) => {
      lines.push(`✓ ${row.member.name} — ${formatAmount(row.paidTotal, params.currency)}`);
    });
  }

  if (params.includeUnpaidList && withBalance.length > 0) {
    lines.push('');
    lines.push(`*المتبقي عليهم (${withBalance.length}):*`);
    withBalance.forEach((row) => {
      const paidNote =
        row.paidTotal > 0
          ? `دفع ${formatAmount(row.paidTotal, params.currency)} · متبقي ${formatAmount(row.remainingTotal, params.currency)}`
          : `متبقي ${formatAmount(row.remainingTotal, params.currency)}`;
      lines.push(`• ${row.member.name} — ${paidNote}`);
    });
  }

  lines.push('——————————————');
  lines.push('شكراً لتعاون الجميع وبارك الله فيكم.');
  return lines.join('\n');
}

export function buildIndividualReportMessage(params: {
  fundName: string;
  member: FamilyMember;
  fromMonth: string;
  toMonth: string;
  entries: ResolvedMonthEntry[];
  currency: string;
}): string {
  const isSingleMonth = params.fromMonth === params.toMonth;
  const periodTitle = isSingleMonth
    ? `شهر ${formatMonthArabic(params.fromMonth)}`
    : `من ${formatMonthArabic(params.fromMonth)} إلى ${formatMonthArabic(params.toMonth)}`;

  const totalExpected = params.entries.reduce((s, e) => s + e.expectedAmount, 0);
  const totalPaid = params.entries.reduce((s, e) => s + e.paidAmount, 0);
  const totalRemaining = params.entries.reduce((s, e) => s + e.remainingAmount, 0);

  const lines: string[] = [
    `السلام عليكم *${params.member.name}*،`,
    `إليك كشف اشتراكاتك في *${params.fundName}*`,
    `الفترة: ${periodTitle}`,
    '——————————————',
    `• الاشتراك الشهري المقرر: ${formatAmount(params.member.monthlyAmount, params.currency)}`,
    `• إجمالي المطلوب للفترة: ${formatAmount(totalExpected, params.currency)}`,
    `• إجمالي المدفوع: ${formatAmount(totalPaid, params.currency)}`,
    `• الرصيد المتبقي: ${formatAmount(totalRemaining, params.currency)}`,
  ];

  if (params.entries.length > 0) {
    lines.push('');
    lines.push('*تفاصيل الأشهر:*');
    params.entries.forEach((entry) => {
      const marker = entry.status === 'paid' ? '✓' : entry.status === 'partial' ? '◐' : '○';
      const detail =
        entry.status === 'paid'
          ? `${formatAmount(entry.paidAmount, params.currency)} (${getStatusLabelArabic(entry.status)})`
          : entry.status === 'partial'
            ? `مدفوع ${formatAmount(entry.paidAmount, params.currency)} · متبقي ${formatAmount(entry.remainingAmount, params.currency)}`
            : `غير مدفوع (${formatAmount(entry.expectedAmount, params.currency)})`;
      lines.push(`${marker} ${formatMonthArabic(entry.monthKey)}: ${detail}`);
    });
  }

  lines.push('——————————————');
  lines.push(
    totalRemaining <= 0
      ? 'جميع اشتراكاتك مكتملة لهذه الفترة، جزاك الله خيراً.'
      : `المتبقي للسداد: ${formatAmount(totalRemaining, params.currency)}، شاكرين لك تعاونك الدائم.`
  );
  return lines.join('\n');
}
