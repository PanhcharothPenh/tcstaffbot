import React, { StrictMode, ReactNode, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global Fetch Interceptor to attach Authorization Bearer Header automatically for /api requests
const originalFetch = window.fetch.bind(window);
window.fetch = async function (input, init) {
  let url = '';
  if (typeof input === 'string') {
    url = input;
  } else if (input instanceof URL) {
    url = input.href;
  } else if (input && typeof input === 'object' && 'url' in input) {
    url = (input as any).url;
  }

  const isApi = url.startsWith('/api') || url.startsWith('api') || url.includes('/api/');
  if (isApi) {
    const token = localStorage.getItem('coffee_access_token');
    if (token) {
      if (typeof input === 'string') {
        init = init || {};
        const headers = new Headers(init.headers || {});
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`);
        }
        init.headers = headers;
      } else if (input instanceof Request) {
        if (!input.headers.has('Authorization')) {
          input.headers.set('Authorization', `Bearer ${token}`);
        }
      }
    }
  }

  const response = await originalFetch(input, init);

  if (response.status === 401 && isApi && !url.includes('auth-login') && !url.includes('/api/auth/login')) {
    const hasToken = !!localStorage.getItem('coffee_access_token');
    if (hasToken) {
      localStorage.removeItem('coffee_access_token');
      localStorage.removeItem('coffee_refresh_token');
      localStorage.removeItem('coffee_user_session');
      window.dispatchEvent(new Event('unauthorized-session-expired'));
    }
  }

  return response;
};

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class RootErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  props: ErrorBoundaryProps;
  state: ErrorBoundaryState = { hasError: false, error: null };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('RootErrorBoundary caught unhandled application failure:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 bg-red-500/20 text-red-400 rounded-full flex items-center justify-center mb-4 text-3xl font-black">
            !
          </div>
          <h1 className="text-xl font-black mb-2">TC Staff Management Notice</h1>
          <p className="text-slate-400 text-sm max-w-md mb-6">
            A temporary display error occurred. Click below to reload the workspace safely.
          </p>
          <pre className="text-[11px] text-rose-300 bg-slate-800 p-3 rounded-lg max-w-lg overflow-auto mb-6 text-left border border-slate-700">
            {(this.state as any).error?.message || 'Unknown render exception'}
          </pre>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/';
            }}
            className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg cursor-pointer"
          >
            Clear Cache &amp; Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </StrictMode>,
);

