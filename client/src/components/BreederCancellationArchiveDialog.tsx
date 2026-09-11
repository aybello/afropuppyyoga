import { Loader2, Mail, MessageSquare, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type BreederCancellationArchiveDialogProps = {
  scheduleId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onArchived?: () => void;
};

/**
 * A single, deliberate deletion path for breeder-backed schedule entries.
 * It never displays the breeder's phone or email address in the UI.
 */
export function BreederCancellationArchiveDialog({
  scheduleId,
  open,
  onOpenChange,
  onArchived,
}: BreederCancellationArchiveDialogProps) {
  const utils = trpc.useUtils();
  const previewQuery = trpc.puppySchedule.getBreederCancellationPreview.useQuery(
    { id: scheduleId ?? 0 },
    { enabled: open && scheduleId !== null, retry: false },
  );
  const archiveMutation = trpc.puppySchedule.archiveWithBreederCancellationNotice.useMutation({
    onSuccess: (result) => {
      utils.puppySchedule.list.invalidate();
      utils.puppySchedule.listByMonth.invalidate();
      utils.puppySchedule.listWithStaffing.invalidate();
      const details = [
        result.emailStatus === "sent" ? "email sent" : null,
        result.smsStatus === "sent" ? "text sent" : null,
      ].filter(Boolean).join(" and ");
      if (result.notificationSent) {
        toast.success(`Class archived; breeder ${details}.`);
      } else {
        toast.warning("Class archived, but no breeder delivery channel succeeded. Review Communications for details.");
      }
      onArchived?.();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const preview = previewQuery.data;
  const close = () => {
    if (!archiveMutation.isPending) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-[#FEFAF4] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-[#1A0A12]">Review breeder cancellation notice</DialogTitle>
          <DialogDescription className="font-body text-[#6B4C3B]">
            Confirming will archive this class and automatically send the previewed notice to its linked breeder. Customer cancellation messages are not part of this action.
          </DialogDescription>
        </DialogHeader>

        {previewQuery.isLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-[#F0D0DC] bg-white px-4 py-8 font-body text-sm text-[#6B4C3B]">
            <Loader2 size={17} className="animate-spin text-[#8B2252]" /> Loading the cancellation preview…
          </div>
        )}

        {previewQuery.error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 font-body text-sm text-amber-950">
            <div className="mb-2 flex items-center gap-2 font-semibold"><ShieldAlert size={17} /> This class cannot be archived yet</div>
            <p>{previewQuery.error.message}</p>
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#F0D0DC] bg-white p-4 font-body text-sm text-[#3D1A2A]">
              <p className="font-semibold text-[#1A0A12]">{preview.class.breed} · {preview.class.location}</p>
              <p className="mt-1 text-[#6B4C3B]">{preview.class.dayOfWeek}, {preview.class.classDate} · {preview.class.startTime}–{preview.class.endTime}</p>
              <p className="mt-3">Recipient: <strong>{preview.recipient.name}</strong></p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1 border-[#F0D0DC] bg-[#FFF7FA] text-[#8B2252]"><Mail size={13} /> Email: {preview.channels.email}</Badge>
                <Badge variant="outline" className="gap-1 border-[#F0D0DC] bg-[#FFF7FA] text-[#8B2252]"><MessageSquare size={13} /> Text: {preview.channels.sms}</Badge>
              </div>
            </div>

            <div>
              <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.12em] text-[#8B2252]">Email preview</p>
              <iframe
                title="Breeder cancellation email preview"
                sandbox=""
                srcDoc={preview.html}
                className="h-[320px] w-full rounded-xl border border-[#F0D0DC] bg-white"
              />
            </div>

            <div className="rounded-xl border border-[#F0D0DC] bg-[#FFF7FA] p-4">
              <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.12em] text-[#8B2252]">Text preview</p>
              <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-[#3D1A2A]">{preview.smsText}</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={close} disabled={archiveMutation.isPending} className="font-body border-[#F0D0DC]">Keep class</Button>
          <Button
            disabled={!preview || !preview.canNotify || archiveMutation.isPending}
            onClick={() => scheduleId !== null && preview && archiveMutation.mutate({ id: scheduleId, confirmationKey: preview.confirmationKey })}
            className="bg-red-600 font-body text-white hover:bg-red-700"
          >
            {archiveMutation.isPending && <Loader2 size={15} className="mr-2 animate-spin" />}
            Archive class & notify breeder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
