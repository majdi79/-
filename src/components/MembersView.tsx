import React, { useMemo, useState } from 'react';
import { Edit3, FileText, Phone, Search, UserPlus } from 'lucide-react';
import { FamilyMember, MonthlyPayment, UserFund } from '../types';
import { formatAmount, formatMonthArabic } from '../utils/format';

interface MembersViewProps {
  fund: UserFund;
  members: FamilyMember[];
  payments: MonthlyPayment[];
  onOpenAddMember: () => void;
  onOpenEditMember: (member: FamilyMember) => void;
  onOpenMemberStatement: (member: FamilyMember) => void;
}

export const MembersView: React.FC<MembersViewProps> = ({
  fund,
  members,
  payments,
  onOpenAddMember,
  onOpenEditMember,
  onOpenMemberStatement,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilter, setShowFilter] = useState<'all' | 'active' | 'paused'>('all');

  const activeMembers = useMemo(() => members.filter((m) => m.isActive), [members]);
  const pausedMembers = useMemo(() => members.filter((m) => !m.isActive), [members]);
  const monthlyRecurringTotal = useMemo(
    () => activeMembers.reduce((sum, m) => sum + m.monthlyAmount, 0),
    [activeMembers]
  );

  const totalPaidByMember = useMemo(() => {
    const map = new Map<string, number>();
    payments.forEach((p) => {
      map.set(p.memberId, (map.get(p.memberId) || 0) + p.paidAmount);
    });
    return map;
  }, [payments]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return members.filter((m) => {
      if (showFilter === 'active' && !m.isActive) return false;
      if (showFilter === 'paused' && m.isActive) return false;
      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.relation.toLowerCase().includes(q) ||
        m.phone.includes(q)
      );
    });
  }, [members, searchQuery, showFilter]);

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="bg-white border border-slate-200 rounded-xl grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">إجمالي الأفراد</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {members.length}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {activeMembers.length} نشط · {pausedMembers.length} موقوف مؤقتاً
          </p>
        </div>

        <div className="p-4 sm:p-5">
          <p className="text-xs text-slate-500">إجمالي الاشتراكات الشهرية المقررة</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-teal-700 mt-1" dir="ltr">
            {formatAmount(monthlyRecurringTotal, fund.currency)}
          </p>
          <p className="text-xs text-slate-500 mt-1">لجميع الأفراد النشطين شهرياً</p>
        </div>

        <div className="p-4 sm:p-5 flex items-center justify-between sm:justify-end">
          <div className="sm:hidden">
            <p className="text-xs text-slate-500">إدارة القائمة</p>
            <p className="text-sm font-medium text-slate-800 mt-0.5">أضف فرداً جديداً للعائلة</p>
          </div>
          <button
            type="button"
            onClick={onOpenAddMember}
            className="h-11 px-5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>إضافة فرد جديد</span>
          </button>
        </div>
      </div>

      {/* Members Directory */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في قائمة أفراد العائلة..."
              className="w-full h-10 pr-10 pl-3.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {(
              [
                { id: 'all', label: `الكل (${members.length})` },
                { id: 'active', label: `النشطون (${activeMembers.length})` },
                { id: 'paused', label: `موقوفون (${pausedMembers.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setShowFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[34px] ${
                  showFilter === tab.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            {members.length === 0
              ? 'لم يتم إضافة أي أفراد بعد. اضغط على "إضافة فرد جديد" للبدء.'
              : 'لا توجد نتائج مطابقة للبحث.'}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="text-right font-medium px-5 py-3">الاسم والصلة</th>
                    <th className="text-left font-medium px-4 py-3">رقم الواتساب</th>
                    <th className="text-left font-medium px-4 py-3">الاشتراك الشهري</th>
                    <th className="text-left font-medium px-4 py-3">إجمالي ما دفعه</th>
                    <th className="text-right font-medium px-4 py-3">الحالة</th>
                    <th className="text-left font-medium px-5 py-3">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((member) => {
                    const lifetimePaid = totalPaidByMember.get(member.id) || 0;
                    return (
                      <tr key={member.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">{member.name}</div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {[
                              member.relation,
                              `منذ ${formatMonthArabic(member.startMonth)}`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-left font-mono tabular-nums text-slate-600" dir="ltr">
                          {member.phone || <span className="text-slate-400 font-sans">غير مسجل</span>}
                        </td>
                        <td className="px-4 py-3.5 text-left font-mono tabular-nums font-semibold text-slate-900" dir="ltr">
                          {formatAmount(member.monthlyAmount, fund.currency)}
                        </td>
                        <td className="px-4 py-3.5 text-left font-mono tabular-nums text-emerald-700" dir="ltr">
                          {formatAmount(lifetimePaid, fund.currency)}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span
                            className={`text-xs font-semibold ${
                              member.isActive ? 'text-teal-700' : 'text-slate-400'
                            }`}
                          >
                            {member.isActive ? 'نشط' : 'موقوف'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => onOpenMemberStatement(member)}
                              className="h-9 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>تقرير فردي</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenEditMember(member)}
                              className="h-9 px-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>تعديل</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile List */}
            <div className="md:hidden divide-y divide-slate-200">
              {filtered.map((member) => (
                <div key={member.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-base font-bold text-slate-900 truncate">
                        {member.name}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span className={member.isActive ? 'text-teal-700 font-medium' : 'text-slate-400'}>
                          {member.isActive ? 'نشط' : 'موقوف'}
                        </span>
                        {member.relation ? ` · ${member.relation}` : ''}
                        {` · منذ ${formatMonthArabic(member.startMonth)}`}
                      </div>
                      {member.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span dir="ltr" className="font-mono tabular-nums">
                            {member.phone}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-left shrink-0" dir="ltr">
                      <div className="text-sm font-mono font-bold tabular-nums text-slate-900">
                        {formatAmount(member.monthlyAmount, fund.currency)}
                      </div>
                      <div className="text-[11px] text-slate-500">شهرياً</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenMemberStatement(member)}
                      className="flex-1 min-h-[44px] px-3 bg-emerald-50 active:bg-emerald-100 text-emerald-800 text-xs font-semibold rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <FileText className="w-4 h-4" />
                      <span>كشف وتقرير فردي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEditMember(member)}
                      className="min-h-[44px] px-4 bg-white border border-slate-200 active:bg-slate-50 text-slate-700 text-xs font-medium rounded-xl inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Edit3 className="w-4 h-4" />
                      <span>تعديل</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
