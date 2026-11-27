import React, { useState } from 'react';
import { ArrowLeft, Check, FileText, MessageCircle, Smartphone, Users } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

export const AuthGate: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('popup-closed-by-user')) {
        setError('تم إغلاق نافذة تسجيل الدخول قبل الإتمام.');
      } else {
        setError('تعذّر تسجيل الدخول بحساب Google. يرجى المحاولة مرة أخرى.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between" dir="rtl">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <span className="text-xl font-bold font-display text-slate-900 whitespace-nowrap shrink-0">
            صندوق العائلة
          </span>
          <span className="hidden sm:inline text-sm text-slate-500 whitespace-nowrap">
            إدارة الاشتراكات الشهرية · الكمبيوتر والهاتف
          </span>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {loading ? 'جارٍ الدخول...' : 'تسجيل الدخول'}
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-6xl mx-auto w-full px-6 py-12 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
            <p className="text-sm font-medium text-teal-700">
              دفتر اشتراكات عائلي متزامن بين أجهزتك
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold font-display text-slate-900 leading-tight">
              نظّم اشتراكات العائلة الشهرية وشارك التقارير عبر واتساب بوضوح تام
            </h1>
            <p className="text-base text-slate-600 leading-relaxed max-w-2xl">
              حدّد المبلغ الشهري المرصود لكل فرد مرة واحدة، وتابع السداد الكامل أو الجزئي من هاتفك
              أو جهاز الكمبيوتر، ثم أرسل التذكيرات وكشوفات الحساب الشخصية والجمعية مباشرة عبر
              واتساب.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <button
                type="button"
                onClick={handleSignIn}
                disabled={loading}
                className="inline-flex items-center justify-center gap-3 px-6 py-3.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-base font-semibold rounded-xl transition-colors cursor-pointer min-h-[48px]"
              >
                <span>{loading ? 'جارٍ الاتصال بحساب Google...' : 'الدخول بحساب Google للبدء'}</span>
                <ArrowLeft className="w-4 h-4 shrink-0" />
              </button>
              <span className="text-xs text-slate-500">
                بياناتك محفوظة بحسابك ومزامنة تلقائياً بين الهاتف والكمبيوتر
              </span>
            </div>

            {error && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                {error}
              </p>
            )}
          </div>

          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between gap-6">
            <div>
              <h2 className="text-lg font-bold font-display text-slate-900 mb-5">
                ما يوفره لك النظام
              </h2>
              <ul className="space-y-5">
                <li className="flex items-start gap-3.5">
                  <Users className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">مبلغ مرصود مسبقاً لكل فرد</p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      أضف أفراد العائلة بمبالغهم الشهرية وأرقام الواتساب مع دعم الدفع الكامل أو الجزئي.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5">
                  <MessageCircle className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">تذكير فوري لغير المسددين</p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      رسائل تذكير مخصصة جاهزة للإرسال الشخصي لكل فرد لم يدفع، أو تذكير جماعي للمجموعة.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5">
                  <FileText className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">تقارير شهرية ولفترة ولكل فرد</p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      أصدر تقريراً مبسطاً لشهر أو عدة أشهر، أو كشف حساب فردي خاص، وشاركه بضغطة زر عبر واتساب.
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3.5">
                  <Smartphone className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">يعمل بسلاسة على الهاتف والكمبيوتر</p>
                    <p className="text-sm text-slate-600 mt-0.5">
                      واجهة متجاوبة بالكامل تحفظ بياناتك سحابياً لتصل إليها في أي وقت ومن أي جهاز.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="pt-5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Check className="w-4 h-4 text-teal-700" />
                <span>خصوصية كاملة لحسابك فقط</span>
              </span>
              <span>مزامنة فورية</span>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-4 text-xs text-slate-500 flex items-center justify-between">
          <span>صندوق العائلة — إدارة الاشتراكات الشهرية</span>
          <span>متوافق مع الهواتف وأجهزة الكمبيوتر</span>
        </div>
      </footer>
    </div>
  );
};
