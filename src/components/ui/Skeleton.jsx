import {motion as Motion} from "framer-motion";

// Base Skeleton Component
export function Skeleton({className = "", animate = true}) {
  return (
    <div
      className={`bg-muted rounded ${
        animate ? "animate-pulse" : ""
      } ${className}`}
      aria-hidden="true"
    />
  );
}

// Card Skeleton
export function CardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-xl p-6 space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex-1 space-y-2">
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
    <Motion.div initial={{opacity: 0, y: 20}}
    animate={{opacity: 1, y: 0}}
    className="bg-card border border-border rounded-2xl p-6 space-y-4"><div className="flex items-start justify-between">
      <div className="flex-1 space-y-3">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="h-10 w-24 rounded-xl" />
    </div>
    <div className="flex gap-2">
      <Skeleton className="h-6 w-20" />
      <Skeleton className="h-6 w-24" />
    </div></Motion.div>
  );
}

// Round Card Skeleton
export function RoundCardSkeleton() {
  return (
    <Motion.div initial={{opacity: 0, y: 20}}
    animate={{opacity: 1, y: 0}}
    className="bg-card border border-border rounded-xl p-6"><div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3 flex-1">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="h-6 w-20 rounded" />
    </div>
    <Skeleton className="h-16 w-full rounded-lg" /></Motion.div>
  );
}

// Profile Header Skeleton
export function ProfileHeaderSkeleton() {
  return (
    <div className="bg-primary/10 border border-primary/30 rounded p-8">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="bg-white dark:bg-card rounded-2xl p-4">
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
    <Motion.div initial={{opacity: 0, x: -20}}
    animate={{opacity: 1, x: 0}}
    className="bg-card border border-border rounded-xl p-4"><div className="flex items-center gap-4">
      <Skeleton className="w-12 h-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-20 rounded-full" />
    </div></Motion.div>
  );
}

// Table Row Skeleton
export function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border">
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
    <div className="space-y-6 max-w-md mx-auto md:max-w-4xl md:mx-0">
      <ProfileHeaderSkeleton />
      <EventCardSkeleton />

      {/* Check-in Status Skeleton */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <CardSkeleton />
      </div>

      {/* Next Debate Skeleton */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-16" />
        </div>
        <CardSkeleton />
      </div>
    </div>
  );
}

// Event Details Skeleton
export function EventDetailsSkeleton() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
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
    <div className="max-w-2xl mx-auto space-y-6 px-4">
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
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <Motion.div key={i}
        initial={{opacity: 0, y: 20}}
        animate={{opacity: 1, y: 0}}
        transition={{delay: i * 0.1}}
        className="bg-card border border-border rounded-xl p-4"><div className="flex items-center gap-4">
          <Skeleton className="w-10 h-10 rounded-full" />
          <Skeleton className="w-12 h-12 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="text-right space-y-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-3 w-12" />
          </div>
        </div></Motion.div>
      ))}
    </div>
  );
}

// Participants List Skeleton
export function ParticipantsListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <ListItemSkeleton key={i} />
      ))}
    </div>
  );
}
