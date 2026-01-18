import React from "react";
import { FatalErrorFallback } from "@/components/FatalErrorFallback";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  error: unknown;
};

export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown) {
    // Keep a breadcrumb in case the UI is unusable.
    try {
      (window as any).__MEDICBIKE_BOOT_ERROR__ = error;
    } catch {
      // ignore
    }
  }

  render() {
    if (this.state.hasError) {
      return <FatalErrorFallback error={this.state.error} />;
    }

    return this.props.children;
  }
}
