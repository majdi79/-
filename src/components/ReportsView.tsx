import React, { useEffect, useMemo, useState } from 'react';
import { Check, Copy, MessageCircle, Printer } from 'lucide-react';
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
import {
  buildGroupReportMessage,
  buildIndividualReportMessage,
  getWhatsAppUrl,
  GroupPeriodMemberSummary,
} from '../utils/whatsapp';

interface ReportsViewProps {
  fund: UserFund;
  members: FamilyMember[];
  payments: MonthlyPayment[];
  selectedMonth: string;
  onNotify: (msg: string) => void;
}

type ReportMode = 'monthly' | 'period' | 'individual';

export const ReportsView: React.FC<ReportsViewProps> = ({
  fund,
  members,
  payments,
  selectedMonth,
  onNotify,
}) => {
  const currentMonth = getCurrentMonthKey();
  const [mode, setMode] = useState<ReportMode>('monthly');
  const [singleMonth, setSingleMonth] = useState(selectedMonth);
  const [fromMonth, setFromMonth] = useState(addMonths(selectedMonth, -2));
  const [toMonth, setToMonth] = useState(selectedMonth);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || '');
  const [includePaidList, setIncludePaidList] = useState(true);
  const [includeUnpaidList, setIncludeUnpaidList] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setSingleMonth(selectedMonth);
  }, [selectedMonth]);

  useEffect(() => {
    if (!selectedMemberId && members.length > 0) {
      setSelectedMemberId(members[0].id);
    } else if (selectedMemberId && !members.some((m) => m.id === selectedMemberId)) {
      setSelectedMemberId(members[0]?.id || '');
    }
  }, [members, selectedMemberId]);

  const paymentLookup = useMemo(() => {
    const map = new Map<string, MonthlyPayment>();
    payments.forEach((p) => {
      map.set(`${p.memberId}_${p.monthKey}`, p);
    });
    return map;
  }, [payments]);

  const effectiveFrom = mode === 'monthly' ? singleMonth : fromMonth;
  const effectiveTo = mode === 'monthly' ? singleMonth : toMonth;
  const rangeMonths = useMemo(
    () => getMonthsBetween(effectiveFrom, effectiveTo),
    [effectiveFrom, effectiveTo]
  );

  // Group / Monthly report rows
  const groupMemberSummaries: GroupPeriodMemberSummary[] = useMemo(() => {
    const rows: GroupPeriodMemberSummary[] = [];
    members.forEach((member) => {
      let monthsCount = 0;
      let paidMonthsCount = 0;
      let expectedTotal = 0;
      let paidTotal = 0;
      let remainingTotal = 0;

      rangeMonths.forEach((mKey) => {
        const payment = paymentLookup.get(`${member.id}_${mKey}`);
        if (!isMemberApplicableForMonth(member, mKey, payment)) return;
        const entry = resolveMemberMonthEntry(member, mKey, payment);
        monthsCount += 1;
        if (entry.status === 'paid') paidMonthsCount += 1;
        expectedTotal += entry.expectedAmount;
        paidTotal += entry.paidAmount;
        remainingTotal += entry.remainingAmount;
      });

      if (monthsCount > 0) {
        rows.push({
          member,
          monthsCount,
          paidMonthsCount,
          expectedTotal,
          paidTotal,
          remainingTotal,
        });
      }
    });
    return rows;
  }, [members, rangeMonths, paymentLookup]);

  // Individual report rows
  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) || null,
    [members, selectedMemberId]
  );

  const individualEntries = useMemo(() => {
    if (!selectedMember) return [];
    return rangeMonths
      .filter((mKey) =>
        isMemberApplicableForMonth(
          selectedMember,
          mKey,
          paymentLookup.get(`${selectedMember.id}_${mKey}`)
        )
      )
      .map((mKey) =>
        resolveMemberMonthEntry(
          selectedMember,
          mKey,
          paymentLookup.get(`${selectedMember.id}_${mKey}`)
        )
      );
  }, [selectedMember, rangeMonths, paymentLookup]);

  const totals = useMemo(() => {
    if (mode === 'individual') {
      const expected = individualEntries.reduce((s, e) => s + e.expectedAmount, 0);
      const paid = individualEntries.reduce((s, e) => s + e.paidAmount, 0);
      const remaining = individualEntries.reduce((s, e) => s + e.remainingAmount, 0);
      const rate = expected > 0 ? Math.min(100, Math.round((paid / expected) * 100)) : 0;
      return { expected, paid, remaining, rate };
    }
    const expected = groupMemberSummaries.reduce((s, r) => s + r.expectedTotal, 0);
    const paid = groupMemberSummaries.reduce((s, r) => s + r.paidTotal, 0);
    const remaining = groupMemberSummaries.reduce((s, r) => s + r.remainingTotal, 0);
    const rate = expected > 0 ? Math.min(100, Math.round((paid / expected) * 100)) : 0;
    return { expected, paid, remaining, rate };
  }, [mode, individualEntries, groupMemberSummaries]);

  const whatsappText = useMemo(() => {
    if (mode === 'individual' && selectedMember) {
      return buildIndividualReportMessage({
        fundName: fund.fundName,
        member: selectedMember,
        fromMonth: effectiveFrom,
        toMonth: effectiveTo,
        entries: individualEntries,
        currency: fund.currency,
      });
    }
    return buildGroupReportMessage({
      fundName: fund.fundName,
      fromMonth: effectiveFrom,
      toMonth: effectiveTo,
      memberSummaries: groupMemberSummaries,
      currency: fund.currency,
      includePaidList,
      includeUnpaidList,
    });
  }, [
    mode,
    selectedMember,
    fund.fundName,
    fund.currency,
    effectiveFrom,
    effectiveTo,
    individualEntries,
    groupMemberSummaries,
    includePaidList,
    includeUnpaidList,
  ]);

  const whatsappUrl =
    mode === 'individual' && selectedMember
      ? getWhatsAppUrl(whatsappText, selectedMember.phone)
      : getWhatsAppUrl(whatsappText);

  const hasPersonalPhone =
    mode === 'individual' &&
    selectedMember &&
    sanitizePhoneForWhatsApp(selectedMember.phone).length >= 7;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      onNotify('تم نسخ نص التقرير بنجاح.');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onNotify('تعذّر النسخ التلقائي، يمكنك تحديد النص ونسخه يدوياً.');
    }
  };

  if (members.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-6 py-14 text-center space-y-2">
        <h3 className="text-lg font-bold font-display text-slate-900">لا توجد بيانات لإصدار التقارير</h3>
        <p className="text-sm text-slate-600">
          أضف أفراد العائلة أولاً لتتمكن من إصدار التقارير الشهرية والفردية ومشاركتها عبر واتساب.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Report Configuration Controls */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl self-start">
            {(
              [
                { id: 'monthly', label: 'تقرير شهري' },
                { id: 'period', label: 'تقرير لفترة محددة' },
                { id: 'individual', label: 'تقرير فردي' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  mode === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode !== 'monthly' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setFromMonth(currentMonth);
                  setToMonth(currentMonth);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromMonth(addMonths(currentMonth, -2));
                  setToMonth(currentMonth);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                آخر 3 أشهر
              </button>
              <button
                type="button"
                onClick={() => {
                  setFromMonth(addMonths(currentMonth, -5));
                  setToMonth(currentMonth);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                آخر 6 أشهر
              </button>
              <button
                type="button"
                onClick={() => {
                  const year = currentMonth.slice(0, 4);
                  setFromMonth(`${year}-01`);
                  setToMonth(currentMonth);
                }}
                className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
              >
                السنة الحالية
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {mode === 'monthly' ? (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">الشهر المطلوب</label>
              <input
                type="month"
                value={singleMonth}
                onChange={(e) => {
                  if (e.target.value) setSingleMonth(e.target.value);
                }}
                dir="ltr"
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">من شهر</label>
                <input
                  type="month"
                  value={fromMonth}
                  onChange={(e) => {
                    if (e.target.value) setFromMonth(e.target.value);
                  }}
                  dir="ltr"
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">إلى شهر</label>
                <input
                  type="month"
                  value={toMonth}
                  onChange={(e) => {
                    if (e.target.value) setToMonth(e.target.value);
                  }}
                  dir="ltr"
                  className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm font-mono tabular-nums"
                />
              </div>
            </>
          )}

          {mode === 'individual' && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">اختر الفرد</label>
              <select
                value={selectedMemberId}
                onChange={(e) => setSelectedMemberId(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-slate-300 text-sm text-slate-900 bg-white"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({formatAmount(m.monthlyAmount, fund.currency)})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Report Grid: Left Print-Ready Table / Right WhatsApp Share Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden print-container">
          <div className="px-5 py-4 border-b border-slate-200">
            <h3 className="text-lg font-bold font-display text-slate-900">
              {mode === 'individual' && selectedMember
                ? `تقرير فردي — ${selectedMember.name}`
                : `تقرير ${fund.fundName}`}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {effectiveFrom === effectiveTo
                ? `شهر ${formatMonthArabic(effectiveFrom)}`
                : `الفترة من ${formatMonthArabic(effectiveFrom)} إلى ${formatMonthArabic(effectiveTo)}`}
              {` · ${rangeMonths.length} ${rangeMonths.length === 1 ? 'شهر' : 'أشهر'}`}
            </p>
          </div>

          {/* Report Totals Strip */}
          <div className="grid grid-cols-3 divide-x divide-x-reverse divide-slate-200 border-b border-slate-200 bg-slate-50">
            <div className="p-3.5 text-center">
              <p className="text-xs text-slate-500">المطلوب</p>
              <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-1" dir="ltr">
                {formatAmount(totals.expected, fund.currency)}
              </p>
            </div>
            <div className="p-3.5 text-center">
              <p className="text-xs text-slate-500">المحصّل ({totals.rate}%)</p>
              <p className="text-base font-bold font-mono tabular-nums text-emerald-700 mt-1" dir="ltr">
                {formatAmount(totals.paid, fund.currency)}
              </p>
            </div>
            <div className="p-3.5 text-center">
              <p className="text-xs text-slate-500">المتبقي</p>
              <p
                className={`text-base font-bold font-mono tabular-nums mt-1 ${
                  totals.remaining > 0 ? 'text-red-700' : 'text-slate-900'
                }`}
                dir="ltr"
              >
                {formatAmount(totals.remaining, fund.currency)}
              </p>
            </div>
          </div>

          {/* Report Breakdown Table */}
          {mode === 'individual' ? (
            individualEntries.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                لا توجد اشتراكات مستحقة لهذا الفرد خلال الفترة المحددة.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="text-right font-medium px-5 py-3">الشهر</th>
                      <th className="text-left font-medium px-4 py-3">المقرر</th>
                      <th className="text-left font-medium px-4 py-3">المدفوع</th>
                      <th className="text-right font-medium px-5 py-3">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {individualEntries.map((entry) => (
                      <tr key={entry.monthKey}>
                        <td className="px-5 py-3 font-medium text-slate-900">
                          <div>{formatMonthArabic(entry.monthKey)}</div>
                          {(entry.paidDate || entry.note) && (
                            <div className="text-xs text-slate-500 font-normal mt-0.5">
                              {[
                                entry.paidDate ? formatShortDateArabic(entry.paidDate) : '',
                                entry.note,
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-left font-mono tabular-nums text-slate-600" dir="ltr">
                          {formatAmount(entry.expectedAmount, fund.currency)}
                        </td>
                        <td className="px-4 py-3 text-left font-mono tabular-nums font-semibold text-slate-900" dir="ltr">
                          {formatAmount(entry.paidAmount, fund.currency)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span
                            className={`text-xs font-semibold ${
                              entry.status === 'paid'
                                ? 'text-emerald-700'
                                : entry.status === 'partial'
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                            }`}
                          >
                            {getStatusLabelArabic(entry.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : groupMemberSummaries.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              لا توجد بيانات مستحقة خلال هذه الفترة.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="text-right font-medium px-5 py-3">الفرد</th>
                    <th className="text-left font-medium px-3 py-3">المطلوب</th>
                    <th className="text-left font-medium px-3 py-3">المدفوع</th>
                    <th className="text-left font-medium px-5 py-3">المتبقي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupMemberSummaries.map((row) => (
                    <tr key={row.member.id}>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-900">{row.member.name}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          التزام: {row.paidMonthsCount} من {row.monthsCount}{' '}
                          {row.monthsCount === 1 ? 'شهر' : 'أشهر'}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-left font-mono tabular-nums text-slate-600" dir="ltr">
                        {formatAmount(row.expectedTotal, fund.currency)}
                      </td>
                      <td className="px-3 py-3 text-left font-mono tabular-nums font-semibold text-emerald-700" dir="ltr">
                        {formatAmount(row.paidTotal, fund.currency)}
                      </td>
                      <td
                        className={`px-5 py-3 text-left font-mono tabular-nums font-semibold ${
                          row.remainingTotal > 0 ? 'text-red-700' : 'text-slate-400'
                        }`}
                        dir="ltr"
                      >
                        {formatAmount(row.remainingTotal, fund.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right 5 cols: WhatsApp Text Preview & Share Actions */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4 no-print">
          <div>
            <h3 className="text-base font-bold font-display text-slate-900">
              {mode === 'individual' ? 'مشاركة التقرير الشخصي عبر واتساب' : 'مشاركة التقرير عبر واتساب'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {mode === 'individual' && selectedMember
                ? hasPersonalPhone
                  ? `سيتم توجيه التقرير مباشرة إلى رقم واتساب ${selectedMember.name}.`
                  : 'لا يوجد رقم واتساب مسجل لهذا الفرد — سيُفتح واتساب لاختيار جهة الاتصال.'
                : 'معاينة فورية للنص المنسق الجاهز للإرسال إلى مجموعة العائلة على واتساب.'}
            </p>
          </div>

          {mode !== 'individual' && (
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePaidList}
                  onChange={(e) => setIncludePaidList(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <span>إظهار قائمة المسددين</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeUnpaidList}
                  onChange={(e) => setIncludeUnpaidList(e.target.checked)}
                  className="rounded border-slate-300 text-teal-700 focus:ring-teal-600"
                />
                <span>إظهار المتبقي عليهم</span>
              </label>
            </div>
          )}

          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed bg-slate-50 border border-slate-200 rounded-xl p-4 text-slate-800 max-h-80 overflow-y-auto">
            {whatsappText}
          </pre>

          <div className="space-y-2.5">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[46px] px-4 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>
                {mode === 'individual' && hasPersonalPhone
                  ? 'إرسال شخصي عبر واتساب'
                  : 'مشاركة التقرير عبر واتساب'}
              </span>
            </a>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleCopy}
                className="min-h-[44px] px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'تم النسخ' : 'نسخ النص'}</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="min-h-[44px] px-4 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-xl inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                <span>طباعة / PDF</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
