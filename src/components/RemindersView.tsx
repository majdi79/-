import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Edit3,
  MessageCircle,
  SlidersHorizontal,
} from 'lucide-react';
import { FamilyMember, MonthlyPayment, UserFund } from '../types';
import {
  addMonths,
  formatAmount,
  formatMonthArabic,
  getStatusLabelArabic,
  isMemberApplicableForMonth,
  resolveMemberMonthEntry,
  ResolvedMonthEntry,
  sanitizePhoneForWhatsApp,
} from '../utils/format';
import {
  buildGroupUnpaidReminderMessage,
  buildPersonalReminderMessage,
  getWhatsAppUrl,
} from '../utils/whatsapp';

interface RemindersViewProps {
  fund: UserFund;
  members: FamilyMember[];
  payments: MonthlyPayment[];
  selectedMonth: string;
  onChangeMonth: (monthKey: string) => void;
  onLogReminder: (entry: ResolvedMonthEntry) => Promise<void>;
  onOpenEditMember: (member: FamilyMember) => void;
  onOpenSettings: () => void;
  onNotify: (msg: string) => void;
}

export const RemindersView: React.FC<RemindersViewProps> = ({
  fund,
  members,
  payments,
  selectedMonth,
  onChangeMonth,
  onLogReminder,
  onOpenEditMember,
  onOpenSettings,
  onNotify,
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const paymentMap = useMemo(() => {
    const map = new Map<string, MonthlyPayment>();
    payments.forEach((p) => {
      if (p.monthKey === selectedMonth) {
        map.set(p.memberId, p);
      }
    });
    return map;
  }, [payments, selectedMonth]);

  const unpaidEntries = useMemo(() => {
    return members
      .filter((m) => isMemberApplicableForMonth(m, selectedMonth, paymentMap.get(m.id)))
      .map((m) => resolveMemberMonthEntry(m, selectedMonth, paymentMap.get(m.id)))
      .filter((e) => e.remainingAmount > 0);
  }, [members, selectedMonth, paymentMap]);

  const totalRemaining = unpaidEntries.reduce((s, e) => s + e.remainingAmount, 0);

  const groupReminderMessage = useMemo(
    () =>
      buildGroupUnpaidReminderMessage({
        fundName: fund.fundName,
        monthKey: selectedMonth,
        entries: unpaidEntries,
        currency: fund.currency,
      }),
    [fund.fundName, fund.currency, selectedMonth, unpaidEntries]
  );

  const handleCopy = async (id: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      onNotify(label);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      onNotify('تعذّر النسخ التلقائي، يرجى النسخ يدوياً.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Month Switcher + Template Action */}
      <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChangeMonth(addMonths(selectedMonth, -1))}
            aria-label="الشهر السابق"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <h2 className="text-base sm:text-lg font-bold font-display text-slate-900 px-2 min-w-[140px] text-center">
            تذكيرات {formatMonthArabic(selectedMonth)}
          </h2>
          <button
            type="button"
            onClick={() => onChangeMonth(addMonths(selectedMonth, 1))}
            aria-label="الشهر التالي"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenSettings}
          className="h-10 px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>تعديل صيغة رسالة التذكير</span>
        </button>
      </div>

      {unpaidEntries.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-14 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto" />
          <h3 className="text-lg font-bold font-display text-slate-900">
            لا توجد مبالغ متبقية لشهر {formatMonthArabic(selectedMonth)}
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            جميع الأفراد المشمولين بهذا الشهر أتمّوا سداد اشتراكاتهم بالكامل.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 cols: Personal Reminders List */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold font-display text-slate-900">
                  تذكير فردي مباشر ({unpaidEntries.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  إجمالي المبالغ المتبقية:{' '}
                  <span className="font-mono font-semibold text-red-700 tabular-nums" dir="ltr">
                    {formatAmount(totalRemaining, fund.currency)}
                  </span>
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-200">
              {unpaidEntries.map((entry) => {
                const message = buildPersonalReminderMessage({
                  template: fund.reminderTemplate,
                  memberName: entry.member.name,
                  fundName: fund.fundName,
                  monthKey: selectedMonth,
                  expectedAmount: entry.expectedAmount,
                  paidAmount: entry.paidAmount,
                  currency: fund.currency,
                });
                const hasPhone = sanitizePhoneForWhatsApp(entry.member.phone).length >= 7;
                const waUrl = getWhatsAppUrl(message, entry.member.phone);
                const lastReminded = entry.payment?.lastRemindedAt
                  ? entry.payment.lastRemindedAt.toDate().toLocaleDateString('ar-SA', {
                      day: 'numeric',
                      month: 'short',
                    })
                  : null;

                return (
                  <div key={entry.member.id} className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-bold text-slate-900 truncate">
                          {entry.member.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          <span
                            className={`font-semibold ${
                              entry.status === 'partial' ? 'text-amber-700' : 'text-red-700'
                            }`}
                          >
                            {getStatusLabelArabic(entry.status)}
                          </span>
                          {entry.member.phone ? (
                            <>
                              {' · '}
                              <span dir="ltr" className="font-mono tabular-nums inline-block">
                                {entry.member.phone}
                              </span>
                            </>
                          ) : (
                            ' · بدون رقم واتساب'
                          )}
                          {lastReminded ? ` · آخر تذكير: ${lastReminded}` : ''}
                        </div>
                      </div>

                      <div className="text-left shrink-0" dir="ltr">
                        <div className="text-sm font-mono font-bold tabular-nums text-red-700">
                          {formatAmount(entry.remainingAmount, fund.currency)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {entry.status === 'partial'
                            ? `مدفوع ${formatAmount(entry.paidAmount, fund.currency)}`
                            : 'متبقي بالكامل'}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => void onLogReminder(entry)}
                        className="flex-1 sm:flex-initial min-h-[42px] px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                      >
                        <MessageCircle className="w-4 h-4 shrink-0" />
                        <span>{hasPhone ? 'إرسال تذكير واتساب' : 'فتح واتساب واختيار الرقم'}</span>
                      </a>

                      <button
                        type="button"
                        onClick={() =>
                          handleCopy(entry.member.id, message, `تم نسخ رسالة التذكير لـ ${entry.member.name}`)
                        }
                        className="min-h-[42px] px-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                      >
                        {copiedId === entry.member.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-700" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedId === entry.member.id ? 'تم النسخ' : 'نسخ النص'}</span>
                      </button>

                      {!hasPhone && (
                        <button
                          type="button"
                          onClick={() => onOpenEditMember(entry.member)}
                          className="min-h-[42px] px-3 text-xs font-medium text-teal-700 hover:underline inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>إضافة رقم</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 5 cols: Group Summary Reminder for Family WhatsApp Group */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-base font-bold font-display text-slate-900">
                تذكير جماعي لمجموعة العائلة
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                رسالة موحدة تعرض أسماء غير المسددين والمبالغ المتبقية لمشاركتها في قروب العائلة على واتساب.
              </p>
            </div>

            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-800 max-h-72 overflow-y-auto">
              {groupReminderMessage}
            </pre>

            <div className="flex flex-wrap items-center gap-2.5">
              <a
                href={getWhatsAppUrl(groupReminderMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[44px] px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>مشاركة في واتساب</span>
              </a>
              <button
                type="button"
                onClick={() => handleCopy('group', groupReminderMessage, 'تم نسخ التذكير الجماعي بنجاح.')}
                className="min-h-[44px] px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copiedId === 'group' ? (
                  <Check className="w-4 h-4 text-emerald-700" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                <span>{copiedId === 'group' ? 'تم النسخ' : 'نسخ'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
