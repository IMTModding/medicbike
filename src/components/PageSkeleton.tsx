import { Skeleton } from '@/components/ui/skeleton';

export const AlertCardSkeleton = () => (
  <div className="bg-card rounded-xl border border-border p-4 space-y-3">
    <div className="flex items-start justify-between">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-4 w-24" />
    </div>
    <Skeleton className="h-5 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <div className="flex gap-2">
      <Skeleton className="h-9 flex-1" />
      <Skeleton className="h-9 flex-1" />
    </div>
  </div>
);

export const StatsSkeleton = () => (
  <div className="grid grid-cols-3 gap-3 mb-6">
    {[1, 2, 3].map((i) => (
      <div key={i} className="bg-card rounded-xl p-3 border border-border">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-4" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-8 w-10" />
      </div>
    ))}
  </div>
);

export const NewsBannerSkeleton = () => (
  <div className="mb-6 bg-card rounded-xl border border-border overflow-hidden">
    <div className="flex items-center gap-3 p-3 bg-primary/10">
      <Skeleton className="h-5 w-5 rounded" />
      <Skeleton className="h-4 w-20" />
    </div>
    <div className="flex gap-3 p-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex-shrink-0 w-32">
          <Skeleton className="w-32 h-20 rounded-lg mb-2" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  </div>
);

export const IndexPageSkeleton = () => (
  <div className="container px-4 py-6 pb-24">
    <NewsBannerSkeleton />
    <StatsSkeleton />
    <div className="flex items-center justify-between mb-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-4 w-24" />
    </div>
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <AlertCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const HistoryCardSkeleton = () => (
  <div className="bg-card rounded-xl border border-border p-4 space-y-3">
    <div className="flex items-start justify-between">
      <Skeleton className="h-5 w-16 rounded-full" />
      <Skeleton className="h-4 w-20" />
    </div>
    <Skeleton className="h-5 w-3/4" />
    <Skeleton className="h-4 w-1/2" />
    <div className="flex gap-4">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-32" />
    </div>
    <div className="bg-secondary/50 rounded-lg p-3">
      <Skeleton className="h-4 w-full" />
    </div>
  </div>
);

export const HistoryPageSkeleton = () => (
  <div className="container px-4 py-6">
    <Skeleton className="h-10 w-full mb-4" />
    <div className="bg-card rounded-xl p-4 border border-border mb-6">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div>
          <Skeleton className="h-8 w-12 mb-1" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <HistoryCardSkeleton key={i} />
      ))}
    </div>
  </div>
);

export const SettingsSkeleton = () => (
  <div className="container px-4 py-6 space-y-6">
    {[1, 2, 3, 4].map((i) => (
      <div key={i} className="bg-card rounded-xl border border-border p-4">
        <Skeleton className="h-5 w-32 mb-4" />
        <Skeleton className="h-10 w-full" />
      </div>
    ))}
  </div>
);
