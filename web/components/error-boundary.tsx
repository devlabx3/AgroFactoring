"use client";

import { Component, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Warning, ArrowsClockwise } from "@phosphor-icons/react";

interface ErrorBoundaryLabels {
  title: string;
  fallbackMessage: string;
  retry: string;
}

const DEFAULT_LABELS: ErrorBoundaryLabels = {
  title: "Something went wrong",
  fallbackMessage: "An unexpected error occurred",
  retry: "Retry",
};

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  labels?: ErrorBoundaryLabels;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const labels = this.props.labels ?? DEFAULT_LABELS;

      return (
        <Card className="border-danger/30">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <Warning weight="duotone" className="h-10 w-10 text-danger" />
            <div>
              <p className="font-semibold">{labels.title}</p>
              <p className="mt-1 text-sm text-text-muted">
                {this.state.error?.message || labels.fallbackMessage}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <ArrowsClockwise weight="duotone" className="mr-2 h-4 w-4" />
              {labels.retry}
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}
