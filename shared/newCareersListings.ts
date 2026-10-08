import { PUPPY_MONITOR_PAY_DESCRIPTION, PUPPY_MONITOR_PAY_LABEL, PUPPY_MONITOR_POSITION_TYPE } from "./puppyMonitorTerms";
import { MOVEMENT_INSTRUCTOR_PAY_DESCRIPTION, MOVEMENT_INSTRUCTOR_PAY_LABEL } from "./movementInstructorTerms";

export const PUPPY_MONITOR_SHIFT_DESCRIPTION =
  "Shifts run from 9:00 a.m. to 2:30 p.m. and cover three classes, with breaks between classes.";

export const NEW_CAREERS_LISTINGS = [
  ...[
    { id: "movement-instructor-kw", location: "Kitchener", locationCode: "KW" },
    { id: "movement-instructor-guelph", location: "Guelph", locationCode: "GUE" },
  ].map((location) => ({
    ...location,
    title: "Movement Instructor",
    type: "Part-Time",
    badge: "Now Hiring",
    subBadge: "Dance instructors welcome",
    icon: "movement",
    pay: MOVEMENT_INSTRUCTOR_PAY_LABEL,
    description: "Guide guests through simple stretches, warm-ups and gentle, beginner-friendly movements in a welcoming setting with music and puppies. Dance instructors are welcome, but this is not a dance class: no choreography or yoga certification is required. You lead the movement portion while Puppy Monitors focus on puppy care.",
    responsibilities: [
      "Lead simple warm-ups, gentle stretches and easy, low-impact movements",
      "Demonstrate movements clearly and offer easier options for beginners",
      "Encourage guests to move at their own pace and within their comfort level",
      "Create a relaxed, welcoming atmosphere with clear guidance and suitable music",
      "Coordinate with Puppy Monitors and Operations on timing and puppy wellbeing",
      "Adapt or pause movement when needed and help prepare and reset the space",
    ],
    requirements: [
      "Confidence guiding a group with clear, patient instructions",
      "Comfort demonstrating simple movements and adapting them for beginners",
      "Experience teaching dance, fitness or group movement is an asset",
      "Comfort around dogs and respect for puppy wellbeing",
      "Reliability, punctuality and availability for agreed event-based shifts",
      "No choreography or yoga teaching certificate required for this role",
    ],
    perks: [MOVEMENT_INSTRUCTOR_PAY_DESCRIPTION, "Part-time, event-based scheduling", "Work with a welcoming wellness and puppy-care team"],
  })),
  {
    id: "puppy-monitor-guelph", title: "Puppy Monitor", location: "Guelph", locationCode: "GUE",
    type: PUPPY_MONITOR_POSITION_TYPE, badge: "Now Hiring", icon: "puppy", pay: PUPPY_MONITOR_PAY_LABEL,
    description: `Help keep puppies safe, comfortable and cared for at AfroPuppyYoga events in Guelph. You will supervise puppies before, during and after sessions, support gentle guest interaction, and work alongside the instructor with puppy wellbeing as your main focus. ${PUPPY_MONITOR_SHIFT_DESCRIPTION}`,
    responsibilities: [
      "Supervise puppies and follow APY's handling and welfare guidance",
      "Support safe, gentle guest interaction and explain handling instructions",
      "Watch for signs that a puppy needs rest, water or a break and alert the event lead",
      "Prepare puppy supplies, clean accidents and help reset the event space",
      "Coordinate with the instructor so movements can be adapted or paused when needed",
    ],
    requirements: [
      "Comfort handling dogs gently and a genuine interest in their wellbeing",
      "A calm, patient and attentive approach",
      "Reliability, punctuality and clear communication",
      "Availability for agreed event-based shifts in Guelph",
      "Dog-care experience and canine first aid are assets, not required certifications",
    ],
    perks: [PUPPY_MONITOR_PAY_DESCRIPTION, "Part-time, event-based scheduling", "Hands-on puppy care and guest experience"],
  },
  {
    id: "operations-specialist-guelph", title: "Operations Specialist", location: "Guelph", locationCode: "GUE",
    type: "Part-Time", badge: "Now Hiring", icon: "operations", pay: "CA$20/hr",
    description: "Keep AfroPuppyYoga's Guelph events running smoothly from setup to final reset. Coordinate team readiness, guest check-in, class flow and puppy-partner logistics, and help maintain a safe, welcoming experience for guests, staff and puppies.",
    responsibilities: [
      "Prepare the venue and supplies before sessions and manage the reset afterward",
      "Coordinate staff arrival, guest check-in, session timing and on-site communications",
      "Support breeder and puppy-partner arrival, handoff and event-day logistics",
      "Track attendance, supplies, incidents and follow-up items for APY leadership",
      "Escalate staffing, venue, safety or guest concerns promptly",
    ],
    requirements: [
      "Availability and reliability for weekend event-based shifts in Guelph",
      "Organization, calm problem-solving and clear communication",
      "Comfort taking initiative and working with an event team",
      "Comfort around dogs and respect for puppy wellbeing",
      "Event, hospitality, studio or operations experience is an asset",
    ],
    perks: ["CA$20 per hour", "Part-time, event-based scheduling", "Hands-on wellness event and operations experience"],
  },
];
