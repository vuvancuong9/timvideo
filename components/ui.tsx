import clsx from "clsx";
import {
  VIDEO_SOURCE_LABELS,
  VIDEO_STATUS_LABELS,
  type VideoSource,
  type VideoStatus,
} from "@/lib/constants";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-gray-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-gray-200 bg-white p-4 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </Card>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
      {message}
    </div>
  );
}

export function Badge({
  children,
  color = "gray",
}: {
  children: React.ReactNode;
  color?: "gray" | "blue" | "green" | "yellow" | "red" | "purple";
}) {
  const colors: Record<string, string> = {
    gray: "bg-gray-100 text-gray-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    yellow: "bg-yellow-100 text-yellow-800",
    red: "bg-red-100 text-red-700",
    purple: "bg-purple-100 text-purple-700",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        colors[color],
      )}
    >
      {children}
    </span>
  );
}

const STATUS_COLOR: Record<
  VideoStatus,
  "gray" | "blue" | "green" | "yellow" | "red" | "purple"
> = {
  draft: "gray",
  submitted: "blue",
  assigned: "purple",
  short_linked: "green",
  rejected: "red",
  archived: "gray",
};

export function StatusBadge({ status }: { status: VideoStatus }) {
  return <Badge color={STATUS_COLOR[status]}>{VIDEO_STATUS_LABELS[status]}</Badge>;
}

const SOURCE_COLOR: Record<VideoSource, "blue" | "gray" | "red" | "purple"> = {
  facebook: "blue",
  tiktok: "gray",
  youtube: "red",
  other: "purple",
};

export function SourceBadge({ source }: { source: VideoSource }) {
  return <Badge color={SOURCE_COLOR[source]}>{VIDEO_SOURCE_LABELS[source]}</Badge>;
}
