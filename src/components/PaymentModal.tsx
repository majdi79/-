import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { FIELD_LIMITS } from '../types';
import {
  formatAmount,
  formatMonthArabic,
  getTodayIsoDate,
  ResolvedMonthEntry,
} from '../utils/format';

interface PaymentModalProps {
  entry: ResolvedMonthEntry | null;
  currency: string;
  onClose: () => void;
  onSave: (data: {
    memberId: string;
    monthKey: string;
    expectedAmount: number;
    paidAmount: number;
    paidDate: string;
    note: string;
  }) => Promise<void>;
}

const NOTE_PRESETS = ['تحويل بنكي', 'نقداً', 'محفظة إلكترونية', 'دفعة جزئية'];

export const PaymentModal: React.FC<PaymentModalProps> = ({
  entry,
  currency,
  onClose,
  onSave,
}) => {
  const [expectedAmount, setExpectedAmount] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paidDate, setPaidDate] = useState(getTodayIsoDate());
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) return;
    setError(null);
    setExpectedAmount(String(entry.expectedAmount));
    setPaidAmount(
      entry.status === 'unpaid' ? String(entry.expectedAmount) : String(entry.paidAmount)
    );
    setPaidDate(entry.paidDate || getTodayIsoDate());
    setNote(entry.note || '');
  }, [entry]);

  if (!entry) return null;

  const expectedNum = Number(expectedAmount) || 0;
  const paidNum = Number(paidAmount) || 0;
  const remaining = Math.max(0, Math.round((expectedNum - paidNum) * 1000) / 1000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const exp = Number(expectedAmount);
    const paid = Number(paidAmount);
    if (!Number.isFinite(exp) || exp < 0 || exp > FIELD_LIMITS.AMOUNT_MAX) {
      setError('المبلغ المقرر غير صالح.');
      return;
    }
    if (!Number.isFinite(paid) || paid < 0 || paid > FIELD_LIMITS.AMOUNT_MAX) {
      setError('المبلغ المدفوع غير صالح.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        memberId: entry.member.id,
        monthKey: entry.monthKey,
        expectedAmount: exp,
        paidAmount: paid,
        paidDate: paid > 0 ? paidDate || getTodayIsoDate() : '',
        note: note.trim(),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ الدفعة.');
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
        aria-labelledby="payment-modal-title"
      >
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />

        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 id="payment-modal-title" className="text-lg font-bold font-display text-slate-900 truncate">
              تسجيل دفعة — {entry.member.name}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatMonthArabic(entry.monthKey)}
              {entry.member.relation ? ` · ${entry.member.relation}` : ''}
            </p>
          </div>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Quick payment amount shortcuts */}
          <div>
            <span className="block text-xs font-medium text-slate-500 mb-2">اختيار سريع للحالة</span>
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setPaidAmount(String(expectedNum));
                  if (!paidDate) setPaidDate(getTodayIsoDate());
                }}
                className={`h-10 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  paidNum >= expectedNum && expectedNum > 0
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                دفع كامل
              </button>
              <button
                type="button"
                onClick={() => {
                  setPaidAmount(String(Math.round((expectedNum / 2) * 1000) / 1000));
                  if (!paidDate) setPaidDate(getTodayIsoDate());
                }}
                className={`h-10 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  paidNum > 0 && paidNum < expectedNum
                    ? 'bg-white text-amber-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                نصف المبلغ
              </button>
              <button
                type="button"
                onClick={() => setPaidAmount('0')}
                className={`h-10 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  paidNum === 0
                    ? 'bg-white text-red-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                لم يدفع (0)
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="paid-amount" className="block text-sm font-medium text-slate-700 mb-1.5">
                المبلغ المدفوع ({currency})
              </label>
              <input
                id="paid-amount"
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                max={FIELD_LIMITS.AMOUNT_MAX}
                required
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                dir="ltr"
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-base font-mono font-semibold tabular-nums text-left text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label htmlFor="expected-amount" className="block text-sm font-medium text-slate-700 mb-1.5">
                المبلغ المقرر لهذا الشهر ({currency})
              </label>
              <input
                id="expected-amount"
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                max={FIELD_LIMITS.AMOUNT_MAX}
                required
                value={expectedAmount}
                onChange={(e) => setExpectedAmount(e.target.value)}
                dir="ltr"
                className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm font-mono tabular-nums text-left text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            <span className="text-slate-600">المتبقي على الفرد لهذا الشهر</span>
            <span
              className={`font-mono font-semibold tabular-nums ${
                remaining === 0 ? 'text-emerald-700' : 'text-red-700'
              }`}
              dir="ltr"
            >
              {formatAmount(remaining, currency)}
            </span>
          </div>

          <div>
            <label htmlFor="paid-date" className="block text-sm font-medium text-slate-700 mb-1.5">
              تاريخ الدفع
            </label>
            <input
              id="paid-date"
              type="date"
              value={paidDate}
              onChange={(e) => setPaidDate(e.target.value)}
              disabled={paidNum === 0}
              dir="ltr"
              className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm font-mono tabular-nums text-slate-900 disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label htmlFor="payment-note" className="block text-sm font-medium text-slate-700 mb-1.5">
              ملاحظة أو طريقة الدفع (اختياري)
            </label>
            <input
              id="payment-note"
              type="text"
              maxLength={FIELD_LIMITS.NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: تحويل بنكي"
              className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {NOTE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setNote(preset)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center gap-3 sticky bottom-0 bg-white pb-safe">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-12 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ حالة الدفع'}
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
