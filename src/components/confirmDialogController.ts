export type ConfirmTone = "default" | "danger" | "warning";

export interface ConfirmDialogRequest<TDescription = unknown> {
  title: string;
  description?: TDescription;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

export interface PendingConfirmRequest<TDescription = unknown>
  extends Required<Omit<ConfirmDialogRequest<TDescription>, "description">> {
  description?: TDescription;
}

export interface PendingConfirm<TDescription = unknown>
  extends PendingConfirmRequest<TDescription> {
  resolve: (confirmed: boolean) => void;
}

export type PendingChangeListener<TDescription = unknown> = (
  pending: PendingConfirmRequest<TDescription> | null,
) => void;

export function normalizeConfirmRequest<TDescription>(
  request: ConfirmDialogRequest<TDescription>,
  resolve: (confirmed: boolean) => void,
): PendingConfirm<TDescription> {
  return {
    title: request.title,
    description: request.description,
    confirmLabel: request.confirmLabel ?? "确认",
    cancelLabel: request.cancelLabel ?? "取消",
    tone: request.tone ?? "default",
    resolve,
  };
}

export function createConfirmController<TDescription = unknown>(
  onPendingChange: PendingChangeListener<TDescription>,
) {
  let pending: PendingConfirm<TDescription> | null = null;

  const confirm = (request: ConfirmDialogRequest<TDescription>) =>
    new Promise<boolean>((resolve) => {
      pending?.resolve(false);
      pending = normalizeConfirmRequest(request, resolve);
      onPendingChange(toPendingRequest(pending));
    });

  const close = (confirmed: boolean) => {
    const current = pending;
    if (!current) return;
    pending = null;
    onPendingChange(null);
    current.resolve(confirmed);
  };

  const dispose = () => {
    const current = pending;
    if (!current) return;
    pending = null;
    onPendingChange(null);
    current.resolve(false);
  };

  const getPending = () => pending;

  return { confirm, close, dispose, getPending };
}

function toPendingRequest<TDescription>(
  pending: PendingConfirm<TDescription>,
): PendingConfirmRequest<TDescription> {
  return {
    title: pending.title,
    description: pending.description,
    confirmLabel: pending.confirmLabel,
    cancelLabel: pending.cancelLabel,
    tone: pending.tone,
  };
}
