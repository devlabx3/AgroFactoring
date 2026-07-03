"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function ContractOverviewSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-32" />
            <Skeleton className="mt-2 h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PhaseTimelineSkeleton() {
  return (
    <div>
      <Skeleton className="mb-6 h-6 w-48" />

      {/* Desktop */}
      <div className="hidden sm:flex items-start justify-between gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="mt-3 h-3 w-16" />
            <Skeleton className="mt-1 h-3 w-12" />
          </div>
        ))}
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-4 sm:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-start gap-4">
            <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
            <div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-1 h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PhaseLedgerSkeleton() {
  return (
    <div>
      <Skeleton className="mb-4 h-6 w-56" />
      <div className="rounded-lg border border-border">
        <div className="grid grid-cols-5 gap-4 border-b border-border px-4 py-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="grid grid-cols-5 gap-4 border-b border-border px-4 py-3 last:border-0"
          >
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <ContractOverviewSkeleton />
      <Card>
        <CardContent className="p-6">
          <PhaseTimelineSkeleton />
        </CardContent>
      </Card>
      <PhaseLedgerSkeleton />
    </div>
  );
}
