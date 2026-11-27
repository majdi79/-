import React, { useMemo, useState } from 'react';
import { Check, Copy, MessageCircle, Printer, X } from 'lucide-react';
import { FamilyMember, MonthlyPayment, UserFund } from '../types';
import {
  addMonths,
  formatAmount,
  formatMonthArabic,
  formatShortDateArabic,
  getCurrentMonthKey,
  getMonthsBetween,
  getStatusLabelArabic,
  isMemberApplicableForMonth,
  resolveMemberMonthEntry,
  sanitizePhoneForWhatsApp,
} from '../utils/format';
import { buildIndividualReportMessage, getWhatsAppUrl } from '../utils/whatsapp';

interface MemberStatementModalProps {
  member: FamilyMember | null;
  fund: UserFund;
  payments: MonthlyPayment[];
  initialMonth: string;
  onClose: () => void;
  onNotify: (msg: string) => void;
}

export const MemberStatementModal: React.FC<MemberStatementModalProps> = ({
  member,
  fund,
  payments,
  initialMonth,
  onClose,
  onNotify,
}) => {
  const currentMonth = getCurrentMonthKey();
  const [fromMonth, setFromMonth] = useState(addMonths(initialMonth || currentMonth, -2));
  const [toMonth, setToMonth] = useState(initialMonth || currentMonth);
  const [copied, setCopied] = useState(false);

  const paymentByMonth = useMemo(() => {
    const map = new Map<string, MonthlyPayment>();
    if (!member) return map;
    payments.forEach((p) => {
      if (p.memberId === member.id) {
        map.set(p.monthKey, p);
      }
    });
    return map;
  }, [member, payments]);

  const entries = useMemo(() => {
    if (!member) return [];
    const months = getMonthsBetween(fromMonth, toMonth);
    return months
      .filter((m) => isMemberApplicableForMonth(member, m, paymentByMonth.get(m)))
      .map((m) => resolveMemberMonthEntry(member, m, paymentByMonth.get(m)));
  }, [member, fromMonth, toMonth, paymentByMonth]);

  if (!member) return null;

  const totalExpected = entries.reduce((sum, e) => sum + e.expectedAmount, 0);
  const totalPaid = entries.reduce((sum, e) => sum + e.paidAmount, 0);
  const totalRemaining = entries.reduce((sum, e) => sum + e.remainingAmount, 0);

  const message = buildIndividualReportMessage({
    fundName: fund.fundName,
    member,
    fromMonth,
    toMonth,
    entries,
    currency: fund.currency,
  });

  const hasValidPhone = sanitizePhoneForWhatsApp(member.phone).length >= 7;
  const whatsappUrl = getWhatsAppUrl(message, member.phone);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      onNotify('تم نسخ كشف حساب الفرد بنجاح.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('تعذّر النسخ التلقائي، يمكنك تحديد النص ونسخه يدوياً.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="statement-modal-title"
      >
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 no-print" />

        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 id="statement-modal-title" className="text-lg font-bold font-display text-slate-900 truncate">
              كشف حساب فردي — {member.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              المبلغ الشهري: <span className="font-mono tabular-nums">{formatAmount(member.monthlyAmount, fund.currency)}</span>
              {member.phone ? (
                <>
                  {' · '}
                  <span dir="ltr" className="font-mono tabular-nums inline-block">
                    {member.phone}
                  </span>
                </>
              ) : (
                ' · لا يوجد رقم واتساب مسجل'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer no-print"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Period Controls */}
          <div className="space-y-3 no-print">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFromMonth(currentMonth);
                  setToMonth(currentMonth);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                الشهر الحالي
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromMonth(addMonths(currentMonth, -2));
                  setToMonth(currentMonth);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                آخر 3 أشهر
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromMonth(addMonths(currentMonth, -5));
                  setToMonth(currentMonth);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                آخر 6 أشهر
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromMonth(member.startMonth);
                  setToMonth(currentMonth);
                }}
                className="px-3 py-1.5 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                منذ البداية
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">من شهر</label>
                <input
                  type="month"
                  value={fromMonth}
                  onChange={(e) => setFromMonth(e.target.value)}
                  dir="ltr"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">إلى شهر</label>
                <input
                  type="month"
                  value={toMonth}
                  onChange={(e) => setToMonth(e.target.value)}
                  dir="ltr"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                />
              </div>
            </div>
          </div>

          {/* Summary Strip */}
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-200 border border-slate-200 rounded-xl bg-slate-50">
            <div className="p-3.5 text-center">
              <p className="text-xs text-slate-500">المطلوب</p>
              <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-1" dir="ltr">
                {formatAmount(totalExpected, fund.currency)}
              </p>
            </div>
            <div className="p-3.5 text-center">
              <p className="text-xs text-slate-500">المدفوع</p>
              <p className="text-base font-bold font-mono tabular-nums text-emerald-700 mt-1" dir="ltr">
                {formatAmount(totalPaid, fund.currency)}
              </p>
            </div>
            <div className="p-3.5 text-center">
              <p className="text-xs text-slate-500">المتبقي</p>
              <p
                className={`text-base font-bold font-mono tabular-nums mt-1 ${
                  totalRemaining > 0 ? 'text-red-700' : 'text-slate-900'
                }`}
                dir="ltr"
              >
                {formatAmount(totalRemaining, fund.currency)}
              </p>
            </div>
          </div>

          {/* Chronological Month Table */}
          {entries.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-6 border border-slate-200 rounded-xl">
              لا توجد أشهر مستحقة لهذا الفرد ضمن الفترة المختارة (بداية الاشتراك: {formatMonthArabic(member.startMonth)}).
            </p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="text-right font-medium px-4 py-2.5">الشهر</th>
                    <th className="text-left font-medium px-3 py-2.5">المقرر</th>
                    <th className="text-left font-medium px-3 py-2.5">المدفوع</th>
                    <th className="text-right font-medium px-4 py-2.5">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {entries.map((e) => (
                    <tr key={e.monthKey} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-900 font-medium">
                        <div>{formatMonthArabic(e.monthKey)}</div>
                        {(e.paidDate || e.note) && (
                          <div className="text-xs text-slate-500 font-normal mt-0.5">
                            {[e.paidDate ? formatShortDateArabic(e.paidDate) : '', e.note]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-left font-mono tabular-nums text-slate-600" dir="ltr">
                        {formatAmount(e.expectedAmount, fund.currency)}
                      </td>
                      <td className="px-3 py-3 text-left font-mono tabular-nums font-semibold text-slate-900" dir="ltr">
                        {formatAmount(e.paidAmount, fund.currency)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`text-xs font-semibold ${
                            e.status === 'paid'
                              ? 'text-emerald-700'
                              : e.status === 'partial'
                                ? 'text-amber-700'
                                : 'text-red-700'
                          }`}
                        >
                          {getStatusLabelArabic(e.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* WhatsApp Preview */}
          <div className="no-print space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">معاينة رسالة واتساب الشخصية</span>
              {!hasValidPhone && (
                <span className="text-xs text-amber-700">
                  لا يوجد رقم مسجل — سيُفتح واتساب لاختيار جهة الاتصال
                </span>
              )}
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-800 max-h-48 overflow-y-auto">
              {message}
            </pre>
          </div>
        </div>

        {/* Sticky Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-white flex flex-wrap items-center gap-3 pb-safe no-print">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 min-w-[200px] h-11 px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span>{hasValidPhone ? 'إرسال شخصي عبر واتساب' : 'مشاركة عبر واتساب'}</span>
          </a>
          <button
            type="button"
            onClick={handleCopy}
            className="h-11 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'تم النسخ' : 'نسخ النص'}</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="h-11 px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة</span>
          </button>
        </div>
      </div>
    </div>
  );
};
