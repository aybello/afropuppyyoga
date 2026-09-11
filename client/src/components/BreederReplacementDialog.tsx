import { ArrowRightLeft, Loader2, Mail, MessageSquare, ShieldAlert } from "lucide-react";
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

type Replacement = {
  breederId: number;
  breederName: string;
  breed: string;
};

type BreederReplacementDialogProps = {
  scheduleId: number | null;
  replacement: Replacement | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReplaced?: () => void;
};

/**
 * A deliberate outgoing-breeder notice for a class that continues with a new
 * breeder. This is not a class cancellation and never contacts customers.
 */
export function BreederReplacementDialog({
  scheduleId,
  replacement,
  open,
  onOpenChange,
  onReplaced,
}: BreederReplacementDialogProps) {
  const utils = trpc.useUtils();
  const previewQuery = trpc.puppySchedule.getBreederReplacementPreview.useQuery(
    {
      id: scheduleId ?? 0,
      newBreederId: replacement?.breederId ?? 0,
      newBreed: replacement?.breed ?? "Unavailable",
    },
    { enabled: open && scheduleId !== null && replacement !== null, retry: false },
  );
  const replaceMutation = trpc.puppySchedule.replaceBreederWithNotice.useMutation({
    onSuccess: (result) => {
      utils.puppySchedule.list.invalidate();
      utils.puppySchedule.listByMonth.invalidate();
      utils.puppySchedule.listWithStaffing.invalidate();
      const details = [
        result.emailStatus === "sent" ? "email sent" : null,
        result.smsStatus === "sent" ? "text sent" : null,
      ].filter(Boolean).join(" and ");
      if (result.notificationSent) {
        toast.success(`Breeder replaced; outgoing breeder ${details}.`);
      } else {
        toast.warning("Breeder replaced, but no outgoing breeder delivery channel succeeded. Review Communications for details.");
      }
      onReplaced?.();
      onOpenChange(false);
    },
    onError: (error) => toast.error(error.message),
  });

  const preview = previewQuery.data;
  const close = () => {
    if (!replaceMutation.isPending) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto bg-[#FEFAF4] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display text-[#1A0A12]">Review breeder replacement notice</DialogTitle>
          <DialogDescription className="font-body text-[#6B4C3B]">
            Confirming keeps this class and its Luma event active, changes the linked breeder, and sends this notice only to the outgoing breeder. No customer message is sent.
          </DialogDescription>
        </DialogHeader>

        {previewQuery.isLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-[#F0D0DC] bg-white px-4 py-8 font-body text-sm text-[#6B4C3B]">
            <Loader2 size={17} className="animate-spin text-[#8B2252]" /> Loading the breeder replacement preview…
          </div>
        )}

        {previewQuery.error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 font-body text-sm text-amber-950">
            <div className="mb-2 flex items-center gap-2 font-semibold"><ShieldAlert size={17} /> This breeder cannot be replaced yet</div>
            <p>{previewQuery.error.message}</p>
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#F0D0DC] bg-white p-4 font-body text-sm text-[#3D1A2A]">
              <p className="font-semibold text-[#1A0A12]">{preview.class.breed} · {preview.class.location}</p>
              <p className="mt-1 text-[#6B4C3B]">{preview.class.dayOfWeek}, {preview.class.classDate} · {preview.class.startTime}–{preview.class.endTime}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-[#3D1A2A]">
                <span>{preview.currentBreeder.name}</span><ArrowRightLeft size={13} className="text-[#8B2252]" /><span>{preview.replacementBreeder.name}</span>
              </div>
              <p className="mt-3">Outgoing recipient: <strong>{preview.recipient.name}</strong></p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="gap-1 border-[#F0D0DC] bg-[#FFF7FA] text-[#8B2252]"><Mail size={13} /> Email: {preview.channels.email}</Badge>
                <Badge variant="outline" className="gap-1 border-[#F0D0DC] bg-[#FFF7FA] text-[#8B2252]"><MessageSquare size={13} /> Text: {preview.channels.sms}</Badge>
                {preview.class.lumaLinked && <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">Luma event remains active</Badge>}
              </div>
            </div>

            <div>
              <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.12em] text-[#8B2252]">Outgoing breeder email preview</p>
              <iframe
                title="Outgoing breeder replacement email preview"
                sandbox=""
                srcDoc={preview.html}
                className="h-[320px] w-full rounded-xl border border-[#F0D0DC] bg-white"
              />
            </div>

            <div className="rounded-xl border border-[#F0D0DC] bg-[#FFF7FA] p-4">
              <p className="mb-2 font-body text-xs font-semibold uppercase tracking-[0.12em] text-[#8B2252]">Outgoing breeder text preview</p>
              <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-[#3D1A2A]">{preview.smsText}</p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={close} disabled={replaceMutation.isPending} className="font-body border-[#F0D0DC]">Keep existing breeder</Button>
          <Button
            disabled={!preview || !preview.canNotify || replaceMutation.isPending}
            onClick={() => scheduleId !== null && replacement && preview && replaceMutation.mutate({
              id: scheduleId,
              newBreederId: replacement.breederId,
              newBreed: replacement.breed,
              confirmationKey: preview.confirmationKey,
            })}
            className="bg-[#8B2252] font-body text-white hover:bg-[#6B1A3E]"
          >
            {replaceMutation.isPending && <Loader2 size={15} className="mr-2 animate-spin" />}
            Replace breeder & notify outgoing breeder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
