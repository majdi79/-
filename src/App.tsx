import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  Bell,
  CalendarCheck2,
  FileBarChart2,
  LogOut,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { AuthGate } from './components/AuthGate';
import { LedgerView } from './components/LedgerView';
import { MemberModal } from './components/MemberModal';
import { MemberStatementModal } from './components/MemberStatementModal';
import { MembersView } from './components/MembersView';
import { PaymentModal } from './components/PaymentModal';
import { RemindersView } from './components/RemindersView';
import { ReportsView } from './components/ReportsView';
import { SettingsModal } from './components/SettingsModal';
import {
  auth,
  createMember,
  deleteMemberAndPayments,
  ensureUserFund,
  recordReminderSent,
  saveMonthlyPayment,
  seedSampleFamilyData,
  signOutUser,
  subscribeMembers,
  subscribePayments,
  subscribeUserFund,
  updateFundSettings,
  updateMember,
} from './firebase';
import {
  ActiveTab,
  DEFAULT_REMINDER_TEMPLATE,
  FamilyMember,
  FIXED_CURRENCY,
  FIXED_CURRENCY_LABEL,
  MonthlyPayment,
  UserFund,
} from './types';
import {
  getCurrentMonthKey,
  getTodayIsoDate,
  isMemberApplicableForMonth,
  resolveMemberMonthEntry,
  ResolvedMonthEntry,
} from './utils/format';

const TAB_META: Record<ActiveTab, { label: string; shortLabel: string; title: string }> = {
  ledger: { label: 'التحصيل الشهري', shortLabel: 'التحصيل', title: 'التحصيل الشهري' },
  members: { label: 'أفراد العائلة', shortLabel: 'الأفراد', title: 'أفراد العائلة' },
  reminders: { label: 'التذكيرات', shortLabel: 'التذكيرات', title: 'تذكير غير المسددين' },
  reports: { label: 'التقارير', shortLabel: 'التقارير', title: 'التقارير والمشاركة' },
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [fund, setFund] = useState<UserFund | null>(null);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [payments, setPayments] = useState<MonthlyPayment[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [activeTab, setActiveTab] = useState<ActiveTab>('ledger');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonthKey());

  // Modals state
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [paymentModalEntry, setPaymentModalEntry] = useState<ResolvedMonthEntry | null>(null);
  const [statementMember, setStatementMember] = useState<FamilyMember | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (message: string) => {
    setToast(message);
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setFund(null);
        setMembers([]);
        setPayments([]);
        setDataLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Initialize fund document and subscribe to real-time Firestore collections
  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    let unsubFund: (() => void) | null = null;
    let unsubMembers: (() => void) | null = null;
    let unsubPayments: (() => void) | null = null;

    setDataLoading(true);

    ensureUserFund(user.uid)
      .then((initialFund) => {
        if (cancelled) return;
        setFund(initialFund);

        let membersLoaded = false;
        let paymentsLoaded = false;
        const markReady = () => {
          if (membersLoaded && paymentsLoaded && !cancelled) {
            setDataLoading(false);
          }
        };

        unsubFund = subscribeUserFund(
          user.uid,
          (nextFund) => {
            if (nextFund && !cancelled) setFund(nextFund);
          },
          (err) => {
            if (!cancelled) setFatalError(err);
          }
        );

        unsubMembers = subscribeMembers(
          user.uid,
          (list) => {
            if (cancelled) return;
            setMembers(list);
            membersLoaded = true;
            markReady();
          },
          (err) => {
            if (!cancelled) setFatalError(err);
          }
        );

        unsubPayments = subscribePayments(
          user.uid,
          (list) => {
            if (cancelled) return;
            setPayments(list);
            paymentsLoaded = true;
            markReady();
          },
          (err) => {
            if (!cancelled) setFatalError(err);
          }
        );
      })
      .catch((err) => {
        if (!cancelled) {
          setFatalError(err instanceof Error ? err : new Error(String(err)));
        }
      });

    return () => {
      cancelled = true;
      if (unsubFund) unsubFund();
      if (unsubMembers) unsubMembers();
      if (unsubPayments) unsubPayments();
    };
  }, [authReady, user]);

  // Count unpaid/partial members for selected month (for clean text indicator in nav)
  const pendingCount = useMemo(() => {
    const paymentMap = new Map<string, MonthlyPayment>();
    payments.forEach((p) => {
      if (p.monthKey === selectedMonth) paymentMap.set(p.memberId, p);
    });
    return members.reduce((count, m) => {
      const p = paymentMap.get(m.id);
      if (!isMemberApplicableForMonth(m, selectedMonth, p)) return count;
      const resolved = resolveMemberMonthEntry(m, selectedMonth, p);
      return resolved.remainingAmount > 0 ? count + 1 : count;
    }, 0);
  }, [members, payments, selectedMonth]);

  // Surface Firestore errors to ErrorBoundary
  if (fatalError) {
    throw fatalError;
  }

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <div className="text-center space-y-2">
          <p className="text-lg font-bold font-display text-slate-900">صندوق العائلة</p>
          <p className="text-sm text-slate-500">جارٍ التحقق من الجلسة...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  const activeFund: UserFund = {
    ownerId: user.uid,
    fundName: fund?.fundName || 'صندوق العائلة',
    currency: FIXED_CURRENCY,
    reminderTemplate: fund?.reminderTemplate || DEFAULT_REMINDER_TEMPLATE,
    createdAt: fund?.createdAt,
    updatedAt: fund?.updatedAt,
  };

  // Handlers
  const handleSaveMember = async (data: {
    name: string;
    phone: string;
    relation: string;
    monthlyAmount: number;
    startMonth: string;
    isActive: boolean;
  }) => {
    if (editingMember) {
      await updateMember(user.uid, editingMember.id, data);
      showToast(`تم تحديث بيانات ${data.name}.`);
    } else {
      await createMember(user.uid, data);
      showToast(`تمت إضافة ${data.name} إلى الصندوق.`);
    }
  };

  const handleDeleteMember = async (member: FamilyMember) => {
    const paymentIds = payments.filter((p) => p.memberId === member.id).map((p) => p.id);
    await deleteMemberAndPayments(user.uid, member.id, paymentIds);
    showToast(`تم حذف ${member.name} وسجلاته.`);
  };

  const handleQuickMarkPaid = async (entry: ResolvedMonthEntry) => {
    await saveMonthlyPayment(user.uid, {
      memberId: entry.member.id,
      monthKey: entry.monthKey,
      expectedAmount: entry.expectedAmount,
      paidAmount: entry.expectedAmount,
      paidDate: getTodayIsoDate(),
      note: entry.note,
      existingPayment: entry.payment,
    });
    showToast(`تم تسجيل دفع ${entry.member.name} بالكامل.`);
  };

  const handleSavePayment = async (data: {
    memberId: string;
    monthKey: string;
    expectedAmount: number;
    paidAmount: number;
    paidDate: string;
    note: string;
  }) => {
    const existingPayment = payments.find(
      (p) => p.memberId === data.memberId && p.monthKey === data.monthKey
    );
    await saveMonthlyPayment(user.uid, {
      ...data,
      existingPayment,
    });
    showToast('تم حفظ حالة الدفع بنجاح.');
  };

  const handleLogReminder = async (entry: ResolvedMonthEntry) => {
    try {
      await recordReminderSent(user.uid, entry.member, entry.monthKey, entry.payment);
    } catch {
      // Reminder link already opened; ignore silent log failure
    }
  };

  const handleSaveSettings = async (data: {
    fundName: string;
    reminderTemplate: string;
  }) => {
    await updateFundSettings(user.uid, data);
    showToast('تم حفظ إعدادات الصندوق.');
  };

  const handleLoadSampleData = async () => {
    await seedSampleFamilyData(user.uid);
    showToast('تم تحميل بيانات العائلة التجريبية بنجاح.');
  };

  const navItems: { id: ActiveTab; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'ledger', icon: CalendarCheck2 },
    { id: 'members', icon: Users },
    { id: 'reminders', icon: Bell },
    { id: 'reports', icon: FileBarChart2 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row" dir="rtl">
      {/* Desktop Right Sidebar (RTL) */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:right-0 bg-white border-l border-slate-200 z-30 no-print">
        <div className="h-16 px-6 flex items-center border-b border-slate-200">
          <span className="text-xl font-extrabold font-display text-teal-800 truncate">
            {activeFund.fundName}
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1" aria-label="التنقل الرئيسي">
          {navItems.map(({ id, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`w-full h-11 px-3.5 rounded-xl flex items-center justify-between text-sm font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-teal-50 text-teal-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-teal-700' : 'text-slate-400'}`} />
                  <span>{TAB_META[id].label}</span>
                </span>
                {id === 'reminders' && pendingCount > 0 && (
                  <span className="text-xs font-mono font-semibold tabular-nums text-red-700">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-200 space-y-1">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="w-full h-10 px-3.5 rounded-lg flex items-center gap-3 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>إعدادات الصندوق</span>
          </button>

          <div className="px-3.5 pt-2 pb-1 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500 truncate" dir="ltr">
              {user.email}
            </span>
            <button
              type="button"
              onClick={() => void signOutUser()}
              title="تسجيل الخروج"
              aria-label="تسجيل الخروج"
              className="p-2 text-slate-400 hover:text-red-700 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 lg:pr-64">
        {/* Top Bar: Compact Mobile (52px) + Crisp Desktop (64px) */}
        <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200 h-[52px] lg:h-16 no-print">
          <div className="max-w-6xl mx-auto h-full px-4 lg:px-8 flex items-center justify-between gap-4">
            {/* Zone 1: Title / Brand */}
            <div className="min-w-0">
              <h1 className="text-base lg:text-lg font-bold font-display text-slate-900 truncate">
                <span className="lg:hidden">{activeFund.fundName}</span>
                <span className="hidden lg:inline">{TAB_META[activeTab].title}</span>
              </h1>
            </div>

            {/* Zone 2: Desktop Context Metadata (Clean Unboxed Text) */}
            <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 whitespace-nowrap">
              <span>{members.filter((m) => m.isActive).length} فرد نشط</span>
              <span aria-hidden="true">·</span>
              <span>{FIXED_CURRENCY_LABEL}</span>
            </div>

            {/* Zone 3: Single Primary Action (+ mobile settings/signout icons) */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setEditingMember(null);
                  setMemberModalOpen(true);
                }}
                className="h-9 lg:h-10 px-3 lg:px-4 bg-teal-700 hover:bg-teal-800 text-white text-xs lg:text-sm font-medium rounded-lg inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>إضافة فرد</span>
              </button>

              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                aria-label="إعدادات الصندوق"
                className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-600 hover:text-slate-900 rounded-lg cursor-pointer"
              >
                <Settings className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={() => void signOutUser()}
                aria-label="تسجيل الخروج"
                className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-red-700 rounded-lg cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Active View Viewport */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 lg:px-8 py-5 lg:py-7 pb-24 lg:pb-10">
          {activeTab === 'ledger' && (
            <LedgerView
              fund={activeFund}
              members={members}
              payments={payments}
              selectedMonth={selectedMonth}
              loading={dataLoading}
              onChangeMonth={setSelectedMonth}
              onQuickMarkPaid={handleQuickMarkPaid}
              onOpenPaymentModal={setPaymentModalEntry}
              onOpenMemberStatement={setStatementMember}
              onOpenAddMember={() => {
                setEditingMember(null);
                setMemberModalOpen(true);
              }}
              onLogReminder={handleLogReminder}
              onLoadSampleData={handleLoadSampleData}
            />
          )}

          {activeTab === 'members' && (
            <MembersView
              fund={activeFund}
              members={members}
              payments={payments}
              onOpenAddMember={() => {
                setEditingMember(null);
                setMemberModalOpen(true);
              }}
              onOpenEditMember={(member) => {
                setEditingMember(member);
                setMemberModalOpen(true);
              }}
              onOpenMemberStatement={setStatementMember}
            />
          )}

          {activeTab === 'reminders' && (
            <RemindersView
              fund={activeFund}
              members={members}
              payments={payments}
              selectedMonth={selectedMonth}
              onChangeMonth={setSelectedMonth}
              onLogReminder={handleLogReminder}
              onOpenEditMember={(member) => {
                setEditingMember(member);
                setMemberModalOpen(true);
              }}
              onOpenSettings={() => setSettingsOpen(true)}
              onNotify={showToast}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              fund={activeFund}
              members={members}
              payments={payments}
              selectedMonth={selectedMonth}
              onNotify={showToast}
            />
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Tab Bar (64px height, total sticky <= 15% of viewport) */}
      <nav
        aria-label="التنقل السفلي"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe no-print"
      >
        <div className="grid grid-cols-4 h-16">
          {navItems.map(({ id, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isActive ? 'text-teal-700 font-semibold' : 'text-slate-500'
                }`}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {id === 'reminders' && pendingCount > 0 && (
                    <span className="absolute -top-1.5 -left-2.5 text-[10px] font-mono font-bold text-red-700">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <span className="text-[11px] leading-none whitespace-nowrap">
                  {TAB_META[id].shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Modals & Bottom Sheets */}
      <MemberModal
        isOpen={memberModalOpen}
        member={editingMember}
        currency={activeFund.currency}
        onClose={() => {
          setMemberModalOpen(false);
          setEditingMember(null);
        }}
        onSave={handleSaveMember}
        onDelete={handleDeleteMember}
      />

      <PaymentModal
        entry={paymentModalEntry}
        currency={activeFund.currency}
        onClose={() => setPaymentModalEntry(null)}
        onSave={handleSavePayment}
      />

      <MemberStatementModal
        member={statementMember}
        fund={activeFund}
        payments={payments}
        initialMonth={selectedMonth}
        onClose={() => setStatementMember(null)}
        onNotify={showToast}
      />

      <SettingsModal
        isOpen={settingsOpen}
        fund={activeFund}
        onClose={() => setSettingsOpen(false)}
        onSave={handleSaveSettings}
      />

      {/* Quiet Toast Feedback */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 left-4 right-4 sm:right-auto sm:left-6 z-50 bg-slate-900 text-white text-sm px-4 py-3 rounded-xl shadow-lg max-w-sm no-print"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
