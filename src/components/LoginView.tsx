import React, { useState } from 'react';
import {
  AlertCircle,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Lock,
  MessageCircle,
  Smartphone,
  User,
  Users,
} from 'lucide-react';
import {
  AuthActionError,
  firebaseProjectId,
  mapAuthErrorToArabic,
  normalizeUsernameInput,
  registerWithUsernamePassword,
  signInWithUsernamePassword,
} from '../firebase';
import { FIELD_LIMITS, FIELD_PATTERNS, FIXED_CURRENCY_LABEL } from '../types';

type AuthMode = 'login' | 'register';

export const LoginView: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<AuthActionError | null>(null);

  const providersConsoleUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/authentication/providers`;

  const validateUsername = (val: string): string | null => {
    const cleaned = normalizeUsernameInput(val);
    if (!cleaned) return 'يرجى إدخال اسم المستخدم.';
    if (cleaned.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
        return 'صيغة البريد الإلكتروني غير صحيحة.';
      }
      return null;
    }
    if (!FIELD_PATTERNS.USERNAME.test(cleaned)) {
      return `اسم المستخدم يجب أن يتكون من ${FIELD_LIMITS.USERNAME_MIN} إلى ${FIELD_LIMITS.USERNAME_MAX} حرفاً إنجليزياً أو أرقاماً (مثل: majdi أو family_2026) بدون مسافات.`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const usernameError = validateUsername(username);
    if (usernameError) {
      setError({ message: usernameError });
      return;
    }

    if (password.length < FIELD_LIMITS.PASSWORD_MIN) {
      setError({
        message: `كلمة المرور يجب أن تتكون من ${FIELD_LIMITS.PASSWORD_MIN} أحرف على الأقل.`,
      });
      return;
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError({ message: 'كلمتا المرور غير متطابقتين.' });
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signInWithUsernamePassword(username, password);
      } else {
        await registerWithUsernamePassword(username, password);
      }
    } catch (err) {
      setError(mapAuthErrorToArabic(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
          <span className="text-xl font-extrabold font-display text-teal-800 whitespace-nowrap shrink-0">
            صندوق العائلة
          </span>
          <span className="hidden sm:inline text-xs text-slate-500 whitespace-nowrap">
            إدارة الاشتراكات الشهرية · {FIXED_CURRENCY_LABEL}
          </span>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
            className="text-sm font-medium text-teal-800 hover:text-teal-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {mode === 'login' ? 'إنشاء حساب جديد' : 'لديك حساب؟ تسجيل الدخول'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-stretch">
          {/* Login / Register Card */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-center">
            <div className="mb-6">
              <h1 className="text-2xl font-extrabold font-display text-slate-900">
                {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {mode === 'login'
                  ? 'أدخل اسم المستخدم وكلمة المرور للوصول إلى صندوق العائلة من هاتفك أو الكمبيوتر.'
                  : 'أنشئ اسم مستخدم وكلمة مرور لحفظ اشتراكات العائلة ومزامنتها بين أجهزتك.'}
              </p>
            </div>

            {/* Mode Segmented Control */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`h-10 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  mode === 'login'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                تسجيل الدخول
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className={`h-10 text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  mode === 'register'
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                حساب جديد
              </button>
            </div>

            {error && (
              <div className="mb-5 bg-red-50 border border-red-200 rounded-xl p-4 space-y-2.5 text-sm text-red-800">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-700" />
                  <span>{error.message}</span>
                </div>
                {error.needsConsoleEnable && (
                  <div className="pt-2 border-t border-red-200/80 text-xs text-slate-700 space-y-1.5 leading-relaxed">
                    <p className="font-semibold text-slate-900">
                      لتفعيل الدخول باسم المستخدم وكلمة المرور (مرة واحدة فقط):
                    </p>
                    <ol className="list-decimal pr-4 space-y-1">
                      <li>افتح صفحة مزودي تسجيل الدخول في وحدة تحكم Firebase.</li>
                      <li>اضغط على <strong>Add new provider</strong> ثم اختر <strong>Email/Password</strong>.</li>
                      <li>فعّل خيار <strong>Enable</strong> واضغط <strong>Save</strong>، ثم أعد المحاولة هنا.</li>
                    </ol>
                    <a
                      href={providersConsoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-teal-800 font-semibold underline underline-offset-4 pt-1"
                    >
                      <span>فتح إعدادات Authentication في Firebase Console</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="auth-username" className="block text-sm font-medium text-slate-700 mb-1.5">
                  اسم المستخدم
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-username"
                    type="text"
                    autoComplete="username"
                    required
                    maxLength={64}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: majdi"
                    dir="ltr"
                    className="w-full h-11 pr-10 pl-3.5 rounded-lg border border-slate-300 text-sm font-mono text-left text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  حروف إنجليزية وأرقام فقط بدون مسافات (3 أحرف على الأقل).
                </p>
              </div>

              <div>
                <label htmlFor="auth-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    required
                    minLength={FIELD_LIMITS.PASSWORD_MIN}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    dir="ltr"
                    className="w-full h-11 pr-10 pl-11 rounded-lg border border-slate-300 text-sm text-left text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                    className="absolute left-1 top-1/2 -translate-y-1/2 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {mode === 'register' && (
                <div>
                  <label htmlFor="auth-confirm-password" className="block text-sm font-medium text-slate-700 mb-1.5">
                    تأكيد كلمة المرور
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="auth-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      required
                      minLength={FIELD_LIMITS.PASSWORD_MIN}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      className="w-full h-11 pr-10 pl-3.5 rounded-lg border border-slate-300 text-sm text-left text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-700"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 mt-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
              >
                {submitting
                  ? 'جارٍ التحقق...'
                  : mode === 'login'
                    ? 'دخول إلى الصندوق'
                    : 'إنشاء الحساب والدخول'}
              </button>
            </form>
          </div>

          {/* Right Context Panel */}
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6 lg:pr-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-teal-700">
                صندوق العائلة · {FIXED_CURRENCY_LABEL}
              </p>
              <h2 className="text-3xl sm:text-4xl font-extrabold font-display text-slate-900 leading-tight">
                تابع اشتراكات العائلة الشهرية وأرسل التقارير والتذكيرات عبر واتساب
              </h2>
              <p className="text-base text-slate-600 leading-relaxed max-w-xl">
                سجّل دخولك بنفس اسم المستخدم وكلمة المرور من هاتفك أو جهاز الكمبيوتر لتبقى جميع
                الدفعات والتقارير محدثة ومحفوظة بخصوصية تامة.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2">
              <div className="flex items-start gap-3">
                <Users className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">مبلغ مرصود لكل فرد</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    حدد الاشتراك الشهري بالدينار البحريني لكل فرد مع دعم الدفع الكامل أو الجزئي.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <MessageCircle className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">تذكير غير المسددين</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    إرسال تذكير شخصي عبر واتساب لكل فرد متأخر أو رسالة جماعية للمجموعة.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <FileText className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">تقارير شهرية وفردية</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    أصدر تقريراً لشهر أو لفترة معينة أو كشف حساب شخصي وشاركه مباشرة عبر واتساب.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">مزامنة بين الهاتف والكمبيوتر</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    بياناتك مرتبطة بحسابك الشخصي ومحمية بقواعد أمان تمنع وصول أي شخص آخر.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-slate-500 flex items-center justify-between">
          <span>صندوق العائلة — إدارة الاشتراكات الشهرية</span>
          <span>{FIXED_CURRENCY_LABEL}</span>
        </div>
      </footer>
    </div>
  );
};
