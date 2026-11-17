import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'Unexpected application error',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App ErrorBoundary caught error:', error, info);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isArabic =
      typeof document !== 'undefined' && document.documentElement.lang !== 'en';

    return (
      <div
        dir={isArabic ? 'rtl' : 'ltr'}
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--bg, #f8fafc)',
          color: 'var(--text, #0f172a)',
        }}
      >
        <div
          style={{
            maxWidth: '420px',
            width: '100%',
            background: 'var(--card, #ffffff)',
            border: '1px solid var(--line, #e2e8f0)',
            borderRadius: '18px',
            padding: '22px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '8px' }}>
            {isArabic ? 'حدث خطأ أثناء الاتصال بالبيانات' : 'A data connection error occurred'}
          </div>
          <div
            style={{
              fontSize: '13.5px',
              opacity: 0.78,
              lineHeight: 1.6,
              marginBottom: '16px',
            }}
          >
            {isArabic
              ? 'يرجى إعادة تحميل التطبيق والمحاولة مرة أخرى.'
              : 'Please reload the app and try again.'}
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ width: '100%' }}
          >
            {isArabic ? 'إعادة التحميل' : 'Reload App'}
          </button>
        </div>
      </div>
    );
  }
}
