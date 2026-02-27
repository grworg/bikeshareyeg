"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";

// ---------------------------------------------------------------------------
// Modal state type — used by page.tsx to manage a single global modal
// ---------------------------------------------------------------------------

export type ModalState =
  | null
  | { type: "alert"; title: string; message: string }
  | { type: "confirm"; title: string; message: string; onConfirm: () => void }
  | {
      type: "prompt";
      title: string;
      message?: string;
      defaultValue: string;
      placeholder?: string;
      onSubmit: (value: string) => void;
    }
  | {
      type: "share";
      title: string;
      url: string;
      message?: string;
    };

// ---------------------------------------------------------------------------
// Shell — shared backdrop + animation wrapper
// ---------------------------------------------------------------------------

function Shell({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 animate-[fadeIn_150ms_ease]"
        onClick={onClose}
      />
      {/* panel */}
      <div className="relative bg-[var(--color-surface)] rounded-xl shadow-xl max-w-sm w-full animate-[modalIn_150ms_ease]">
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Concrete modal variants
// ---------------------------------------------------------------------------

function AlertModal({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  return (
    <Shell onClose={onClose}>
      <div className="px-6 pt-6 pb-2">
        <h3 className="text-[15px] font-semibold text-[var(--color-fg)]">{title}</h3>
        <p className="mt-2 text-[13px] text-[var(--color-secondary)] leading-relaxed">{message}</p>
      </div>
      <div className="px-6 pb-5 pt-3 flex justify-end">
        <button
          onClick={onClose}
          autoFocus
          className="h-9 px-5 rounded-full bg-[var(--color-blue)] text-white text-[13px] font-medium hover:bg-[var(--color-blue-hover)] transition-colors"
        >
          OK
        </button>
      </div>
    </Shell>
  );
}

function ConfirmModal({
  title,
  message,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Shell onClose={onClose}>
      <div className="px-6 pt-6 pb-2">
        <h3 className="text-[15px] font-semibold text-[var(--color-fg)]">{title}</h3>
        <p className="mt-2 text-[13px] text-[var(--color-secondary)] leading-relaxed">{message}</p>
      </div>
      <div className="px-6 pb-5 pt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-9 px-5 rounded-full text-[var(--color-secondary)] text-[13px] font-medium hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          autoFocus
          className="h-9 px-5 rounded-full bg-[var(--color-red)] text-white text-[13px] font-medium hover:opacity-90 transition-opacity"
        >
          Confirm
        </button>
      </div>
    </Shell>
  );
}

function PromptModal({
  title,
  message,
  defaultValue,
  placeholder,
  onSubmit,
  onClose,
}: {
  title: string;
  message?: string;
  defaultValue: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Select all text on mount for easy overwriting
    requestAnimationFrame(() => inputRef.current?.select());
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed) {
      onSubmit(trimmed);
      onClose();
    }
  }, [value, onSubmit, onClose]);

  return (
    <Shell onClose={onClose}>
      <div className="px-6 pt-6 pb-2">
        <h3 className="text-[15px] font-semibold text-[var(--color-fg)]">{title}</h3>
        {message && (
          <p className="mt-1.5 text-[13px] text-[var(--color-secondary)] leading-relaxed">{message}</p>
        )}
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
          placeholder={placeholder}
            className="mt-3 w-full h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-blue)] focus:ring-1 focus:ring-[var(--color-blue)] transition-colors"
        />
      </div>
      <div className="px-6 pb-5 pt-3 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="h-9 px-5 rounded-full text-[var(--color-secondary)] text-[13px] font-medium hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="h-9 px-5 rounded-full bg-[var(--color-blue)] text-white text-[13px] font-medium hover:bg-[var(--color-blue-hover)] disabled:opacity-40 transition-colors"
        >
          Save
        </button>
      </div>
    </Shell>
  );
}

function ShareModal({
  title,
  url,
  message,
  onClose,
}: {
  title: string;
  url: string;
  message?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }).catch(() => {});
    requestAnimationFrame(() => inputRef.current?.select());
  }, [url]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      inputRef.current?.select();
    }
  }, [url]);

  return (
    <Shell onClose={onClose}>
      <div className="px-6 pt-6 pb-2">
        <h3 className="text-[15px] font-semibold text-[var(--color-fg)]">{title}</h3>
        {message && (
          <p className="mt-1.5 text-[13px] text-[var(--color-secondary)] leading-relaxed">{message}</p>
        )}
        <div className="mt-3 flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            readOnly
            value={url}
            onFocus={(e) => e.target.select()}
            className="flex-1 h-10 rounded-lg border border-[var(--color-border)] px-3 text-[13px] text-[var(--color-fg)] bg-[var(--color-surface-alt)] focus:outline-none focus:border-[var(--color-blue)] focus:ring-1 focus:ring-[var(--color-blue)] transition-colors"
          />
          <button
            onClick={handleCopy}
            className={`h-10 px-3 rounded-lg text-[13px] font-medium flex items-center gap-1.5 transition-colors ${
              copied
                ? "bg-[var(--color-green)]/10 text-[var(--color-green)]"
                : "bg-[var(--color-blue)] text-white hover:bg-[var(--color-blue-hover)]"
            }`}
          >
            {copied ? <><Check size={14} /> Copied!</> : <><Copy size={14} /> Copy</>}
          </button>
        </div>
        {copied && (
          <p className="mt-2 text-[12px] text-[var(--color-green)] font-medium">
            Link copied to clipboard
          </p>
        )}
      </div>
      <div className="px-6 pb-5 pt-3 flex justify-between items-center">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-[var(--color-blue)] hover:underline flex items-center gap-1"
        >
          <ExternalLink size={12} />
          Open in new tab
        </a>
        <button
          onClick={onClose}
          className="h-9 px-5 rounded-full text-[var(--color-secondary)] text-[13px] font-medium hover:bg-[var(--color-surface-hover)] transition-colors"
        >
          Done
        </button>
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Dispatcher — renders the right variant based on ModalState
// ---------------------------------------------------------------------------

export default function AppModal({
  modal,
  onClose,
}: {
  modal: ModalState;
  onClose: () => void;
}) {
  if (!modal) return null;

  switch (modal.type) {
    case "alert":
      return <AlertModal title={modal.title} message={modal.message} onClose={onClose} />;
    case "confirm":
      return <ConfirmModal title={modal.title} message={modal.message} onConfirm={modal.onConfirm} onClose={onClose} />;
    case "prompt":
      return (
        <PromptModal
          title={modal.title}
          message={modal.message}
          defaultValue={modal.defaultValue}
          placeholder={modal.placeholder}
          onSubmit={modal.onSubmit}
          onClose={onClose}
        />
      );
    case "share":
      return (
        <ShareModal
          title={modal.title}
          url={modal.url}
          message={modal.message}
          onClose={onClose}
        />
      );
  }
}
