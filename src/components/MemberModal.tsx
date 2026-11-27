import React, { useEffect, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { FamilyMember, FIELD_LIMITS } from '../types';
import { getCurrentMonthKey, normalizePhoneInput } from '../utils/format';

interface MemberModalProps {
  isOpen: boolean;
  member: FamilyMember | null;
  currency: string;
  onClose: () => void;
  onSave: (data: {
    name: string;
    phone: string;
    relation: string;
    monthlyAmount: number;
    startMonth: string;
    isActive: boolean;
  }) => Promise<void>;
  onDelete?: (member: FamilyMember) => Promise<void>;
}

export const MemberModal: React.FC<MemberModalProps> = ({
  isOpen,
  member,
  currency,
  onClose,
  onSave,
  onDelete,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [relation, setRelation] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [startMonth, setStartMonth] = useState(getCurrentMonthKey());
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setConfirmDelete(false);
    if (member) {
      setName(member.name);
      setPhone(member.phone);
      setRelation(member.relation);
      setMonthlyAmount(String(member.monthlyAmount));
      setStartMonth(member.startMonth);
      setIsActive(member.isActive);
    } else {
      setName('');
      setPhone('');
      setRelation('');
      setMonthlyAmount('');
      setStartMonth(getCurrentMonthKey());
      setIsActive(true);
    }
  }, [isOpen, member]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('يرجى إدخال اسم الفرد.');
      return;
    }
    const parsedAmount = Number(monthlyAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0 || parsedAmount > FIELD_LIMITS.AMOUNT_MAX) {
      setError('يرجى إدخال مبلغ شهري صحيح.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        name: trimmedName,
        phone: normalizePhoneInput(phone),
        relation: relation.trim(),
        monthlyAmount: parsedAmount,
        startMonth,
        isActive,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء الحفظ.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!member || !onDelete) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete(member);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حذف الفرد.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="member-modal-title"
      >
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />

        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 id="member-modal-title" className="text-lg font-bold font-display text-slate-900">
            {member ? 'تعديل بيانات الفرد' : 'إضافة فرد جديد للعائلة'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="إغلاق"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500 hover:text-slate-900 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="member-name" className="block text-sm font-medium text-slate-700 mb-1.5">
              اسم الفرد
            </label>
            <input
              id="member-name"
              type="text"
              required
              maxLength={FIELD_LIMITS.MEMBER_NAME_MAX}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="مثال: عبدالله محمد"
              className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="member-amount" className="block text-sm font-medium text-slate-700 mb-1.5">
                المبلغ الشهري المقرر ({currency})
              </label>
              <input
                id="member-amount"
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                max={FIELD_LIMITS.AMOUNT_MAX}
                required
                value={monthlyAmount}
                onChange={(e) => setMonthlyAmount(e.target.value)}
                placeholder="20"
                dir="ltr"
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm font-mono tabular-nums text-left text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label htmlFor="member-start" className="block text-sm font-medium text-slate-700 mb-1.5">
                بداية الاشتراك (شهر)
              </label>
              <input
                id="member-start"
                type="month"
                required
                value={startMonth}
                onChange={(e) => setStartMonth(e.target.value)}
                dir="ltr"
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label htmlFor="member-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
              رقم الواتساب (مع رمز الدولة)
            </label>
            <input
              id="member-phone"
              type="tel"
              maxLength={FIELD_LIMITS.PHONE_MAX}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+97333123456"
              dir="ltr"
              className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm font-mono tabular-nums text-left text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
            <p className="text-xs text-slate-500 mt-1">
              أضف رمز الدولة (مثل +973 للبحرين) لتوجيه التذكيرات والتقارير الشخصية مباشرة للواتساب.
            </p>
          </div>

          <div>
            <label htmlFor="member-relation" className="block text-sm font-medium text-slate-700 mb-1.5">
              صلة القرابة أو ملاحظة (اختياري)
            </label>
            <input
              id="member-relation"
              type="text"
              maxLength={FIELD_LIMITS.RELATION_MAX}
              value={relation}
              onChange={(e) => setRelation(e.target.value)}
              placeholder="مثال: الأخ الأكبر، الوالد، ابن العم"
              className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>

          {member && (
            <div className="pt-2 flex items-center justify-between border-t border-slate-100">
              <div>
                <p className="text-sm font-medium text-slate-900">حالة الاشتراك الشهري</p>
                <p className="text-xs text-slate-500">
                  إيقاف الفرد مؤقتاً يحفظ سجله السابق دون مطالبته بالأشهر القادمة.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                onClick={() => setIsActive((v) => !v)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px] ${
                  isActive
                    ? 'bg-teal-50 border-teal-200 text-teal-800'
                    : 'bg-slate-100 border-slate-200 text-slate-600'
                }`}
              >
                {isActive ? 'نشط' : 'موقوف مؤقتاً'}
              </button>
            </div>
          )}

          {member && onDelete && (
            <div className="pt-3 border-t border-slate-200">
              {!confirmDelete ? (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-2 text-sm text-red-700 hover:text-red-800 font-medium py-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف الفرد وجميع سجلاته</span>
                </button>
              ) : (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                  <p className="text-sm text-red-800">
                    هل أنت متأكد من حذف <strong>{member.name}</strong>؟ سيتم حذف جميع سجلات دفعاته بشكل نهائي.
                  </p>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer min-h-[40px]"
                    >
                      تأكيد الحذف النهائي
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      disabled={saving}
                      className="px-4 py-2 bg-white border border-slate-300 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-50 transition-colors cursor-pointer min-h-[40px]"
                    >
                      تراجع
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-3 flex items-center gap-3 sticky bottom-0 bg-white pb-safe">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-12 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {saving ? 'جارٍ الحفظ...' : member ? 'حفظ التعديلات' : 'إضافة الفرد'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="h-12 px-5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
