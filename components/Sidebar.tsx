"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import type { NavSection } from "@/lib/constants";

export function Sidebar({ nav }: { nav: NavSection[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto p-2 md:flex-col md:overflow-visible">
      {nav.map((section) => (
        <div key={section.title} className="md:mb-2">
          <p className="hidden px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-gray-400 md:block">
            {section.title}
          </p>
          <div className="flex gap-1 md:flex-col">
            {section.items.map((item) => {
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition",
                    active
                      ? "bg-brand text-white"
                      : "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
