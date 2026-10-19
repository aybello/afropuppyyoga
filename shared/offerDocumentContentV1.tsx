import React from "react";
import { getPuppyMonitorOfferShiftPay } from "./puppyMonitorTerms";
import { getMovementInstructorOfferHourlyPay } from "./movementInstructorTerms";
import { getSocialMediaCompensationText } from "./socialMediaTerms";
import { PUPPY_MONITOR_SHIFT_DESCRIPTION } from "./newCareersListings";

// Immutable V1 signed-document templates. Preserve all wording and compensation terms.

export function getOfferLetterContent(
  applicantName: string,
  role: string,
  location: string,
  offerLetterType: string,
  puppyMonitorShiftPayCad?: number | null,
  movementInstructorHourlyPayCad?: number | null,
  socialMediaHourlyPayCad?: number | null,
  documentDate: Date | string = new Date()
) {
  const today = new Date(documentDate).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  });

  const isMovementInstructor = offerLetterType === "movement_instructor";
  const instructorTitle = isMovementInstructor ? "Movement Instructor" : "Yoga Instructor";
  const isYogaInstructor = offerLetterType === "yoga_instructor";
  const isPuppySpecialist = offerLetterType === "puppy_specialist";
  const isOperationsSpecialist = offerLetterType === "operations_specialist";
  const isOperationsManager = offerLetterType === "operations_manager";
  const isBDR = offerLetterType === "bdr";
  const isSocialMediaIntern = offerLetterType === "social_media_intern";
  const isSocialMediaSpecialist = offerLetterType === "social_media_specialist";

  if (isYogaInstructor || isMovementInstructor) {
    // Saved compensation protects already-issued offers from future rate changes.
    const movementHourlyPay = getMovementInstructorOfferHourlyPay(movementInstructorHourlyPayCad);
    return (
      <div className="space-y-4 text-sm text-[#1A0A12] leading-relaxed">
        <p className="text-xs text-[#C4A0B0]">{today}</p>
        <p>Dear <strong>{applicantName}</strong>,</p>
        <p>
          We are excited to formally offer you the position of <strong>{instructorTitle}</strong> with{" "}
          <strong>AfroPuppyYoga (APY)</strong>. Your passion for wellness and dedication to community
          health makes you an excellent fit for our team.
        </p>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Position Details</p>
          <p><strong>Position:</strong> {instructorTitle}</p>
          <p><strong>Location:</strong> {location}</p>
          <p><strong>Compensation:</strong> {isMovementInstructor ? `CA$${movementHourlyPay}.00 per hour for guided movement sessions` : "$22.00 per hour for teaching yoga classes"}</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Key Responsibilities</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>{isMovementInstructor ? "Lead gentle, beginner-friendly warm-ups, stretches and simple movements, not dance choreography or yoga instruction" : "Lead engaging and safe yoga sessions tailored to participants' needs"}</li>
            <li>Incorporate AfroPuppyYoga's mission into class delivery, ensuring a joyful experience for all attendees</li>
            <li>Assist with class setup, breakdown, and interaction with puppies and participants during sessions</li>
          </ul>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Schedule and Hours</p>
          <p>
            Class scheduling will be determined based on APY's event calendar. Flexibility, punctuality,
            and adaptability are essential to maintaining the quality of our client experience.
          </p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Terms and Conditions</p>
          <p><strong>Probation Period:</strong> A probationary period of 4 months will apply to assess performance and alignment with APY's goals.</p>
          <p className="mt-2"><strong>Confidentiality:</strong> You will be required to sign a Non-Disclosure Agreement (NDA) to protect AfroPuppyYoga's proprietary information.</p>
          <p className="mt-2"><strong>Notice of Resignation:</strong> If you wish to end your engagement with AfroPuppyYoga, please provide at least two weeks' written notice whenever reasonably possible. This helps APY arrange class coverage and maintain a consistent guest experience.</p>
          <p className="mt-2"><strong>Performance Reviews:</strong> Class feedback and team collaboration will be reviewed periodically.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p>
            We are thrilled to welcome you to AfroPuppyYoga and look forward to the positive impact
            you will bring to our team and community.
          </p>
          <p className="mt-3">Warm regards,</p>
          <p className="font-bold">The AfroPuppyYoga Team</p>
          <p className="text-xs text-[#C4A0B0]">afropuppyyoga@gmail.com · 289-788-1885 · afropuppyyoga.ca</p>
        </div>
      </div>
    );
  }

  if (isOperationsSpecialist) {
    return (
      <div className="space-y-4 text-sm text-[#1A0A12] leading-relaxed">
        <p className="text-xs text-[#C4A0B0]">{today}</p>
        <p>Dear <strong>{applicantName}</strong>,</p>
        <p>
          On behalf of the AfroPuppyYoga team, we are excited to offer you the position of <strong>Operations Specialist</strong> at our <strong>{location}</strong> location. Your organization, calm problem-solving, and ability to create smooth guest and team experiences will be central to every APY class.
        </p>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Position Details</p>
          <p><strong>Position:</strong> Operations Specialist</p>
          <p><strong>Location:</strong> {location}</p>
          <p><strong>Compensation:</strong> $20.00 per hour</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Key Responsibilities</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Prepare the venue before class and ensure a smooth reset and close-down after the final session</li>
            <li>Coordinate staff arrival, class flow, guest check-in, and on-site communications</li>
            <li>Support breeder and puppy-handler arrival, handoff, supplies, and venue logistics</li>
            <li>Track operational supplies, attendance, incidents, and issues requiring follow-up</li>
            <li>Escalate safety, staffing, guest, or venue concerns promptly to APY leadership</li>
            <li>Represent AfroPuppyYoga with warmth, professionalism, and consistent attention to detail</li>
          </ul>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Schedule and Hours</p>
          <p>Scheduling will be determined by APY's event calendar. Weekend availability, punctuality, and flexibility are essential for this class-operations role.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Terms and Conditions</p>
          <p><strong>Probation Period:</strong> A probationary period of 4 months will apply to assess performance and alignment with APY's standards.</p>
          <p className="mt-2"><strong>Confidentiality:</strong> You will be required to sign a Non-Disclosure Agreement (NDA) to protect AfroPuppyYoga's proprietary information.</p>
          <p className="mt-2"><strong>Notice of Resignation:</strong> If you wish to end your engagement with AfroPuppyYoga, please provide at least two weeks' written notice whenever reasonably possible. This helps APY arrange coverage and maintain a consistent guest experience.</p>
          <p className="mt-2"><strong>Dress Code:</strong> Black APY-appropriate attire and grippy socks are required for on-site shifts.</p>
          <p className="mt-2"><strong>Performance Reviews:</strong> Operational readiness, team collaboration, and guest experience outcomes will be reviewed periodically.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p>We are thrilled to welcome you to AfroPuppyYoga and look forward to the care and operational consistency you will bring to our classes.</p>
          <p className="mt-3">Warmly,</p>
          <p className="font-bold">Ay &amp; The AfroPuppyYoga Team</p>
          <p className="text-xs text-[#C4A0B0]">afropuppyyoga@gmail.com · 289-788-1885 · afropuppyyoga.ca</p>
        </div>
      </div>
    );
  }

  if (isOperationsManager) {
    return (
      <div className="space-y-4 text-sm text-[#1A0A12] leading-relaxed">
        <p className="text-xs text-[#C4A0B0]">{today}</p>
        <p>Dear <strong>{applicantName}</strong>,</p>
        <p>
          On behalf of the AfroPuppyYoga team, we are delighted to offer you the position of <strong>Operations Manager</strong> for our <strong>{location}</strong> operations. You will own how our class days run, lead the on-site team, and carry responsibility for the guest experience from setup to close.
        </p>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Position Details</p>
          <p><strong>Position:</strong> Operations Manager</p>
          <p><strong>Location:</strong> {location}</p>
          <p><strong>Reports to:</strong> APY ownership</p>
          <p><strong>Compensation:</strong> Compensation and approved hours will follow the terms confirmed in writing by APY.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Key Responsibilities</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Lead class-day operations end to end, including setup, session flow, resets, and close-down</li>
            <li>Coordinate staffing coverage across instructors, Puppy Monitors, and operations team members</li>
            <li>Act as the on-site point of escalation for safety, guest, staffing, and venue concerns</li>
            <li>Oversee puppy-partner arrival, handoff, welfare breaks, and departure alongside the puppy specialist</li>
            <li>Maintain accurate attendance, incident, and follow-up records in APY's approved systems</li>
            <li>Support scheduling, team readiness, and training completion for assigned locations</li>
            <li>Uphold AfroPuppyYoga's standards for guest experience, puppy welfare, and team conduct</li>
          </ul>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Systems Access and Authority</p>
          <p>This role includes elevated APY HQ access for scheduling, staffing, and operational records. Access is granted for APY business use only and is adjusted or removed when the role or engagement changes.</p>
          <p className="mt-2">You may not commit APY to pricing, partnerships, refunds, or contractual obligations without prior written approval from ownership.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Schedule and Hours</p>
          <p>Scheduling follows APY's event calendar. Weekend availability, punctuality, and dependable communication are essential, as the team and guests rely on this role being present and reachable on class days.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Terms and Conditions</p>
          <p><strong>Probation Period:</strong> A probationary period of 4 months will apply to assess performance and alignment with APY's standards.</p>
          <p className="mt-2"><strong>Confidentiality:</strong> You will be required to sign a Non-Disclosure Agreement (NDA) to protect AfroPuppyYoga's proprietary information, including guest data, partner arrangements, and internal operations.</p>
          <p className="mt-2"><strong>Notice of Resignation:</strong> If you wish to end your engagement with AfroPuppyYoga, please provide at least two weeks' written notice whenever reasonably possible. This helps APY arrange leadership coverage for scheduled classes.</p>
          <p className="mt-2"><strong>Dress Code:</strong> Black APY-appropriate attire and grippy socks are required for on-site shifts.</p>
          <p className="mt-2"><strong>Performance Reviews:</strong> Operational consistency, team leadership, guest experience outcomes, and record accuracy will be reviewed periodically.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p>We are excited to have you lead our class-day operations and shape the experience our guests and team members count on.</p>
          <p className="mt-3">Warmly,</p>
          <p className="font-bold">Ay &amp; The AfroPuppyYoga Team</p>
          <p className="text-xs text-[#C4A0B0]">afropuppyyoga@gmail.com · 289-788-1885 · afropuppyyoga.ca</p>
        </div>
      </div>
    );
  }

  // Puppy Specialist
  if (isPuppySpecialist) {
    return (
      <div className="space-y-4 text-sm text-[#1A0A12] leading-relaxed">
        <p className="text-xs text-[#C4A0B0]">{today}</p>
        <p>Dear <strong>{applicantName}</strong>,</p>
        <p>
          On behalf of the entire AfroPuppyYoga team, we are thrilled to offer you the position of{" "}
          <strong>Puppy Specialist</strong> at our <strong>{location}</strong> location. Your love for
          animals and commitment to creating safe, joyful experiences for our puppies and participants
          makes you an outstanding addition to our team.
        </p>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Position Details</p>
          <p><strong>Position:</strong> Puppy Specialist</p>
          <p><strong>Location:</strong> {location}</p>
          <p><strong>Compensation:</strong> $18.00 per hour</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Key Responsibilities</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Serve as the primary caretaker and handler for puppies during all APY sessions</li>
            <li>Monitor puppy health, behaviour, and stress levels throughout each class</li>
            <li>Ensure all puppies are properly socialized, fed, and rested before and after sessions</li>
            <li>Coordinate puppy logistics including transport, supplies, and veterinary communication</li>
            <li>Educate participants on safe and respectful puppy interaction</li>
            <li>Represent AfroPuppyYoga with warmth, professionalism, and a deep love for animals</li>
          </ul>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Schedule and Hours</p>
          <p>
            Scheduling will be determined based on APY's event calendar. Flexibility and availability
            on weekends are essential for this role.
          </p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Terms and Conditions</p>
          <p><strong>Probation Period:</strong> A probationary period of 4 months will apply to assess performance and alignment with APY's standards.</p>
          <p className="mt-2"><strong>Confidentiality:</strong> You will be required to sign a Non-Disclosure Agreement (NDA) to protect AfroPuppyYoga's proprietary information.</p>
          <p className="mt-2"><strong>Notice of Resignation:</strong> If you wish to end your engagement with AfroPuppyYoga, please provide at least two weeks' written notice whenever reasonably possible. This helps APY arrange class coverage and maintain a consistent guest experience.</p>
          <p className="mt-2"><strong>Dress Code:</strong> Black yoga attire and grippy socks are required for all sessions.</p>
          <p className="mt-2"><strong>Performance Reviews:</strong> Puppy welfare outcomes and team collaboration will be reviewed periodically.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p>
            We are so excited to welcome you to the AfroPuppyYoga family. The puppies are already
            excited to meet you! 🐶💕
          </p>
          <p className="mt-3">Warmly,</p>
          <p className="font-bold">Ay &amp; The AfroPuppyYoga Team</p>
          <p className="text-xs text-[#C4A0B0]">afropuppyyoga@gmail.com · 289-788-1885 · afropuppyyoga.ca</p>
        </div>
      </div>
    );
  }

  if (isBDR) {
    return (
      <div className="space-y-4 text-sm text-[#1A0A12] leading-relaxed">
        <p className="text-xs text-[#C4A0B0]">{today}</p>
        <p>Dear <strong>{applicantName}</strong>,</p>
        <p>
          We are excited to formally offer you the position of <strong>Business Development Representative (BDR)</strong> with <strong>AfroPuppyYoga (APY)</strong>. Your relationship-building approach and understanding of wellness-focused businesses will help expand APY's partnerships and private-event opportunities.
        </p>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Position Details</p>
          <p><strong>Position:</strong> Business Development Representative (BDR)</p>
          <p><strong>Work Arrangement:</strong> Remote · Central APY Team</p>
          <p><strong>Independent Contractor:</strong> This engagement is an independent-contractor arrangement and does not create an employment, partnership, joint-venture, or agency relationship.</p>
          <p className="mt-2"><strong>Compensation:</strong> 7% commission on inbound business and 10% commission on outbound business, calculated on Eligible Collected Revenue.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Key Responsibilities</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Respond to and qualify inbound partnership, corporate wellness, and private-event opportunities</li>
            <li>Research and conduct outbound outreach to prospective partners, businesses, and community organizations</li>
            <li>Maintain accurate opportunity notes and handoffs within APY's business-development workflow</li>
            <li>Represent AfroPuppyYoga's wellness, culture, and puppy-welfare standards professionally in every interaction</li>
          </ul>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Commission Terms</p>
          <p><strong>Inbound business:</strong> Opportunities that first contact APY through an APY-owned channel, where you materially participate in qualifying, nurturing, or closing the opportunity.</p>
          <p className="mt-2"><strong>Outbound business:</strong> Opportunities you first identify and actively approach on APY's behalf, recorded in APY's designated workflow. APY may reasonably determine attribution where more than one person has materially contributed.</p>
          <p className="mt-2"><strong>Eligible Collected Revenue:</strong> Amounts actually received and retained by APY, excluding HST and other sales taxes, refunds, chargebacks, payment reversals, complimentary services, and unapproved discounts.</p>
          <p className="mt-2"><strong>Payment timing:</strong> Commission is earned only as APY receives Eligible Collected Revenue and will be paid within 15 days after the end of the month in which the applicable revenue is received, subject to any required invoice and completed opportunity documentation.</p>
          <p className="mt-2"><strong>Repeat business:</strong> Unless APY agrees otherwise in writing, commission applies to the initial paid booking or first paid transaction only; renewals, repeat bookings, expansions, and later work are not automatically commissionable.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Notice, Direct Costs, and Limited Set-Off</p>
          <p><strong>Notice:</strong> If you wish to end this contractor engagement, please provide at least two weeks' written notice whenever reasonably possible. This requirement does not apply where notice is not reasonably possible because of an emergency or other circumstances outside your reasonable control.</p>
          <p className="mt-2"><strong>Direct documented costs only:</strong> If a material failure to provide notice directly causes APY to incur a reasonable, documented external replacement cost, APY may determine and recover that actual direct cost. APY will not seek lost profits, anticipated revenue, internal staff time, general overhead, or consequential or punitive damages under this clause.</p>
          <p className="mt-2"><strong>Written notice and response:</strong> Before applying any recovery, APY will provide written notice describing the amount and supporting documentation. You may provide relevant information or raise a dispute within five business days, and APY will consider it before finalizing its reasonable determination.</p>
          <p className="mt-2"><strong>Limited set-off authorization:</strong> To the extent permitted by law, you authorize APY to set off APY's reasonable, documented determination of an eligible direct replacement cost against unpaid approved commissions or invoices, after the written-notice process above. Any remaining undisputed approved commission or invoice balance will be paid under APY's normal payment terms.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Terms and Conditions</p>
          <p><strong>Records and Authority:</strong> You must maintain accurate opportunity notes and handoffs in APY's designated workflow. You may not bind APY, approve discounts, or promise pricing, dates, availability, or services without APY's prior written approval.</p>
          <p className="mt-2"><strong>Confidentiality:</strong> You will be required to sign a Non-Disclosure Agreement (NDA) to protect AfroPuppyYoga's proprietary information.</p>
          <p className="mt-2"><strong>Notice of Resignation:</strong> If you wish to end your engagement with AfroPuppyYoga, please provide at least two weeks' written notice whenever reasonably possible. This helps APY maintain continuity across active business opportunities.</p>
          <p className="mt-2"><strong>Performance Reviews:</strong> Outreach activity, opportunity quality, and collaboration will be reviewed periodically.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p>We are thrilled to welcome you to AfroPuppyYoga and look forward to the partnerships and experiences you will help create.</p>
          <p className="mt-3">Warm regards,</p>
          <p className="font-bold">The AfroPuppyYoga Team</p>
          <p className="text-xs text-[#C4A0B0]">afropuppyyoga@gmail.com · 289-788-1885 · afropuppyyoga.ca</p>
        </div>
      </div>
    );
  }

  if (isSocialMediaIntern || isSocialMediaSpecialist) {
    const socialTitle = isSocialMediaIntern ? "Social Media Intern" : "Social Media Specialist";
    return (
      <div className="space-y-4 text-sm text-[#1A0A12] leading-relaxed">
        <p className="text-xs text-[#C4A0B0]">{today}</p>
        <p>Dear <strong>{applicantName}</strong>,</p>
        <p>
          We are excited to offer you the position of <strong>{socialTitle}</strong> with <strong>AfroPuppyYoga (APY)</strong>. Your creativity, platform knowledge, and ability to build community will help APY reach more guests and strengthen its online presence.
        </p>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Position Details</p>
          <p><strong>Position:</strong> {socialTitle}</p>
          <p><strong>Work Arrangement:</strong> Remote · Canada</p>
          <p><strong>Compensation:</strong> {getSocialMediaCompensationText(socialMediaHourlyPayCad)}</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Key Responsibilities</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Create and schedule engaging content across Instagram, TikTok, and Facebook</li>
            <li>Film and edit Reels, Stories, and short-form video content</li>
            <li>Engage with the APY community by responding to comments, direct messages, and mentions</li>
            <li>Help plan the social media calendar and maintain a consistent brand voice</li>
            <li>Track performance metrics and share useful insights with the team</li>
            <li>Support influencer outreach and brand collaboration campaigns</li>
          </ul>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Schedule and Hours</p>
          <p>This is a flexible remote role. Specific hours, content deadlines, meetings, and campaign priorities will be agreed with APY in advance.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Terms and Conditions</p>
          <p><strong>Probation Period:</strong> A probationary period of 4 months will apply to assess performance and alignment with APY's goals.</p>
          <p className="mt-2"><strong>Confidentiality:</strong> You will be required to sign a Non-Disclosure Agreement (NDA) to protect AfroPuppyYoga's proprietary information.</p>
          <p className="mt-2"><strong>Content and approvals:</strong> APY-owned accounts, brand assets, guest information, and unpublished campaign materials must be handled through APY's approved workflow. Do not publish content on behalf of APY without the required approval.</p>
          <p className="mt-2"><strong>Notice of Resignation:</strong> If you wish to end your engagement with AfroPuppyYoga, please provide at least two weeks' written notice whenever reasonably possible.</p>
          <p className="mt-2"><strong>Performance Reviews:</strong> Content quality, reliability, audience engagement, and collaboration will be reviewed periodically.</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p>We are excited to have you help tell the AfroPuppyYoga story and build a thoughtful, welcoming online community.</p>
          <p className="mt-3">Warm regards,</p>
          <p className="font-bold">The AfroPuppyYoga Team</p>
          <p className="text-xs text-[#C4A0B0]">afropuppyyoga@gmail.com · 289-788-1885 · afropuppyyoga.ca</p>
        </div>
      </div>
    );
  }

  // Saved compensation protects already-issued offers from future template changes.
  const puppyMonitorShiftPay = getPuppyMonitorOfferShiftPay(puppyMonitorShiftPayCad);
  const isCurrentPuppyMonitorOffer = puppyMonitorShiftPay === 60;
  return (
    <div className="space-y-4 text-sm text-[#1A0A12] leading-relaxed">
      <p className="text-xs text-[#C4A0B0]">{today}</p>
      <p>Dear <strong>{applicantName}</strong>,</p>
      <p>
        On behalf of the entire AfroPuppyYoga team, we are thrilled to offer you the {isCurrentPuppyMonitorOffer ? "paid volunteer" : "volunteer"} position of{" "}
        <strong>Puppy Monitor</strong> at our <strong>{location}</strong> location!
      </p>
      <p>
        You stood out to us with your energy, passion, and alignment with our mission — blending wellness,
        culture, and puppy love in a way that's truly one of a kind. We can't wait to have you on the team.
      </p>

      <div className="border-t border-[#F0D0DC] pt-4">
        <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Position Details</p>
        <p><strong>Position:</strong> Puppy Monitor</p>
        <p><strong>Location:</strong> {location}</p>
        <p><strong>Compensation:</strong> {isCurrentPuppyMonitorOffer ? "CA$60.00 per shift" : "$50.00 per shift"}</p>
        {isCurrentPuppyMonitorOffer && <p><strong>Shift:</strong> {PUPPY_MONITOR_SHIFT_DESCRIPTION}</p>}
      </div>

      <div className="border-t border-[#F0D0DC] pt-4">
        <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Key Responsibilities</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Assist with class setup and breakdown before and after each session</li>
          <li>Monitor puppy welfare and safety throughout the class</li>
          <li>Support participant check-in and ensure a welcoming environment</li>
          <li>Handle puppies with care and follow APY's puppy safety guidelines at all times</li>
          <li>Represent the AfroPuppyYoga brand with professionalism and warmth</li>
        </ul>
      </div>

      <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Terms and Conditions</p>
          <p><strong>Probation Period:</strong> A probationary period of 4 months will apply.</p>
          <p className="mt-2"><strong>Confidentiality:</strong> You will be required to sign a Non-Disclosure Agreement (NDA) to protect AfroPuppyYoga's proprietary information.</p>
          <p className="mt-2"><strong>Notice of Resignation:</strong> If you wish to end your engagement with AfroPuppyYoga, please provide at least two weeks' written notice whenever reasonably possible. This helps APY arrange class coverage and maintain a consistent guest experience.</p>
          <p className="mt-2"><strong>Dress Code:</strong> Black yoga attire and grippy socks are required for all sessions.</p>
      </div>

      <div className="border-t border-[#F0D0DC] pt-4">
        <p>
          We are so excited to welcome you into the AfroPuppyYoga family. The puppies are already
          excited to meet you! 🐶💕
        </p>
        <p className="mt-3">Warmly,</p>
        <p className="font-bold">Ay &amp; The AfroPuppyYoga Team</p>
        <p className="text-xs text-[#C4A0B0]">afropuppyyoga@gmail.com · 289-788-1885 · afropuppyyoga.ca</p>
      </div>
    </div>
  );
}

export function getNDAContent(applicantName: string, role: string, documentDate: Date | string = new Date()) {
  const today = new Date(documentDate).toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  });

  return (
    <div className="space-y-4 text-sm text-[#1A0A12] leading-relaxed">
      <p className="text-center font-bold text-base text-[#8B2252]">NON-DISCLOSURE AGREEMENT</p>
      <p className="text-xs text-[#C4A0B0] text-center">{today}</p>

      <p>
        This Non-Disclosure Agreement ("Agreement") is entered into between{" "}
        <strong>AfroPuppyYoga</strong> ("Company") and <strong>{applicantName}</strong> ("Recipient")
        in connection with the Recipient's role as <strong>{role}</strong>.
      </p>

      <div className="border-t border-[#F0D0DC] pt-4">
        <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">1. Confidential Information</p>
        <p>
          "Confidential Information" means any non-public information disclosed by the Company to the
          Recipient, including but not limited to: business operations, class formats, pricing, client
          lists, marketing strategies, supplier relationships, financial information, and any other
          proprietary information relating to AfroPuppyYoga's business.
        </p>
      </div>

      <div className="border-t border-[#F0D0DC] pt-4">
        <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">2. Obligations</p>
        <p>The Recipient agrees to:</p>
        <ul className="list-disc pl-5 space-y-1 mt-2">
          <li>Keep all Confidential Information strictly confidential</li>
          <li>Not disclose Confidential Information to any third party without prior written consent from the Company</li>
          <li>Use Confidential Information solely for the purpose of fulfilling their role at AfroPuppyYoga</li>
          <li>Not copy, reproduce, or distribute any Confidential Information without authorization</li>
        </ul>
      </div>

      <div className="border-t border-[#F0D0DC] pt-4">
        <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">3. Social Media and Brand Representation</p>
        <p>
          The Recipient agrees not to post, share, or publish any content related to AfroPuppyYoga's
          operations, internal processes, client information, or proprietary materials on social media
          or any public platform without prior written approval from the Company.
        </p>
      </div>

      <div className="border-t border-[#F0D0DC] pt-4">
        <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">4. Duration</p>
        <p>
          This Agreement shall remain in effect during the Recipient's engagement with AfroPuppyYoga
          and for a period of <strong>2 years</strong> following the termination of such engagement.
        </p>
      </div>

      <div className="border-t border-[#F0D0DC] pt-4">
        <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">5. Remedies</p>
        <p>
          The Recipient acknowledges that any breach of this Agreement may cause irreparable harm to
          AfroPuppyYoga and that the Company shall be entitled to seek equitable relief, including
          injunctive relief, in addition to all other remedies available at law.
        </p>
      </div>

      <div className="border-t border-[#F0D0DC] pt-4">
        <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">6. Governing Law</p>
        <p>
          This Agreement shall be governed by the laws of the Province of Ontario, Canada.
        </p>
      </div>

      <div className="border-t border-[#F0D0DC] pt-4">
        <p>
          By signing below, the Recipient acknowledges that they have read, understood, and agree to
          be bound by the terms of this Non-Disclosure Agreement.
        </p>
      </div>
    </div>
  );
}
