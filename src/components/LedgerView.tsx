import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Edit3,
  FileText,
  MessageCircle,
  Search,
  Sparkles,
  UserPlus,
} from 'lucide-react';
import { FamilyMember, MonthlyPayment, PaymentStatus, UserFund } from '../types';
import {
  addMonths,
  formatAmount,
  formatMonthArabic,
  formatShortDateArabic,
  getCurrentMonthKey,
  getStatusLabelArabic,
  isMemberApplicableForMonth,
  resolveMemberMonthEntry,
  ResolvedMonthEntry,
} from '../utils/format';
import { buildPersonalReminderMessage, getWhatsAppUrl } from '../utils/whatsapp';

interface LedgerViewProps {
  fund: UserFund;
  members: FamilyMember[];
  payments: MonthlyPayment[];
  selectedMonth: string;
  loading: boolean;
  onChangeMonth: (monthKey: string) => void;
  onQuickMarkPaid: (entry: ResolvedMonthEntry) => Promise<void>;
  onOpenPaymentModal: (entry: ResolvedMonthEntry) => void;
  onOpenMemberStatement: (member: FamilyMember) => void;
  onOpenAddMember: () => void;
  onLogReminder: (entry: ResolvedMonthEntry) => Promise<void>;
  onLoadSampleData: () => Promise<void>;
}

type StatusFilter = 'all' | PaymentStatus;

export const LedgerView: React.FC<LedgerViewProps> = ({
  fund,
  members,
  payments,
  selectedMonth,
  loading,
  onChangeMonth,
  onQuickMarkPaid,
  onOpenPaymentModal,
  onOpenMemberStatement,
  onOpenAddMember,
  onLogReminder,
  onLoadSampleData,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const currentMonth = getCurrentMonthKey();

  const paymentMap = useMemo(() => {
    const map = new Map<string, MonthlyPayment>();
    payments.forEach((p) => {
      if (p.monthKey === selectedMonth) {
        map.set(p.memberId, p);
      }
    });
    return map;
  }, [payments, selectedMonth]);

  const monthEntries = useMemo(() => {
    return members
      .filter((m) => isMemberApplicableForMonth(m, selectedMonth, paymentMap.get(m.id)))
      .map((m) => resolveMemberMonthEntry(m, selectedMonth, paymentMap.get(m.id)));
  }, [members, selectedMonth, paymentMap]);

  const stats = useMemo(() => {
    const totalExpected = monthEntries.reduce((s, e) => s + e.expectedAmount, 0);
    const totalPaid = monthEntries.reduce((s, e) => s + e.paidAmount, 0);
    const totalRemaining = monthEntries.reduce((s, e) => s + e.remainingAmount, 0);
    const paidCount = monthEntries.filter((e) => e.status === 'paid').length;
    const partialCount = monthEntries.filter((e) => e.status === 'partial').length;
    const unpaidCount = monthEntries.filter((e) => e.status === 'unpaid').length;
    const rate = totalExpected > 0 ? Math.min(100, Math.round((totalPaid / totalExpected) * 100)) : 0;
    return {
      totalExpected,
      totalPaid,
      totalRemaining,
      paidCount,
      partialCount,
      unpaidCount,
      totalCount: monthEntries.length,
      rate,
    };
  }, [monthEntries]);

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return monthEntries.filter((entry) => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!q) return true;
      return (
        entry.member.name.toLowerCase().includes(q) ||
        entry.member.relation.toLowerCase().includes(q) ||
        entry.member.phone.includes(q)
      );
    });
  }, [monthEntries, searchQuery, statusFilter]);

  const handleQuickPay = async (entry: ResolvedMonthEntry) => {
    setBusyMemberId(entry.member.id);
    try {
      await onQuickMarkPaid(entry);
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onLoadSampleData();
    } finally {
      setSeeding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-14 bg-white border border-slate-200 rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-white border border-slate-200 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 border-b border-slate-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month Navigator Strip */}
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

          <div className="px-2 text-center min-w-[140px]">
            <h2 className="text-base sm:text-lg font-bold font-display text-slate-900">
              {formatMonthArabic(selectedMonth)}
            </h2>
          </div>

          <button
            type="button"
            onClick={() => onChangeMonth(addMonths(selectedMonth, 1))}
            aria-label="الشهر التالي"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {selectedMonth !== currentMonth && (
            <button
              type="button"
              onClick={() => onChangeMonth(currentMonth)}
              className="h-10 px-3 text-xs font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              الشهر الحالي
            </button>
          )}
          <input
            type="month"
            aria-label="اختيار الشهر"
            value={selectedMonth}
            onChange={(e) => {
              if (e.target.value) onChangeMonth(e.target.value);
            }}
            dir="ltr"
            className="h-10 px-3 rounded-lg border border-slate-200 text-xs font-mono tabular-nums text-slate-700 bg-white focus:outline-none focus:border-teal-700"
          />
        </div>
      </div>

      {/* 4-Column Flat KPI Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-x divide-x-reverse divide-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">إجمالي المطلوب</p>
          <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5" dir="ltr">
            {formatAmount(stats.totalExpected, fund.currency)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.totalCount} فرد مشمول هذا الشهر
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">إجمالي المحصّل</p>
            <span className="text-xs font-mono font-semibold tabular-nums text-emerald-700">
              {stats.rate}%
            </span>
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1.5" dir="ltr">
            {formatAmount(stats.totalPaid, fund.currency)}
          </p>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-2.5 overflow-hidden">
            <div
              className="h-full bg-teal-700 rounded-full transition-all duration-300"
              style={{ width: `${stats.rate}%` }}
            />
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">المتبقي للتحصيل</p>
          <p
            className={`text-xl sm:text-2xl font-bold font-mono tabular-nums mt-1.5 ${
              stats.totalRemaining > 0 ? 'text-red-700' : 'text-slate-900'
            }`}
            dir="ltr"
          >
            {formatAmount(stats.totalRemaining, fund.currency)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.unpaidCount + stats.partialCount === 0
              ? 'مكتمل بالكامل'
              : `${stats.unpaidCount + stats.partialCount} بحاجة للمتابعة`}
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">حالة الالتزام</p>
          <p className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {stats.paidCount} <span className="text-sm font-normal text-slate-400">/ {stats.totalCount}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {stats.partialCount > 0 ? `${stats.partialCount} جزئي · ` : ''}
            {stats.unpaidCount} لم يدفع
          </p>
        </div>
      </div>

      {/* Empty State when no members exist yet */}
      {members.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl px-6 py-14 text-center space-y-4">
          <h3 className="text-lg font-bold font-display text-slate-900">
            ابدأ بإضافة أفراد العائلة
          </h3>
          <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
            أضف أفراد العائلة مع المبلغ الشهري المقرر لكل فرد ورقم الواتساب لتبدأ بمتابعة التحصيل
            وإصدار التقارير فوراً.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenAddMember}
              className="w-full sm:w-auto h-11 px-5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-xl inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>إضافة أول فرد</span>
            </button>
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="w-full sm:w-auto h-11 px-5 bg-white border border-slate-300 hover:bg-slate-50 disabled:opacity-60 text-slate-700 text-sm font-medium rounded-xl inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-teal-700" />
              <span>{seeding ? 'جارٍ التحميل...' : 'تحميل بيانات عائلة تجريبية'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Toolbar: Search + Interactive Filter Tabs */}
          <div className="p-4 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث بالاسم أو القرابة أو الرقم..."
                className="w-full h-10 pr-10 pl-3.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
              {(
                [
                  { id: 'all', label: `الكل (${stats.totalCount})` },
                  { id: 'unpaid', label: `لم يدفع (${stats.unpaidCount})` },
                  { id: 'partial', label: `جزئي (${stats.partialCount})` },
                  { id: 'paid', label: `مدفوع (${stats.paidCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[34px] ${
                    statusFilter === tab.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredEntries.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              {monthEntries.length === 0
                ? `لا يوجد أفراد مشمولون باشتراك شهر ${formatMonthArabic(selectedMonth)} (تحقق من تاريخ بداية الاشتراك لكل فرد).`
                : 'لا توجد نتائج مطابقة للبحث أو التصفية الحالية.'}
            </div>
          ) : (
            <>
              {/* Desktop Ledger Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="text-right font-medium px-5 py-3">الفرد</th>
                      <th className="text-left font-medium px-4 py-3">المبلغ المقرر</th>
                      <th className="text-left font-medium px-4 py-3">المدفوع</th>
                      <th className="text-left font-medium px-4 py-3">المتبقي</th>
                      <th className="text-right font-medium px-4 py-3">الحالة</th>
                      <th className="text-left font-medium px-5 py-3">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEntries.map((entry) => {
                      const reminderText = buildPersonalReminderMessage({
                        template: fund.reminderTemplate,
                        memberName: entry.member.name,
                        fundName: fund.fundName,
                        monthKey: selectedMonth,
                        expectedAmount: entry.expectedAmount,
                        paidAmount: entry.paidAmount,
                        currency: fund.currency,
                      });
                      const waUrl = getWhatsAppUrl(reminderText, entry.member.phone);
                      const isBusy = busyMemberId === entry.member.id;

                      return (
                        <tr key={entry.member.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-3.5">
                            <button
                              type="button"
                              onClick={() => onOpenMemberStatement(entry.member)}
                              className="text-right group cursor-pointer"
                            >
                              <div className="font-semibold text-slate-900 group-hover:text-teal-700 transition-colors">
                                {entry.member.name}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5">
                                {[
                                  entry.member.relation,
                                  entry.paidDate ? `دفع في ${formatShortDateArabic(entry.paidDate)}` : '',
                                  entry.note,
                                ]
                                  .filter(Boolean)
                                  .join(' · ') || 'اشتراك شهري'}
                              </div>
                            </button>
                          </td>

                          <td className="px-4 py-3.5 text-left font-mono tabular-nums text-slate-600" dir="ltr">
                            {formatAmount(entry.expectedAmount, fund.currency)}
                          </td>

                          <td className="px-4 py-3.5 text-left font-mono tabular-nums font-semibold text-slate-900" dir="ltr">
                            {formatAmount(entry.paidAmount, fund.currency)}
                          </td>

                          <td
                            className={`px-4 py-3.5 text-left font-mono tabular-nums font-semibold ${
                              entry.remainingAmount > 0 ? 'text-red-700' : 'text-slate-400'
                            }`}
                            dir="ltr"
                          >
                            {formatAmount(entry.remainingAmount, fund.currency)}
                          </td>

                          <td className="px-4 py-3.5 text-right">
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

                          <td className="px-5 py-3.5">
                            <div className="flex items-center justify-end gap-2">
                              {entry.status !== 'paid' && (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleQuickPay(entry)}
                                  className="h-9 px-3 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                  <span>{isBusy ? 'جارٍ...' : 'تسجيل دفع'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onOpenPaymentModal(entry)}
                                className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{entry.status === 'paid' ? 'تعديل' : 'جزئي'}</span>
                              </button>

                              {entry.remainingAmount > 0 && (
                                <a
                                  href={waUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={() => void onLogReminder(entry)}
                                  className="h-9 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
                                >
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  <span>تذكير</span>
                                </a>
                              )}

                              <button
                                type="button"
                                onClick={() => onOpenMemberStatement(entry.member)}
                                title="كشف حساب الفرد"
                                className="h-9 px-2.5 text-slate-500 hover:text-teal-700 hover:bg-slate-100 rounded-lg inline-flex items-center gap-1 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>كشف</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Touch-First Ledger Rows */}
              <div className="md:hidden divide-y divide-slate-200">
                {filteredEntries.map((entry) => {
                  const reminderText = buildPersonalReminderMessage({
                    template: fund.reminderTemplate,
                    memberName: entry.member.name,
                    fundName: fund.fundName,
                    monthKey: selectedMonth,
                    expectedAmount: entry.expectedAmount,
                    paidAmount: entry.paidAmount,
                    currency: fund.currency,
                  });
                  const waUrl = getWhatsAppUrl(reminderText, entry.member.phone);
                  const isBusy = busyMemberId === entry.member.id;

                  return (
                    <div key={entry.member.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenMemberStatement(entry.member)}
                          className="text-right min-w-0 flex-1 cursor-pointer"
                        >
                          <div className="text-base font-bold text-slate-900 truncate">
                            {entry.member.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            <span
                              className={`font-semibold ${
                                entry.status === 'paid'
                                  ? 'text-emerald-700'
                                  : entry.status === 'partial'
                                    ? 'text-amber-700'
                                    : 'text-red-700'
                              }`}
                            >
                              {getStatusLabelArabic(entry.status)}
                            </span>
                            {entry.member.relation ? ` · ${entry.member.relation}` : ''}
                            {entry.note ? ` · ${entry.note}` : ''}
                          </div>
                        </button>

                        <div className="text-left shrink-0" dir="ltr">
                          <div className="text-sm font-mono font-bold tabular-nums text-slate-900">
                            {formatAmount(entry.paidAmount, fund.currency)}
                          </div>
                          <div className="text-xs font-mono tabular-nums text-slate-500">
                            من {formatAmount(entry.expectedAmount, fund.currency)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {entry.status !== 'paid' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQuickPay(entry)}
                            className="flex-1 min-h-[44px] px-3 bg-teal-700 active:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <Check className="w-4 h-4" />
                            <span>{isBusy ? 'جارٍ الحفظ...' : 'تأكيد الدفع'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenPaymentModal(entry)}
                          className={`${
                            entry.status === 'paid' ? 'flex-1' : ''
                          } min-h-[44px] px-3.5 bg-slate-100 active:bg-slate-200 text-slate-800 text-xs font-medium rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap`}
                        >
                          <Edit3 className="w-4 h-4" />
                          <span>{entry.status === 'paid' ? 'تعديل الدفعة' : 'جزئي'}</span>
                        </button>

                        {entry.remainingAmount > 0 && (
                          <a
                            href={waUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => void onLogReminder(entry)}
                            className="min-h-[44px] px-3.5 bg-emerald-50 active:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                          >
                            <MessageCircle className="w-4 h-4" />
                            <span>تذكير</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenMemberStatement(entry.member)}
                          aria-label="كشف حساب الفرد"
                          className="min-h-[44px] min-w-[44px] bg-white border border-slate-200 text-slate-600 rounded-xl inline-flex items-center justify-center cursor-pointer"
                        >
                          <FileText className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
