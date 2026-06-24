import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Info, ShieldAlert } from "lucide-react";

import { Button } from "@/components/Button";
import { animateModalOpen } from "@/lib/animations";

import {
  createConfirmController,
  type ConfirmDialogRequest,
  type ConfirmTone,
  type PendingConfirmRequest,
} from "./confirmDialogController";

export type ConfirmDialogOptions = ConfirmDialogRequest<ReactNode>;
type PendingConfirmDialogRequest = PendingConfirmRequest<ReactNode>;

function getToneIcon(tone: ConfirmTone) {
  if (tone === "danger") return ShieldAlert;
  if (tone === "warning") return AlertTriangle;
  return Info;
}

function getToneColor(tone: ConfirmTone) {
  if (tone === "danger") return "var(--color-danger)";
  if (tone === "warning") return "var(--color-warning, #f59e0b)";
  return "var(--color-accent)";
}

export function useConfirmDialog() {
  const [pending, setPending] = useState<PendingConfirmDialogRequest | null>(null);
  const controllerRef = useRef<ReturnType<typeof createConfirmController<ReactNode>> | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = createConfirmController<ReactNode>(setPending);
  }

  const confirm = useCallback(
    (options: ConfirmDialogOptions) => controllerRef.current!.confirm(options),
    [],
  );

  const close = useCallback((confirmed: boolean) => {
    controllerRef.current?.close(confirmed);
  }, []);

  useEffect(
    () => () => {
      controllerRef.current?.dispose();
    },
    [],
  );

  return {
    confirm,
    dialog: pending ? <ConfirmDialog pending={pending} onClose={close} /> : null,
  };
}

function ConfirmDialog({
  pending,
  onClose,
}: {
  pending: PendingConfirmDialogRequest;
  onClose: (confirmed: boolean) => void;
}) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const Icon = getToneIcon(pending.tone);

  useEffect(() => {
    if (panelRef.current) animateModalOpen(panelRef.current);
    confirmButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        style={{ background: "rgba(15, 17, 23, 0.42)" }}
        aria-label="取消确认"
        onClick={() => onClose(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative flex w-full max-w-md flex-col gap-4 rounded-2xl border p-5 shadow-2xl"
        style={{
          background: "var(--color-surface)",
          borderColor: "var(--color-border)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl"
            style={{
              background: "var(--color-surface-2)",
              color: getToneColor(pending.tone),
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-dialog-title" className="text-base font-semibold" style={{ color: "var(--color-text)" }}>
              {pending.title}
            </h2>
            {pending.description ? (
              <div className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                {pending.description}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={() => onClose(false)}>
            {pending.cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={pending.tone === "danger" ? "danger" : "primary"}
            size="sm"
            onClick={() => onClose(true)}
          >
            {pending.confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
