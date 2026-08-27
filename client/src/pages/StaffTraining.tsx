import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, BookOpen, CheckCircle2, ChevronDown, Clock, GraduationCap } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function StaffTraining() {
  const training = trpc.training.myTraining.useQuery();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const complete = trpc.training.complete.useMutation({
    onSuccess: () => { training.refetch(); toast.success("Module completed"); },
    onError: (error) => toast.error(error.message),
  });
  const completed = new Set(training.data?.completedKeys ?? []);
  const total = training.data?.modules.length ?? 0;
  const done = training.data?.modules.filter((module) => completed.has(module.key)).length ?? 0;
  const percent = total ? Math.round((done / total) * 100) : 0;

  return <div className="min-h-screen bg-[#F7F2EE]">
    <header className="border-b border-[#EDE0D8] bg-white"><div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-4"><Link href="/staff" className="flex items-center gap-1.5 text-xs font-bold text-[#8B2252]"><ArrowLeft size={14}/> APY HQ</Link><span className="text-xs font-bold uppercase tracking-widest text-[#8B2252]">Training Centre</span></div></header>
    <main className="mx-auto max-w-4xl px-5 py-8">
      <section className="overflow-hidden rounded-3xl bg-[#8B2252] p-7 text-white shadow-lg md:p-9">
        <GraduationCap size={34}/><h1 className="mt-4 text-3xl font-bold">APY Team Training</h1>
        <p className="mt-2 max-w-xl text-sm text-white/80">{training.data?.staff ? `${training.data.staff.name} · ${training.data.staff.role}` : "Role-based event operations, safety and animal-welfare training."}</p>
        <div className="mt-6 h-2 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${percent}%` }}/></div>
        <p className="mt-2 text-xs font-bold">{done} of {total} complete · {percent}%</p>
      </section>

      {training.isLoading && <p className="py-16 text-center text-sm text-[#7A5A6A]">Loading your training…</p>}
      {training.data && !training.data.staff && !training.data.adminPreview && <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Your login is not linked to an active APY team profile. Ask an admin to ensure your APY HQ email matches your team record.</div>}
      {training.data?.adminPreview && <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Admin preview: you can review every role's training. Completion buttons appear only for staff linked to a team profile.</div>}

      <div className="mt-6 space-y-3">
        {training.data?.modules.map((module) => {
          const isDone = completed.has(module.key); const isOpen = openKey === module.key;
          return <article key={module.key} className="overflow-hidden rounded-2xl border border-[#EADBE2] bg-white shadow-sm">
            <button onClick={() => setOpenKey(isOpen ? null : module.key)} className="flex w-full items-center gap-4 p-5 text-left">
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${isDone ? "bg-emerald-100 text-emerald-700" : "bg-[#F8EAF0] text-[#8B2252]"}`}>{isDone ? <CheckCircle2 size={22}/> : <BookOpen size={22}/>}</div>
              <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold text-[#1A0A12]">{module.title}</h2><span className="rounded-full bg-[#F7F2EE] px-2 py-0.5 text-[10px] font-bold text-[#8B2252]">{module.role}</span></div><p className="mt-1 text-xs text-[#7A5A6A]">{module.summary}</p><p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-[#9A7C89]"><Clock size={11}/>{module.duration}</p></div>
              <ChevronDown size={18} className={`text-[#8B2252] transition-transform ${isOpen ? "rotate-180" : ""}`}/>
            </button>
            {isOpen && <div className="border-t border-[#F1E7E2] bg-[#FFFCFA] p-5"><ol className="space-y-3">{module.lessons.map((lesson, index) => <li key={lesson} className="flex gap-3 text-sm text-[#3D2731]"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#8B2252] text-[10px] font-bold text-white">{index + 1}</span><span className="pt-0.5">{lesson}</span></li>)}</ol>{training.data.staff && <button onClick={() => complete.mutate({ moduleKey: module.key })} disabled={isDone || complete.isPending} className="mt-5 w-full rounded-xl bg-[#8B2252] py-3 text-sm font-bold text-white hover:bg-[#6B1A3E] disabled:bg-emerald-600">{isDone ? "Completed ✓" : complete.isPending ? "Saving…" : "I understand — mark complete"}</button>}</div>}
          </article>;
        })}
      </div>
    </main>
  </div>;
}
