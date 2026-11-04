import { PRIVATE_EVENT_EXPERIENCES, PRIVATE_EVENT_SCHEDULES, PRIVATE_EVENT_VENUES, PRIVATE_EVENT_FORMAT_PRICE_NOTE, type PrivateEventPreferences } from "@shared/privateEventExperience";
import { publicPortraitUrl } from "@shared/publicPortraits";
import { recoverPublicPortrait } from "@/lib/publicPortraitRecovery";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type EventPreferencesDraft = {
  experience: PrivateEventPreferences["experience"];
  schedule: PrivateEventPreferences["schedule"];
  venue: PrivateEventPreferences["venue"];
  durationMinutes: string;
  sessionCount: string;
  guestsPerSession: string;
  concurrentGuests: string;
  scheduleNotes: string;
  venueDetails: string;
};
export const DEFAULT_EVENT_PREFERENCES: EventPreferencesDraft = {
  experience: "puppy_yoga", schedule: "single", venue: "studio", durationMinutes: "60",
  sessionCount: "", guestsPerSession: "", concurrentGuests: "", scheduleNotes: "", venueDetails: "",
};
const choiceClass = (active: boolean) => `min-h-12 rounded-xl border px-4 py-3 text-left text-sm font-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AA365D] focus-visible:ring-offset-2 motion-reduce:transition-none ${active ? "border-[#AA365D] bg-[#FDE9EF] text-[#34221D] font-semibold" : "border-[#AA365D]/50 bg-[#FEFAF4] text-[#34221D]/80 hover:bg-[#FDE9EF]/50"}`;
const fieldClass = "min-h-12 bg-[#FEFAF4] text-[#34221D] border-[#AA365D]/70 rounded-xl text-base";

export function ExperienceCards({ selected, onChoose }: { selected: PrivateEventPreferences["experience"]; onChoose: (value: PrivateEventPreferences["experience"]) => void }) {
  const photos = { puppy_yoga: "/manus-storage/apy_portrait_two_goldens_oct13_44cd44f3.jpg", puppy_lounge: "/manus-storage/apy_portrait_golden_cuddle_oct19_d7e4953e.jpg" };
  return <section id="private-event-experiences" aria-labelledby="private-event-experiences-title" className="bg-[#FEFAF4] pt-28 sm:pt-32 lg:pt-36 pb-12 border-b border-[#F29CB8]/35">
    <div className="container max-w-6xl">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#AA365D] mb-3">Private Events</p>
      <h1 id="private-event-experiences-title" className="font-display text-[clamp(2.5rem,4.5vw,3.75rem)] leading-[1.08] tracking-[-0.035em] mb-4">Choose Your <span className="italic text-[#AA365D]">Experience</span></h1>
      <p className="max-w-2xl text-base sm:text-lg text-[#34221D]/80 leading-relaxed mb-8">Start with the experience you want. Then choose how your event runs and the package level that fits.</p>
      <div className="grid md:grid-cols-2 gap-6">
        {(Object.keys(PRIVATE_EVENT_EXPERIENCES) as Array<PrivateEventPreferences["experience"]>).map(key => <article key={key} className={`overflow-hidden rounded-2xl border bg-[#FEFAF4] ${selected === key ? "border-[#AA365D]" : "border-[#F29CB8]/50"}`}>
          <div className="aspect-[16/9] overflow-hidden bg-[#FDE9EF]"><img src={publicPortraitUrl(photos[key])} onError={recoverPublicPortrait} alt={key === "puppy_yoga" ? "An APY guest holding two Golden Retriever puppies" : "An APY guest cuddling a Golden Retriever puppy"} width="1500" height="2000" className="w-full h-full object-cover object-[center_35%]" /></div>
          <div className="p-6 sm:p-7"><h2 className="font-display text-3xl mb-3">{PRIVATE_EVENT_EXPERIENCES[key].name}</h2><p className="text-[#34221D]/80 leading-relaxed mb-5">{PRIVATE_EVENT_EXPERIENCES[key].description}</p>
            <a href="#quote-form" onClick={() => onChoose(key)} className="inline-flex min-h-12 items-center justify-center rounded-full px-6 py-3 bg-[#F29CB8] text-[#34221D] font-semibold hover:bg-[#F29CB8]/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#AA365D] focus-visible:ring-offset-2">Choose this experience<span className="sr-only">: {PRIVATE_EVENT_EXPERIENCES[key].name}</span></a>
          </div>
        </article>)}
      </div>
      <p className="text-sm text-[#34221D]/80 leading-relaxed mt-6 max-w-3xl">{PRIVATE_EVENT_FORMAT_PRICE_NOTE}</p>
    </div>
  </section>;
}

export function EventPreferencesFields({ value, onChange }: { value: EventPreferencesDraft; onChange: (value: EventPreferencesDraft) => void }) {
  const patch = (updates: Partial<EventPreferencesDraft>) => onChange({ ...value, ...updates });
  const chooseExperience = (experience: EventPreferencesDraft["experience"]) => patch({ experience, durationMinutes: experience === "puppy_yoga" && value.schedule === "single" ? "60" : "" });
  return <div className="space-y-6">
    <fieldset className="space-y-3"><legend className="text-sm font-semibold mb-3">Preferred experience</legend><div className="grid sm:grid-cols-2 gap-3">{(Object.keys(PRIVATE_EVENT_EXPERIENCES) as Array<EventPreferencesDraft["experience"]>).map(key => <button key={key} type="button" data-experience={key} aria-pressed={value.experience === key} onClick={() => chooseExperience(key)} className={choiceClass(value.experience === key)}>{PRIVATE_EVENT_EXPERIENCES[key].name}</button>)}</div></fieldset>
    <fieldset className="space-y-3"><legend className="text-sm font-semibold mb-3">How should your event run?</legend><div className="grid gap-2">{(Object.keys(PRIVATE_EVENT_SCHEDULES) as Array<EventPreferencesDraft["schedule"]>).map(key => <button key={key} type="button" data-schedule={key} aria-pressed={value.schedule === key} onClick={() => patch({ schedule: key, durationMinutes: key === "single" && value.experience === "puppy_yoga" ? "60" : "", sessionCount: "", guestsPerSession: "", concurrentGuests: "" })} className={choiceClass(value.schedule === key)}>{PRIVATE_EVENT_SCHEDULES[key]}</button>)}</div><p className="text-sm text-[#34221D]/70">Multiple sessions include separate groups, room resets and puppy rest. Drop-in timing and capacity are agreed for your event.</p></fieldset>
    <fieldset><legend className="text-sm font-semibold mb-3">Where would you like us?</legend><div className="grid sm:grid-cols-2 gap-3">{(Object.keys(PRIVATE_EVENT_VENUES) as Array<EventPreferencesDraft["venue"]>).map(key => <button key={key} type="button" data-venue={key} aria-pressed={value.venue === key} onClick={() => patch({ venue: key })} className={choiceClass(value.venue === key)}>{PRIVATE_EVENT_VENUES[key]}</button>)}</div><p className="text-sm text-[#34221D]/70 mt-2">Studio and partner-space availability varies by city, including Guelph. We confirm your exact venue with the quote.</p></fieldset>
    <div className="grid sm:grid-cols-2 gap-5">
      <div className="space-y-2"><label htmlFor="event-duration" className="text-sm font-semibold">{value.schedule === "drop_in" ? "Lounge operating time (minutes)" : "Total event duration (minutes)"} *</label><Input id="event-duration" type="number" min="15" max="1440" step="1" required value={value.durationMinutes} onChange={e => patch({ durationMinutes: e.target.value })} placeholder="Tell us your preferred duration" className={fieldClass} /><p className="text-xs text-[#34221D]/70">For multiple sessions, include the full event window, including breaks and resets.</p></div>
      {value.schedule === "multiple" && <><div className="space-y-2"><label htmlFor="event-session-count" className="text-sm font-semibold">Number of sessions *</label><Input id="event-session-count" type="number" min="2" max="100" step="1" required value={value.sessionCount} onChange={e => patch({ sessionCount: e.target.value })} className={fieldClass} /></div><div className="space-y-2"><label htmlFor="event-guests-per-session" className="text-sm font-semibold">Expected guests per session *</label><Input id="event-guests-per-session" type="number" min="1" max="2000" step="1" required value={value.guestsPerSession} onChange={e => patch({ guestsPerSession: e.target.value })} className={fieldClass} /></div></>}
      {value.schedule === "drop_in" && <div className="space-y-2"><label htmlFor="event-concurrent-guests" className="text-sm font-semibold">Approximate guests participating at once *</label><Input id="event-concurrent-guests" type="number" min="1" max="2000" step="1" required value={value.concurrentGuests} onChange={e => patch({ concurrentGuests: e.target.value })} className={fieldClass} /></div>}
    </div>
    <div className="space-y-2"><label htmlFor="event-schedule-notes" className="text-sm font-semibold">Preferred schedule or operating hours</label><Textarea id="event-schedule-notes" value={value.scheduleNotes} maxLength={2000} onChange={e => patch({ scheduleNotes: e.target.value })} placeholder="For example: two groups between 10 am and 1 pm, or a lounge open from noon to 3 pm" className={`${fieldClass} min-h-24`} /></div>
    <div className="space-y-2"><label htmlFor="event-venue-details" className="text-sm font-semibold">{value.venue === "client_venue" ? "Your venue or address, if known" : "Preferred studio or partner space, if known"}</label><Input id="event-venue-details" value={value.venueDetails} maxLength={1000} onChange={e => patch({ venueDetails: e.target.value })} placeholder="Optional. We can help confirm the venue." className={fieldClass} /></div>
  </div>;
}
