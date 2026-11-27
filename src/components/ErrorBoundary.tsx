import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { firebaseProjectId, firestoreDatabaseId } from '../firebase';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
  isQuotaError: boolean;
  isFreeDailyReadQuota: boolean;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
      isQuotaError: false,
      isFreeDailyReadQuota: false,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    const raw = error?.message || 'حدث خطأ غير متوقع.';
    let parsedMsg = raw;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.error === 'string') {
        parsedMsg = parsed.error;
      }
    } catch {
      // plain string error
    }

    const isQuotaError = parsedMsg.toLowerCase().includes('quota exceeded');
    const isFreeDailyReadQuota = parsedMsg.includes(
      "Quota exceeded for quota metric 'Free daily read units per project (free tier database)'"
    );

    return {
      hasError: true,
      message: parsedMsg,
      isQuotaError,
      isFreeDailyReadQuota,
    };
  }

  componentDidCatch(error: Error): void {
    console.error('Application ErrorBoundary caught:', error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const upgradeUrl = `https://console.firebase.google.com/project/${firebaseProjectId}/firestore/databases/${firestoreDatabaseId}/data?openUpgradeDialog=true`;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-8 space-y-5">
          <div className="flex items-center gap-3 text-red-700">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            <h1 className="text-xl font-bold font-display">تعذّر إكمال العملية</h1>
          </div>

          {this.state.isQuotaError ? (
            <div className="space-y-3 text-sm text-slate-700 leading-relaxed">
              <p>
                تم تجاوز الحد اليومي المجاني لقاعدة البيانات (Quota exceeded). سيتم إعادة تعيين
                الحصة تلقائياً في اليوم التالي.
              </p>
              {this.state.isFreeDailyReadQuota && (
                <a
                  href={upgradeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-teal-700 underline underline-offset-4 font-medium"
                >
                  فتح إعدادات الترقية في وحدة تحكم Firebase
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed">
              حدث خطأ أثناء الاتصال بقاعدة البيانات أو التحقق من الصلاحيات. يرجى إعادة تحميل الصفحة
              والمحاولة مجدداً.
            </p>
          )}

          <div className="text-xs font-mono text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3 break-words" dir="ltr">
            {this.state.message}
          </div>

          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة تحميل البرنامج</span>
          </button>
        </div>
      </div>
    );
  }
}
