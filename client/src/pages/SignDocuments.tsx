import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, Loader2, PenLine } from "lucide-react";

// ─── Inline Document Content ──────────────────────────────────────────────────

function getOfferLetterContent(
  applicantName: string,
  role: string,
  location: string,
  offerLetterType: string
) {
  const today = new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  });

  const isYogaInstructor = offerLetterType === "yoga_instructor";
  const isPuppySpecialist = offerLetterType === "puppy_specialist";
  const isOperationsSpecialist = offerLetterType === "operations_specialist";
  const isBDR = offerLetterType === "bdr";

  if (isYogaInstructor) {
    return (
      <div className="space-y-4 text-sm text-[#1A0A12] leading-relaxed">
        <p className="text-xs text-[#C4A0B0]">{today}</p>
        <p>Dear <strong>{applicantName}</strong>,</p>
        <p>
          We are excited to formally offer you the position of <strong>Yoga Instructor</strong> with{" "}
          <strong>AfroPuppyYoga (APY)</strong>. Your passion for wellness and dedication to community
          health makes you an excellent fit for our team.
        </p>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Position Details</p>
          <p><strong>Position:</strong> Yoga Instructor</p>
          <p><strong>Location:</strong> {location}</p>
          <p><strong>Compensation:</strong> $22.00 per hour for teaching yoga classes</p>
        </div>

        <div className="border-t border-[#F0D0DC] pt-4">
          <p className="font-bold text-[#8B2252] uppercase text-xs tracking-wide mb-2">Key Responsibilities</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Lead engaging and safe yoga sessions tailored to participants' needs</li>
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

  // Puppy Monitor (KW or Hamilton)
  return (
    <div className="space-y-4 text-sm text-[#1A0A12] leading-relaxed">
      <p className="text-xs text-[#C4A0B0]">{today}</p>
      <p>Dear <strong>{applicantName}</strong>,</p>
      <p>
        On behalf of the entire AfroPuppyYoga team, we are thrilled to offer you the volunteer position of{" "}
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
        <p><strong>Compensation:</strong> $50.00 per shift</p>
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

function getNDAContent(applicantName: string, role: string) {
  const today = new Date().toLocaleDateString("en-CA", {
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

// ─── Document Card ────────────────────────────────────────────────────────────

function DocumentCard({
  title,
  subtitle,
  children,
  checked,
  onChange,
  checkLabel,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  checkLabel: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-[#F0D0DC] mb-6 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="bg-[#FFF5F8] px-6 py-4 border-b border-[#F0D0DC] flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-[#8B2252]/10 flex items-center justify-center flex-shrink-0">
          <span className="text-sm">📄</span>
        </div>
        <div>
          <p className="font-bold text-[#1A0A12] text-sm">{title}</p>
          <p className="text-xs text-[#C4A0B0]">{subtitle}</p>
        </div>
      </div>

      {/* Document body — scrollable */}
      <div className="px-6 py-5 max-h-80 overflow-y-auto border-b border-[#F0D0DC] bg-[#FEFAF4]">
        {children}
      </div>

      {/* Confirmation checkbox */}
      <div className="px-6 py-4 flex items-center gap-3">
        <input
          type="checkbox"
          id={`check-${title}`}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-4 h-4 accent-[#8B2252] cursor-pointer"
        />
        <label htmlFor={`check-${title}`} className="text-sm text-[#3D1A2E] cursor-pointer select-none">
          {checkLabel}
        </label>
      </div>
    </div>
  );
}

// ─── Checkbox Item ────────────────────────────────────────────────────────────

function CheckboxItem({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 mt-0.5 accent-[#8B2252] cursor-pointer flex-shrink-0"
      />
      <label htmlFor={id} className="text-sm text-[#3D1A2E] cursor-pointer select-none leading-snug">
        {label}
      </label>
    </div>
  );
}

// ─── Error State ──────────────────────────────────────────────────────────────

function ErrorState({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center bg-white rounded-2xl border border-[#F0D0DC] p-10 shadow-sm">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h2 className="font-body text-xl font-bold text-[#1A0A12] mb-3">Unable to Load Documents</h2>
        <p className="text-sm text-[#1A0A12] leading-relaxed mb-6">{message}</p>
        <p className="text-xs text-[#C4A0B0]">
          Need help? Contact us at{" "}
          <a href="mailto:afropuppyyoga@gmail.com" className="text-[#8B2252] hover:underline">
            afropuppyyoga@gmail.com
          </a>{" "}
          or call{" "}
          <a href="tel:2897881885" className="text-[#8B2252] hover:underline">
            289-788-1885
          </a>
        </p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SignDocuments() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";

  const [signedName, setSignedName] = useState("");
  const [hasReadOffer, setHasReadOffer] = useState(false);
  const [hasReadNDA, setHasReadNDA] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, error } = trpc.signing.getSigningRequest.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  const submitMutation = trpc.signing.submitSignature.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (err) => toast.error(err.message || "Something went wrong. Please try again."),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedName.trim()) {
      toast.error("Please enter your full name to sign.");
      return;
    }
    if (!hasReadOffer || !hasReadNDA) {
      toast.error("Please confirm you have read both documents before signing.");
      return;
    }
    submitMutation.mutate({ token, signedName: signedName.trim() });
  };

  if (!token) {
    return <ErrorState message="No signing token found. Please use the link from your email." />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#8B2252] mx-auto mb-4" />
          <p className="text-[#8B2252] font-medium">Loading your documents...</p>
        </div>
      </div>
    );
  }

  if (error) return <ErrorState message={error.message} />;
  if (!data) return null;

  // Already signed
  if (data.signed || submitted) {
    return (
      <div className="min-h-screen bg-[#FEFAF4] flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl border border-[#F0D0DC] p-10 shadow-sm">
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-6" />
            <h1 className="font-body text-2xl font-bold text-[#1A0A12] mb-3">Documents Signed!</h1>
            <p className="text-[#3D1A2E] text-sm leading-relaxed mb-6">
              Thank you{data.signedName ? `, ${data.signedName}` : ""}! Your Offer Letter and NDA
              have been signed and received by AfroPuppyYoga. We'll be in touch shortly with your
              onboarding details.
            </p>
            <div className="bg-[#FFF5F8] rounded-xl p-4 border border-[#F0D0DC] text-left mb-6">
              <p className="text-xs text-[#8B2252] font-semibold uppercase tracking-wide mb-2">
                Signing Record
              </p>
              <p className="text-xs text-[#1A0A12]">
                Signed as: <strong>{data.signedName}</strong>
              </p>
              {data.signedAt && (
                <p className="text-xs text-[#1A0A12] mt-1">
                  Date:{" "}
                  {new Date(data.signedAt).toLocaleString("en-CA", {
                    timeZone: "America/Toronto",
                  })}
                </p>
              )}
            </div>
            <a
              href="https://afropuppyyoga.ca"
              className="text-sm text-[#8B2252] hover:underline font-medium"
            >
              Visit afropuppyyoga.ca
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFAF4]">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#8B2252] to-[#8B2252] py-6 px-4 text-center">
        <p className="font-body text-xl font-bold text-white tracking-wide">🐾 AfroPuppyYoga</p>
        <p className="text-xs text-white/70 mt-1 tracking-widest uppercase">
          Document Signing Portal
        </p>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Welcome banner */}
        <div className="bg-white rounded-2xl border border-[#F0D0DC] p-6 mb-8 shadow-sm">
          <h1 className="font-body text-2xl font-bold text-[#1A0A12] mb-2">
            Hi {data.applicantName}! 👋
          </h1>
          <p className="text-[#3D1A2E] text-sm leading-relaxed">
            Please read both documents below carefully, check the boxes to confirm you have read and
            understood each one, then sign at the bottom. This takes about 2 minutes.
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-[#C4A0B0]">
            <span>📋</span>
            <span>
              <strong>{data.role}</strong> — {data.location}
            </span>
          </div>
        </div>

        {/* Document 1: Offer Letter */}
        <DocumentCard
          title="Offer Letter"
          subtitle={`${data.role} — ${data.location}`}
          checked={hasReadOffer}
          onChange={setHasReadOffer}
          checkLabel="I have read and understood the Offer Letter"
        >
          {getOfferLetterContent(
            data.applicantName,
            data.role,
            data.location,
            data.offerLetterType
          )}
        </DocumentCard>

        {/* Document 2: NDA */}
        <DocumentCard
          title="Non-Disclosure Agreement (NDA)"
          subtitle="Confidentiality Agreement — All Positions"
          checked={hasReadNDA}
          onChange={setHasReadNDA}
          checkLabel="I have read and understood the NDA"
        >
          {getNDAContent(data.applicantName, data.role)}
        </DocumentCard>

        {/* Signature form */}
        <div className="bg-white rounded-2xl border border-[#F0D0DC] p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-full bg-[#FFF5F8] border border-[#F0D0DC] flex items-center justify-center">
              <PenLine className="w-4 h-4 text-[#8B2252]" />
            </div>
            <div>
              <h2 className="font-body text-lg font-bold text-[#1A0A12]">Digital Signature</h2>
              <p className="text-xs text-[#C4A0B0]">Type your full legal name to sign both documents</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label
                htmlFor="signedName"
                className="text-sm font-semibold text-[#3D1A2E] mb-2 block"
              >
                Full Legal Name <span className="text-[#8B2252]">*</span>
              </Label>
              <Input
                id="signedName"
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                placeholder="e.g. Jane Doe"
                className="border-[#F0D0DC] focus:border-[#8B2252] focus:ring-[#8B2252]/20 text-[#1A0A12] font-body text-lg h-12"
                required
              />
              <p className="text-xs text-[#C4A0B0] mt-1.5">
                By typing your name above, you are providing a legally binding digital signature for
                both documents.
              </p>
            </div>

            {/* Confirmation checkboxes */}
            <div className="space-y-3 bg-[#FFF5F8] rounded-xl p-4 border border-[#F0D0DC]">
              <CheckboxItem
                id="confirmOffer"
                checked={hasReadOffer}
                onChange={setHasReadOffer}
                label="I have read and agree to the terms of the Offer Letter"
              />
              <CheckboxItem
                id="confirmNDA"
                checked={hasReadNDA}
                onChange={setHasReadNDA}
                label="I have read and agree to the terms of the Non-Disclosure Agreement"
              />
            </div>

            <Button
              type="submit"
              disabled={
                submitMutation.isPending ||
                !signedName.trim() ||
                !hasReadOffer ||
                !hasReadNDA
              }
              className="w-full h-12 bg-gradient-to-r from-[#8B2252] to-[#8B2252] hover:from-[#8B2252] hover:to-[#8B2252] text-white font-bold text-base rounded-xl"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                "✍️ Sign & Submit Documents"
              )}
            </Button>

            <p className="text-xs text-center text-[#C4A0B0]">
              By clicking "Sign & Submit", you agree to the terms of both documents. This action is
              recorded with a timestamp and cannot be undone.
            </p>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-8 border-t border-[#F0D0DC] mt-4">
        <p className="text-xs text-[#C4A0B0]">
          AfroPuppyYoga · Kitchener-Waterloo &amp; Hamilton, Ontario ·{" "}
          <a href="https://afropuppyyoga.ca" className="text-[#8B2252] hover:underline">
            afropuppyyoga.ca
          </a>
        </p>
      </div>
    </div>
  );
}
