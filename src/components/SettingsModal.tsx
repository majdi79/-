import React, { useEffect, useState } from 'react';
import { Check, KeyRound, RotateCcw, X } from 'lucide-react';
import { changeUserPassword, mapAuthErrorToArabic } from '../firebase';
import {
  DEFAULT_REMINDER_TEMPLATE,
  FIELD_LIMITS,
  FIXED_CURRENCY_LABEL,
  UserFund,
} from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  fund: UserFund;
  username: string;
  onClose: () => void;
  onSave: (data: {
    fundName: string;
    reminderTemplate: string;
  }) => Promise<void>;
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
  username,
  onClose,
  onSave,
}) => {
  const [fundName, setFundName] = useState(fund.fundName);
  const [reminderTemplate, setReminderTemplate] = useState(fund.reminderTemplate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Change password section state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setFundName(fund.fundName);
    setReminderTemplate(fund.reminderTemplate);
    setError(null);
    setShowPasswordForm(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setPasswordError(null);
    setPasswordSuccess(false);
  }, [isOpen, fund]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
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

  const handlePasswordUpdate = async () => {
    setPasswordError(null);
    setPasswordSuccess(false);
    if (!currentPassword) {
      setPasswordError('يرجى إدخال كلمة المرور الحالية.');
      return;
    }
    if (newPassword.length < FIELD_LIMITS.PASSWORD_MIN) {
      setPasswordError(`كلمة المرور الجديدة يجب أن تكون ${FIELD_LIMITS.PASSWORD_MIN} أحرف على الأقل.`);
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordError('كلمتا المرور الجديدتان غير متطابقتين.');
      return;
    }

    setChangingPassword(true);
    try {
      await changeUserPassword(currentPassword, newPassword);
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      setPasswordError(mapAuthErrorToArabic(err).message);
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-[2px] p-0 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving && !changingPassword) onClose();
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
            إعدادات الصندوق والحساب
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving || changingPassword}
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

          <div className="bg-slate-50 border border-slate-200 rounded-xl divide-y divide-slate-200 text-sm">
            <div className="flex items-center justify-between py-3 px-4">
              <span className="text-slate-600">اسم المستخدم</span>
              <span className="font-mono font-semibold text-slate-900" dir="ltr">
                {username}
              </span>
            </div>
            <div className="flex items-center justify-between py-3 px-4">
              <span className="text-slate-600">العملة المعتمدة</span>
              <span className="font-semibold text-slate-900">{FIXED_CURRENCY_LABEL}</span>
            </div>
          </div>

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

          {/* Change Password Section */}
          <div className="pt-4 border-t border-slate-200 space-y-3">
            <button
              type="button"
              onClick={() => {
                setShowPasswordForm((v) => !v);
                setPasswordError(null);
                setPasswordSuccess(false);
              }}
              className="inline-flex items-center gap-2 text-sm font-medium text-teal-800 hover:text-teal-900 cursor-pointer"
            >
              <KeyRound className="w-4 h-4" />
              <span>{showPasswordForm ? 'إخفاء تغيير كلمة المرور' : 'تغيير كلمة المرور'}</span>
            </button>

            {showPasswordForm && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                {passwordError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {passwordError}
                  </p>
                )}
                {passwordSuccess && (
                  <p className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 flex items-center gap-1.5">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>تم تحديث كلمة المرور بنجاح.</span>
                  </p>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    كلمة المرور الحالية
                  </label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    dir="ltr"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-left"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      كلمة المرور الجديدة
                    </label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      dir="ltr"
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-left"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">
                      تأكيد الجديدة
                    </label>
                    <input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      dir="ltr"
                      className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-left"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handlePasswordUpdate()}
                  disabled={changingPassword}
                  className="h-10 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  {changingPassword ? 'جارٍ التحديث...' : 'تحديث كلمة المرور'}
                </button>
              </div>
            )}
          </div>

          <div className="pt-2 flex items-center gap-3 sticky bottom-0 bg-white pb-safe">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 h-12 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
            >
              {saving ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
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
