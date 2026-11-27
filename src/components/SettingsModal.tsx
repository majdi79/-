import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import {
  DEFAULT_FUND_ID,
  DEFAULT_REMINDER_TEMPLATE,
  FIELD_LIMITS,
  FIELD_PATTERNS,
  FIXED_CURRENCY_LABEL,
  UserFund,
} from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  fund: UserFund;
  fundId: string;
  onClose: () => void;
  onSave: (data: {
    fundName: string;
    reminderTemplate: string;
  }) => Promise<void>;
  onChangeFundId: (nextFundId: string) => void;
}

const TEMPLATE_TOKENS = [
  '{الاسم}',
  '{اسم_الصندوق}',
  '{الشهر}',
  '{المبلغ_المقرر}',
  '{المدفوع}',
  '{المتبقي}',
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  fund,
  fundId,
  onClose,
  onSave,
  onChangeFundId,
}) => {
  const [fundName, setFundName] = useState(fund.fundName);
  const [reminderTemplate, setReminderTemplate] = useState(fund.reminderTemplate);
  const [syncCode, setSyncCode] = useState(fundId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFundName(fund.fundName);
    setReminderTemplate(fund.reminderTemplate);
    setSyncCode(fundId);
    setError(null);
  }, [isOpen, fund, fundId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedCode = syncCode.trim();
    if (!FIELD_PATTERNS.FUND_ID.test(trimmedCode)) {
      setError('رمز المزامنة يجب أن يكون من 6 إلى 64 حرفاً إنجليزياً أو أرقاماً أو (-) أو (_) بدون مسافات.');
      return;
    }

    if (trimmedCode !== fundId) {
      onChangeFundId(trimmedCode);
      onClose();
      return;
    }

    if (!fundName.trim()) {
      setError('يرجى إدخال اسم الصندوق.');
      return;
    }
    setSaving(true);
    try {
      await onSave({
        fundName: fundName.trim(),
        reminderTemplate: reminderTemplate.trim() || DEFAULT_REMINDER_TEMPLATE,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذّر حفظ الإعدادات.');
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
        aria-labelledby="settings-modal-title"
      >
        <div className="sm:hidden w-10 h-1.5 bg-slate-300 rounded-full mx-auto mt-3" />

        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <h2 id="settings-modal-title" className="text-lg font-bold font-display text-slate-900">
            إعدادات الصندوق والرسائل
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fund-name" className="block text-sm font-medium text-slate-700 mb-1.5">
              اسم الصندوق العائلي
            </label>
            <input
              id="fund-name"
              type="text"
              required
              maxLength={FIELD_LIMITS.FUND_NAME_MAX}
              value={fundName}
              onChange={(e) => setFundName(e.target.value)}
              placeholder="مثال: صندوق عائلة آل محمد"
              className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
          </div>

          <div className="flex items-center justify-between py-3 px-4 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            <span className="text-slate-600">العملة المعتمدة</span>
            <span className="font-semibold text-slate-900">{FIXED_CURRENCY_LABEL}</span>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="reminder-template" className="text-sm font-medium text-slate-700">
                قالب رسالة التذكير عبر واتساب
              </label>
              <button
                type="button"
                onClick={() => setReminderTemplate(DEFAULT_REMINDER_TEMPLATE)}
                className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>استعادة الافتراضي</span>
              </button>
            </div>
            <textarea
              id="reminder-template"
              rows={5}
              required
              maxLength={FIELD_LIMITS.REMINDER_TEMPLATE_MAX}
              value={reminderTemplate}
              onChange={(e) => setReminderTemplate(e.target.value)}
              className="w-full p-3.5 rounded-lg border border-slate-300 text-sm text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
            <div className="mt-2">
              <span className="block text-xs text-slate-500 mb-1.5">
                اضغط على أي متغير لإدراجه تلقائياً داخل نص الرسالة:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATE_TOKENS.map((token) => (
                  <button
                    key={token}
                    type="button"
                    onClick={() =>
                      setReminderTemplate((prev) =>
                        `${prev}${prev.endsWith(' ') || prev.endsWith('\n') || !prev ? '' : ' '}${token}`.slice(
                          0,
                          FIELD_LIMITS.REMINDER_TEMPLATE_MAX
                        )
                      )
                    }
                    className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                  >
                    {token}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="sync-code" className="text-sm font-medium text-slate-700">
                رمز الصندوق للمزامنة بين الأجهزة
              </label>
              {syncCode !== DEFAULT_FUND_ID && (
                <button
                  type="button"
                  onClick={() => setSyncCode(DEFAULT_FUND_ID)}
                  className="text-xs text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  الافتراضي
                </button>
              )}
            </div>
            <input
              id="sync-code"
              type="text"
              maxLength={FIELD_LIMITS.FUND_ID_MAX}
              value={syncCode}
              onChange={(e) => setSyncCode(e.target.value)}
              dir="ltr"
              placeholder={DEFAULT_FUND_ID}
              className="w-full h-11 px-3.5 rounded-lg border border-slate-300 text-sm font-mono text-left text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
            />
            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
              تتزامن بياناتك تلقائياً بين الكمبيوتر والهاتف باستخدام نفس الرمز. يمكنك تغييره إلى رمز
              خاص بعائلتك (حروف إنجليزية وأرقام فقط) ثم إدخاله في أجهزتك الأخرى.
            </p>
          </div>

          <div className="pt-2 flex items-center gap-3 sticky bottom-0 bg-white pb-safe">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-12 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {saving ? 'جارٍ الحفظ...' : syncCode.trim() !== fundId ? 'تبديل رمز الصندوق' : 'حفظ الإعدادات'}
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
