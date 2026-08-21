"use client";

import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  onConfirm,
  loading = false,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-white p-5 dark:bg-zinc-950"
        showCloseButton={false}
      >
        <DialogHeader className="items-center text-center">
          <span className="app-danger-icon mx-auto grid size-12 place-items-center rounded-full bg-rose-500/10 text-rose-500 dark:bg-rose-500/15">
            <AlertTriangle className="size-6" />
          </span>
          <DialogTitle className="text-base font-semibold">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 dark:text-white/50">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="-mx-5 -mb-5 flex-row gap-2 rounded-b-2xl border-slate-900/10 bg-slate-50/80 px-5 py-3 dark:border-white/10 dark:bg-white/[0.04]">
          <Button
            type="button"
            variant="outline"
            className="h-11 flex-1 rounded-full px-4 sm:h-8"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="h-11 flex-1 rounded-full px-4 sm:h-8"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Excluindo…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
