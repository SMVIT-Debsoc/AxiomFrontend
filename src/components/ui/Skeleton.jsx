import {motion as Motion} from "framer-motion";
import LoadingIndicator from "./LoadingIndicator";

// Preserve the final layout while data arrives; decorative blocks stay silent.
export function Skeleton({className = "", animate = true}) {
  return (
    <div
      className={`axiom-skeleton ${animate ? "axiom-skeleton--animated" : ""} ${className}`}
      aria-hidden="true"
    />
  );
}

// Card Skeleton
export function CardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4" aria-hidden="true">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

// Event Card Skeleton
export function EventCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-5 space-y-4" aria-hidden="true">
      <div className="flex items-start gap-4">
        <Skeleton className="w-12 h-12 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      </div>
      <div className="flex items-center justify-between pt-3 border-t border-border/60">
        <Skeleton className="h-5 w-20 rounded-md" />
        <Skeleton className="h-8 w-24 rounded-lg" />
      </div>
    </div>
  );
}

// Round Card Skeleton
export function RoundCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-6" aria-hidden="true">
      <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      <Skeleton className="h-6 w-20 rounded shrink-0" />
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}

// Profile Header Skeleton
export function ProfileHeaderSkeleton() {
  return (
    <div className="bg-card rounded-xl p-6" aria-hidden="true">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="w-16 h-16 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="bg-muted/50 rounded-xl p-4">
        <div className="flex justify-between">
          <div className="flex-1 text-center space-y-2">
            <Skeleton className="h-6 w-12 mx-auto" />
            <Skeleton className="h-3 w-16 mx-auto" />
          </div>
          <div className="flex-1 text-center space-y-2">
            <Skeleton className="h-6 w-12 mx-auto" />
            <Skeleton className="h-3 w-16 mx-auto" />
          </div>
          <div className="flex-1 text-center space-y-2">
            <Skeleton className="h-6 w-12 mx-auto" />
            <Skeleton className="h-3 w-16 mx-auto" />
          </div>
        </div>
      </div>
    </div>
  );
}

// List Item Skeleton
export function ListItemSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-4" aria-hidden="true">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full shrink-0" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      <Skeleton className="h-8 w-20 rounded-full shrink-0" />
      </div>
    </div>
  );
}

// Table Row Skeleton
export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border" aria-hidden="true">
      <Skeleton className="w-8 h-8 rounded-full" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-16" />
      <Skeleton className="h-8 w-20 rounded" />
    </div>
  );
}

// Dashboard Home Skeleton
export function DashboardHomeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="axiom-page-header">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <LoadingIndicator label="Loading your debate desk" />
      <div
        className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]"
        aria-busy="true"
      >
        <div className="min-w-0 space-y-5">
          <ProfileHeaderSkeleton />
          <EventCardSkeleton />
        </div>
        <div className="min-w-0 space-y-5">
          <CardSkeleton />
          <div className="bg-card rounded-xl p-6 space-y-4" aria-hidden="true">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-6 w-full" />
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center gap-4">
                <Skeleton className="h-8 w-8 shrink-0" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <Skeleton className="h-36 w-full rounded-xl" />
    </div>
  );
}

// Event Details Skeleton
export function EventDetailsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-8" aria-busy="true">
      {/* Header Skeleton */}
      <div>
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="bg-card border border-border rounded-3xl p-8 md:p-12">
          <div className="space-y-4">
            <div className="flex gap-3">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-12 w-3/4" />
            <Skeleton className="h-6 w-full" />
          </div>
        </div>
      </div>

      {/* Tabs Skeleton */}
      <div className="flex gap-6 border-b border-border pb-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-6 w-20" />
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <CardSkeleton />
          <div className="space-y-4">
            <RoundCardSkeleton />
            <RoundCardSkeleton />
            <RoundCardSkeleton />
          </div>
        </div>
        <div className="space-y-6">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}

// Round Details Skeleton
export function RoundDetailsSkeleton() {
  return (
    <div className="max-w-2xl mx-auto space-y-6 px-4" aria-busy="true">
      {/* Header */}
      <div>
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="bg-primary/15 border border-primary/30 rounded p-6">
          <Skeleton className="h-6 w-24 mb-2 bg-white/20" />
          <Skeleton className="h-8 w-48 mb-1 bg-white/30" />
          <Skeleton className="h-4 w-32 bg-white/20" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 justify-center border-b border-border pb-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-24" />
      </div>

      {/* Content */}
      <div className="space-y-6">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

// Leaderboard Skeleton
export function LeaderboardSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <Skeleton className="w-12 h-12 rounded-full shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="text-right space-y-2 shrink-0">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-3 w-12" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Participants List Skeleton
export function ParticipantsListSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}

// Profile Skeleton
export function ProfileSkeleton({isOnboarding = false}) {
  if (isOnboarding) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="axiom-page-header mb-6 text-center">
          <Skeleton className="w-12 h-12 mx-auto mb-3 rounded-lg" />
          <Skeleton className="h-3.5 w-24 mx-auto mb-2" />
          <Skeleton className="h-7 w-56 mx-auto mb-1" />
          <Skeleton className="h-3.5 w-72 mx-auto" />
        </div>
        <LoadingIndicator label="Loading your profile registration" />
        <div
          className="bg-card border border-border rounded-xl shadow-sm overflow-hidden"
          aria-busy="true"
        >
          <div className="p-5 border-b border-border bg-muted/20 flex items-center gap-3.5">
            <Skeleton className="w-14 h-14 rounded-full shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="p-5 md:p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
            <div className="pt-3">
              <Skeleton className="h-10 w-52 rounded-lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="axiom-page-header">
        <Skeleton className="h-3.5 w-16" />
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-72" />
      </div>
      <LoadingIndicator label="Loading your debater profile" />
      <div
        className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] items-start"
        aria-busy="true"
      >
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-border bg-muted/20 flex items-center gap-3.5">
            <Skeleton className="w-14 h-14 rounded-full shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
          <div className="p-5 md:p-6 space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-9 w-48 rounded-lg" />
            </div>
            <div className="pt-3">
              <Skeleton className="h-10 w-36 rounded-lg" />
            </div>
          </div>
        </div>
        <div className="hidden lg:grid gap-5 min-w-0">
          <div className="bg-card border border-border rounded-xl overflow-hidden text-center shadow-sm">
            <div className="bg-primary/20 p-8 flex justify-center">
              <Skeleton className="w-24 h-24 rounded-full" />
            </div>
            <div className="p-5 space-y-2">
              <Skeleton className="h-3 w-20 mx-auto" />
              <Skeleton className="h-4 w-4/5 mx-auto" />
              <Skeleton className="h-3 w-2/3 mx-auto" />
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5 space-y-4 shadow-sm">
            <div className="flex justify-between items-baseline">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-2.5 w-full rounded-full" />
            <div className="space-y-2.5">
              {[1, 2, 3, 4].map((k) => (
                <div key={k} className="flex items-center gap-2.5">
                  <Skeleton className="w-4 h-4 rounded shrink-0" />
                  <Skeleton className="h-3.5 w-36" />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Results Skeleton
export function ResultsSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4">
      <div className="axiom-page-header pb-4 border-b border-border">
        <Skeleton className="h-3.5 w-24 mb-3" />
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
      <LoadingIndicator label="Loading tournament results" />
      <div className="space-y-6" aria-busy="true">
        {/* Performance Overview */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
          <Skeleton className="h-3 w-28" />
          <div className="grid grid-cols-3 gap-3 divide-x divide-border text-center">
            <div className="px-2 space-y-1.5">
              <Skeleton className="h-7 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
            <div className="px-2 space-y-1.5">
              <Skeleton className="h-7 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
            <div className="px-2 space-y-1.5">
              <Skeleton className="h-7 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          </div>
        </div>
        {/* Tab */}
        <div className="flex items-center gap-4 border-b border-border pb-2.5">
          <Skeleton className="h-4 w-24" />
        </div>
        {/* Debate cards */}
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-xl p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-5 w-20 rounded" />
              </div>
              <div className="flex items-center gap-3.5 pt-1">
                <Skeleton className="w-9 h-9 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
