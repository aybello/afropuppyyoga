import { BOOK_URL, LOGO_URL  } from "@/const";
/* ============================================================
   Footer — Minimal, warm, brand-consistent
   ============================================================ */

const navGroups = [
  {
    heading: "Classes & Events",
    links: [
      { label: "Book a Class", href: BOOK_URL, isExternal: true },
      { label: "Experience", href: "#experience" },
      { label: "Memberships", href: "#memberships" },
      { label: "Private Events", href: "#private-events" },
      { label: "Birthday Packages", href: "/birthday", isPage: true },
      { label: "Rewards", href: "/loyalty", isPage: true },
    ],
  },
  {
    heading: "About & More",
    links: [
      { label: "About", href: "#about" },
      { label: "Our Story", href: "#our-story" },
      { label: "Gallery", href: "#gallery" },
      { label: "Reviews", href: "#reviews" },
      { label: "FAQ", href: "#faq" },
      { label: "Ethics", href: "#ethical-standards" },
      { label: "Careers", href: "/careers", isPage: true },
      { label: "Partnerships", href: "/partnerships", isPage: true },
    ],
  },
];

const handleNavClick = (href: string) => {
  const el = document.querySelector(href);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function Footer() {
  return (
    <footer className="bg-[#1A0A12] text-white py-16">
      <div className="container">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={LOGO_URL}
                alt="AfroPuppyYoga"
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <div className="font-display font-bold text-lg text-white">AfroPuppyYoga</div>
                <div className="font-body text-xs text-[#F2A0B8] tracking-widest uppercase">Canada's #1 Puppy Yoga</div>
              </div>
            </div>
            <p className="font-body text-white/50 text-sm leading-relaxed mb-6 max-w-xs">
              Where wellness meets culture and puppy love. Serving Hamilton, Kitchener-Waterloo, and Oakville with joy, movement, and adorable puppies.
            </p>
            <a
              href={BOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-2.5 bg-[#F2A0B8] text-[#1A0A12] font-body font-semibold text-sm rounded-full hover:bg-[#D4708A] transition-colors"
            >
              Book a Class
            </a>
          </div>

          {/* Navigation — two grouped columns */}
          <div className="md:col-span-1 grid grid-cols-2 gap-8">
            {navGroups.map((group) => (
              <div key={group.heading}>
                <h4 className="font-display font-bold text-xs text-white/40 uppercase tracking-widest mb-4">{group.heading}</h4>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {(link as any).isPage ? (
                        <a
                          href={link.href}
                          className="font-body text-sm text-white/50 hover:text-[#F2A0B8] transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (link as any).isExternal ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-body text-sm text-[#F2A0B8] font-semibold hover:text-white transition-colors"
                        >
                          {link.label} →
                        </a>
                      ) : (
                        <a
                          href={link.href}
                          onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
                          className="font-body text-sm text-white/50 hover:text-[#F2A0B8] transition-colors"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-bold text-sm text-white/80 uppercase tracking-widest mb-5">Contact</h4>
            <div className="space-y-3">
              <div>
                <div className="font-body text-xs text-white/30 uppercase tracking-wide mb-1">Email</div>
                <a
                  href="mailto:afropuppyyogaofficial@gmail.com"
                  className="font-body text-sm text-white/60 hover:text-[#F2A0B8] transition-colors"
                >
                  afropuppyyogaofficial@gmail.com
                </a>
              </div>
              <div>
                <div className="font-body text-xs text-white/30 uppercase tracking-wide mb-1">Instagram</div>
                <a
                  href="https://www.instagram.com/afropuppyyoga"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm text-white/60 hover:text-[#F2A0B8] transition-colors"
                >
                  @afropuppyyoga
                </a>
              </div>
              <div>
                <div className="font-body text-xs text-white/30 uppercase tracking-wide mb-1">Locations</div>
                <div className="font-body text-sm text-white/60">
                  Hamilton · Kitchener · Oakville
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-white/30">
            © {new Date().getFullYear()} AfroPuppyYoga. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <p className="font-body text-xs text-white/20">
              Made with ❤️ in Canada
            </p>
            <a
              href="/staff"
              className="font-body text-xs text-white/20 hover:text-white/40 transition-colors"
            >
              Staff Portal
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
