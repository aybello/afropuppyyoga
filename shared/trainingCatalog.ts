export type TrainingRole = "Operations Manager" | "Yoga Instructor" | "Puppy Monitor";

export type TrainingModule = {
  key: string;
  role: TrainingRole | "All Staff";
  title: string;
  duration: string;
  summary: string;
  lessons: string[];
};

export const TRAINING_MODULES: TrainingModule[] = [
  { key: "apy-standards", role: "All Staff", title: "The APY Experience", duration: "10 min", summary: "How we create a warm, premium and consistent guest experience.", lessons: ["Welcome every guest within 30 seconds and confirm their ticket.", "Keep the room calm, clean and photo-ready from doors-open to close.", "Never promise refunds, credits or exceptions; escalate them to Operations.", "Use the team group chat for live updates and record incidents before leaving."] },
  { key: "safety-welfare", role: "All Staff", title: "Safety & Puppy Welfare", duration: "15 min", summary: "The non-negotiable rules that protect puppies, guests and the APY brand.", lessons: ["Puppy welfare overrides the class schedule and guest requests.", "Remove any tired, stressed, unwell or overstimulated puppy immediately.", "Keep water, rest space and sanitation supplies available throughout the event.", "Escalate bites, falls, illness or guest conflict to Operations immediately."] },
  { key: "ops-event-day", role: "Operations Manager", title: "Operations: Event-Day Playbook", duration: "20 min", summary: "Own the venue, team, breeder and guest flow from arrival through close.", lessons: ["Arrive 60 minutes before the first class and complete the opening checklist.", "Confirm breeder arrival, puppy count, waivers, staff coverage and room setup.", "Run check-in, time transitions and keep all classes on schedule.", "Complete the close-out report, incident notes and supply count before departure."] },
  { key: "ops-escalations", role: "Operations Manager", title: "Operations: Escalations", duration: "15 min", summary: "Make calm, consistent decisions when the event changes unexpectedly.", lessons: ["Call the owner for breeder no-shows, unsafe puppy conditions or venue issues.", "Document facts, names, times and actions without speculation.", "Move guests safely first; discuss credits or rescheduling only after approval.", "Ensure every staff member knows the revised plan before communicating it."] },
  { key: "yoga-class-flow", role: "Yoga Instructor", title: "Yoga: Class Flow", duration: "20 min", summary: "Deliver an accessible APY class while leaving room for puppy interaction.", lessons: ["Review the room and puppy energy with Operations before guests enter.", "Give clear beginner-friendly options and never physically adjust without consent.", "Build frequent pauses for puppy interaction, photos and hydration.", "Finish on time so Puppy Monitors can reset the room safely."] },
  { key: "yoga-safety", role: "Yoga Instructor", title: "Yoga: Safe Instruction", duration: "15 min", summary: "Adapt the class to guests, puppies and the room in real time.", lessons: ["Keep movement slow and sightlines open whenever puppies are roaming.", "Stop a pose if a puppy enters an unsafe area or a guest appears uncomfortable.", "Direct animal-welfare concerns to Puppy Monitors and operational issues to Operations.", "Never diagnose injuries; pause participation and escalate."] },
  { key: "pm-puppy-care", role: "Puppy Monitor", title: "Puppy Monitor: Care & Rotation", duration: "20 min", summary: "Monitor puppy behaviour, rest and safe guest interaction throughout the day.", lessons: ["Count puppies at every transition and maintain a clear rest area.", "Watch for hiding, panting, repeated escape attempts, fatigue or rough handling.", "Rotate puppies out before they become overstimulated; do not wait for distress.", "Coordinate continuously with the breeder and the second Puppy Monitor."] },
  { key: "pm-room-reset", role: "Puppy Monitor", title: "Puppy Monitor: Room Safety", duration: "15 min", summary: "Keep the studio sanitary, controlled and ready between classes.", lessons: ["Clean accidents immediately using the approved supplies and handoff protocol.", "Check gates, doors, cables, water and the rest area before each guest group enters.", "Guide guests on safe holding and intervene politely when needed.", "Report supply shortages and incidents to Operations before leaving."] },
];

export function modulesForRole(role: string) {
  const normalized = role.toLowerCase().replaceAll("_", " ");
  return TRAINING_MODULES.filter((module) => module.role === "All Staff" || module.role.toLowerCase() === normalized);
}
