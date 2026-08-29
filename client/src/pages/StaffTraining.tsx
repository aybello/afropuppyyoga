import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock,
  GraduationCap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const ROLE_SECTIONS = ["All Staff", "Operations Manager", "Yoga Instructor", "Puppy Monitor"] as const;

const ROLE_INTROS: Record<(typeof ROLE_SECTIONS)[number], { title: string; description: string; icon: typeof ShieldCheck }> = {
  "All Staff": {
    title: "The APY standard",
    description: "The experience, guest care, and puppy-welfare standards expected on every shift.",
    icon: ShieldCheck,
  },
  "Operations Manager": {
    title: "Lead the event day",
    description: "Venue readiness, team coordination, guest flow, and escalation decisions.",
    icon: ClipboardCheck,
  },
  "Yoga Instructor": {
    title: "Lead the room",
    description: "A consistent 40-minute class flow, puppy-safe teaching, and a confident guest briefing.",
    icon: Sparkles,
  },
  "Puppy Monitor": {
    title: "Protect the puppy experience",
    description: "Shadowing expectations, puppy rotation, safe handling, room reset, and guest support.",
    icon: CircleDot,
  },
};

export default function StaffTraining() {
  const training = trpc.training.myTraining.useQuery();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const completed = new Set(training.data?.completedKeys ?? []);
  const modules = training.data?.modules ?? [];
  const total = modules.length;
  const done = modules.filter(module => completed.has(module.key)).length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const nextModule = modules.find(module => !completed.has(module.key));
  const isAdminPreview = Boolean(training.data?.adminPreview);
  const canManageTraining = Boolean(training.data?.canManageTraining);
  const staff = training.data?.staff;
  const overview = trpc.training.overview.useQuery(undefined, { enabled: canManageTraining });
  const teamCompletion = overview.data?.reduce((sum, person) => sum + person.completed, 0) ?? 0;
  const teamAssigned = overview.data?.reduce((sum, person) => sum + person.total, 0) ?? 0;

  const complete = trpc.training.complete.useMutation({
    onSuccess: (_, variables) => {
      training.refetch();
      setOpenKey(variables.moduleKey);
      toast.success("Training marked complete and saved to your APY HQ profile.");
    },
    onError: (error) => toast.error(error.message),
  });

  const selectNextModule = () => {
    if (nextModule) setOpenKey(nextModule.key);
  };

  return (
    <div className="min-h-screen bg-[#FEFAF4] text-[#1E1208]">
      <header className="border-b border-[#E3EADB] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <Link href="/staff" className="flex items-center gap-1.5 text-xs font-bold text-[#2D5A27] transition-colors hover:text-[#173B1A]">
            <ArrowLeft size={14} /> APY HQ
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#2D5A27]"><span className="h-1.5 w-1.5 rotate-45 bg-[#F4A800]" /> Training Centre</div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-7 pb-12 md:py-10">
        <section className="relative overflow-hidden rounded-[2rem] bg-[#2D5A27] px-6 py-7 text-white shadow-[0_18px_45px_rgba(45,90,39,0.2)] md:px-9 md:py-9">
          <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-[#F4A800]/15" />
          <div className="absolute -bottom-28 right-32 h-48 w-48 rounded-full border-[18px] border-white/10" />
          <div className="relative grid gap-7 md:grid-cols-[1fr_auto] md:items-end">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-[#F9D781]">
                <GraduationCap size={17} /> {canManageTraining ? "Training management" : "Your APY learning path"}
              </div>
              <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight md:text-4xl">Train with clarity. Show up with confidence.</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/82">
                {staff
                  ? `${staff.name}, complete the short lessons assigned to your ${staff.role} role before your next independent shift.`
                  : canManageTraining
                    ? "See training completion across the active APY team and review the exact role standards staff are working through."
                    : "Review the practical standards that keep every APY class safe, warm, and well run."}
              </p>
            </div>

            <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-sm md:min-w-52">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#F9D781]">{canManageTraining ? "Team completion" : "Your progress"}</p>
              <div className="mt-1 flex items-end gap-2">
                <span className="text-3xl font-bold">{canManageTraining ? teamCompletion : done}</span>
                <span className="mb-1 text-sm text-white/75">of {canManageTraining ? teamAssigned : total} complete</span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/15">
                <div className="h-full rounded-full bg-[#F4A800] transition-[width] duration-300" style={{ width: `${canManageTraining && teamAssigned ? Math.round((teamCompletion / teamAssigned) * 100) : percent}%` }} />
              </div>
              <p className="mt-2 text-xs font-semibold text-white/90">{canManageTraining ? `${overview.data?.length ?? 0} active team members` : `${percent}% ready for your shift`}</p>
            </div>
          </div>
        </section>

        {training.isLoading && (
          <div className="py-20 text-center text-sm text-[#7A5A6A]">Loading your APY learning path…</div>
        )}

        {training.data && !staff && !isAdminPreview && (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            <strong className="block">Your account still needs to be linked.</strong>
            Ask an APY HQ admin to add the email you use to sign in to your active team profile. Your completion record will then be saved under your profile.
          </div>
        )}

        {training.data && (
          <>
            {canManageTraining && (
              <section className="mt-6 rounded-2xl border border-[#DFE8DA] bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#C05A35]">Manager view</p>
                    <h2 className="mt-1 font-serif text-2xl font-bold text-[#1E1208]">Team training at a glance</h2>
                    <p className="mt-1 text-sm text-[#665A36]">Use this to see who needs a reminder before taking an independent shift. Staff complete their own lessons; managers only oversee readiness.</p>
                  </div>
                  <span className="rounded-full bg-[#EDF3E7] px-3 py-1.5 text-xs font-bold text-[#2D5A27]">No manager completion actions</span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {overview.data?.map((person) => (
                    <div key={person.id} className="rounded-xl border border-[#E7EEE2] bg-[#FFFEFB] px-3 py-3">
                      <div className="flex items-start justify-between gap-2"><p className="font-bold text-[#2D3527]">{person.name}</p><span className="shrink-0 text-xs font-bold text-[#2D5A27]">{person.completed}/{person.total}</span></div>
                      <p className="mt-0.5 text-xs text-[#7A7462]">{person.role} · {person.location}</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#E7EEE2]"><div className="h-full rounded-full bg-[#2D5A27]" style={{ width: `${person.total ? Math.round((person.completed / person.total) * 100) : 0}%` }} /></div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section className="mt-6 rounded-2xl border border-[#DFE8DA] bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#C05A35]">How to complete your training</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#4B4434]">
                    <span className="flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2D5A27] text-xs font-bold text-white">1</span> Open a lesson</span>
                    <ChevronRight size={15} className="hidden text-[#BFCDB8] sm:block" />
                    <span className="flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#FFF0C9] text-xs font-bold text-[#855D00]">2</span> Review the shift standard</span>
                    <ChevronRight size={15} className="hidden text-[#BFCDB8] sm:block" />
                    <span className="flex items-center gap-1.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">3</span> Confirm completion</span>
                  </div>
                </div>
                {!isAdminPreview && staff && nextModule && (
                  <button onClick={selectNextModule} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#2D5A27] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#173B1A] active:scale-[0.97]">
                    Continue training <ChevronRight size={16} />
                  </button>
                )}
                {!isAdminPreview && staff && !nextModule && (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-800">
                    <CheckCircle2 size={18} /> Training complete
                  </div>
                )}
              </div>
            </section>

            <section className="mt-8">
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#C05A35]">{canManageTraining ? "Training library" : "Your assigned modules"}</p>
                  <h2 className="mt-1 font-serif text-2xl font-bold text-[#1E1208]">One practical lesson at a time.</h2>
                </div>
                <span className="hidden text-xs text-[#7A5A6A] sm:block">Tap a module to read it</span>
              </div>

              <div className="space-y-8">
                {ROLE_SECTIONS.map(role => {
                  const roleModules = modules.filter(module => module.role === role);
                  if (roleModules.length === 0) return null;
                  const intro = ROLE_INTROS[role];
                  const SectionIcon = intro.icon;
                  const roleDone = roleModules.filter(module => completed.has(module.key)).length;
                  return (
                    <section key={role} aria-labelledby={`training-${role.replace(/\s+/g, "-").toLowerCase()}`}>
                      <div className="mb-3 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#EDF3E7] text-[#2D5A27]"><SectionIcon size={18} /></div>
                          <div>
                            <h3 id={`training-${role.replace(/\s+/g, "-").toLowerCase()}`} className="font-bold text-[#2D3527]">{intro.title}</h3>
                            <p className="text-xs text-[#6B695A]">{intro.description}</p>
                          </div>
                        </div>
                        {!isAdminPreview && <span className="shrink-0 text-xs font-bold text-[#2D5A27]">{roleDone}/{roleModules.length}</span>}
                      </div>

                      <div className="space-y-3">
                        {roleModules.map((module, index) => {
                          const isDone = completed.has(module.key);
                          const isOpen = openKey === module.key;
                          return (
                            <article key={module.key} className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${isOpen ? "border-[#D4603A] shadow-[0_8px_24px_rgba(45,90,39,0.1)]" : "border-[#DFE8DA] hover:shadow-md"}`}>
                              <button
                                onClick={() => setOpenKey(isOpen ? null : module.key)}
                                aria-expanded={isOpen}
                                className="flex w-full items-center gap-4 p-4 text-left sm:p-5"
                              >
                                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${isDone ? "bg-emerald-100 text-emerald-700" : "bg-[#FFF1C9] text-[#855D00]"}`}>
                                  {isDone ? <Check size={21} strokeWidth={3} /> : index + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h4 className="font-bold text-[#1A0A12]">{module.title}</h4>
                                    {isDone && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Complete</span>}
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-[#6B695A]">{module.summary}</p>
                                  <p className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#8B8978]"><Clock size={11} /> {module.duration}</p>
                                </div>
                                <ChevronDown size={18} className={`shrink-0 text-[#2D5A27] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                              </button>

                              {isOpen && (
                                <div className="border-t border-[#E7EEE2] bg-[#FFFEFB] p-4 sm:p-5">
                                  <div className="mb-4 rounded-xl border border-[#F3DE9C] bg-[#FFF9E9] px-4 py-3 text-xs leading-5 text-[#665A36]">
                                    <strong className="text-[#2D5A27]">On shift, this means:</strong> Review each point below, then confirm when you understand how it applies to your role.
                                  </div>
                                  <ol className="space-y-3">
                                    {module.lessons.map((lesson, lessonIndex) => (
                                      <li key={lesson} className="flex gap-3 text-sm leading-6 text-[#3D2731]">
                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#2D5A27] text-[10px] font-bold text-white">{lessonIndex + 1}</span>
                                        <span>{lesson}</span>
                                      </li>
                                    ))}
                                  </ol>
                                  {staff && (
                                    <button
                                      onClick={() => complete.mutate({ moduleKey: module.key })}
                                      disabled={isDone || complete.isPending}
                                      className={`mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition-colors active:scale-[0.97] ${isDone ? "bg-emerald-600 text-white" : "bg-[#2D5A27] text-white hover:bg-[#173B1A]"} disabled:cursor-not-allowed`}
                                    >
                                      {isDone ? <><CheckCircle2 size={18} /> Completed</> : complete.isPending ? "Saving completion…" : <><ClipboardCheck size={18} /> I’ve reviewed this — mark complete</>}
                                    </button>
                                  )}
                                </div>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
