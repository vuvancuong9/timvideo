"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import clsx from "clsx";

export type SearchableSelectOption = { value: string; label: string };

/** Bỏ dấu tiếng Việt (kể cả đ/Đ) để tìm kiếm không phân biệt dấu. */
function normalizeVi(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}

const baseInputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand";

/**
 * Ô chọn có thể gõ chữ để tìm (combobox). Thay cho <select> khi danh sách dài.
 * Lọc theo tên không phân biệt hoa/thường và không phân biệt dấu tiếng Việt.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "— Chọn —",
  emptyText = "Không tìm thấy kết quả",
  disabled = false,
  className,
  inputClassName,
}: {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
  inputClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    // Tách query thành các "từ" chỉ gồm chữ/số (bỏ khoảng trắng, &, ...).
    // Mỗi từ phải xuất hiện trong nhãn (đã nén bỏ dấu phân cách) thì mới khớp,
    // nên gõ "me be", "me&be" hay "mebe" đều ra "Mẹ & Bé"; không cần gõ từ đầu.
    const tokens = normalizeVi(query)
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    if (tokens.length === 0) return options;
    return options.filter((o) => {
      const hay = normalizeVi(o.label).replace(/[^a-z0-9]+/g, "");
      return tokens.every((t) => hay.includes(t));
    });
  }, [options, query]);

  // Đóng menu khi bấm ra ngoài.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Mỗi lần lọc lại thì đưa con trỏ về đầu danh sách.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // Cuộn lựa chọn đang sáng vào tầm nhìn.
  useEffect(() => {
    if (open) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function openMenu() {
    if (disabled) return;
    setOpen(true);
    setQuery("");
  }

  function selectOption(opt: SearchableSelectOption) {
    onChange(opt.value);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function clearSelection(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (open && filtered[activeIndex]) {
        e.preventDefault();
        selectOption(filtered[activeIndex]);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setQuery("");
      }
    }
  }

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        value={open ? query : selected?.label ?? ""}
        placeholder={selected && !open ? selected.label : placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={openMenu}
        onClick={openMenu}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          // Đóng khi rời khỏi cả cụm (Tab ra ngoài). Bấm vào option không tính
          // vì option đã chặn mất focus bằng preventDefault.
          if (!rootRef.current?.contains(e.relatedTarget as Node)) {
            setOpen(false);
            setQuery("");
          }
        }}
        className={clsx(
          baseInputClass,
          selected ? "pr-14" : "pr-9",
          disabled && "cursor-not-allowed bg-gray-50 text-gray-400",
          inputClassName,
        )}
      />

      {selected && !disabled && (
        <button
          type="button"
          tabIndex={-1}
          onClick={clearSelection}
          aria-label="Xoá lựa chọn"
          className="absolute right-7 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      )}

      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 text-sm shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-gray-400">{emptyText}</li>
          ) : (
            filtered.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIndex;
              return (
                <li
                  key={opt.value}
                  ref={(el) => {
                    optionRefs.current[i] = el;
                  }}
                  role="option"
                  aria-selected={isSelected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => selectOption(opt)}
                  className={clsx(
                    "cursor-pointer px-3 py-2",
                    isActive ? "bg-brand/10 text-brand" : "text-gray-700",
                    isSelected && "font-semibold",
                  )}
                >
                  {opt.label}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
