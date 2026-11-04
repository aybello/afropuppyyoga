import { BOOK_URL, LOGO_URL  } from "@/const";
import { handleHomeSectionClick, homeSectionHref } from "./homeSectionNavigation";
/* ============================================================
   Footer — Minimal, warm, brand-consistent
   ============================================================ */

const navGroups = [
  {
    heading: "Locations",
    links: [
      { label: "Kitchener", href: "/puppy-yoga-kitchener", isPage: true },
      { label: "Hamilton", href: "/puppy-yoga-hamilton", isPage: true },
      { label: "Oakville", href: "/puppy-yoga-oakville", isPage: true },
      { label: "Corporate Events", href: "/corporate-puppy-yoga", isPage: true },
    ],
  },
  {
    heading: "Classes & Events",
    links: [
      { label: "Book a Class", href: BOOK_URL, isExternal: true },
      { label: "Experience", href: "#experience" },
      { label: "Memberships", href: "#memberships" },
      { label: "Private Events", href: "#private-events" },
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
      { label: "Ethical Standards", href: "/ethics", isPage: true },
      { label: "Careers", href: "/careers", isPage: true },
      { label: "Partnerships", href: "/partnerships", isPage: true },
      { label: "Private Event Quote", href: "/private-events/quote", isPage: true },
      { label: "Submit Invoice", href: "/submit-invoice", isPage: true },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="apy-public-footer bg-ivory text-espresso border-t border-border py-12 md:py-16">
      <div className="container">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 lg:gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img
                src={LOGO_URL}
                alt="AfroPuppyYoga"
                className="w-14 h-14 object-contain"
              />
              <div>
                <div className="font-display font-medium text-2xl text-espresso">AfroPuppyYoga</div>
                <div className="font-body text-xs text-brand-link tracking-widest uppercase">Ontario's #1 Puppy Yoga</div>
              </div>
            </div>
            <p className="font-body text-muted-foreground text-sm leading-relaxed mb-6 max-w-xs">
              Where wellness meets culture and puppy love. Serving Hamilton, Kitchener, and Oakville with joy, movement, and adorable puppies.
            </p>
            <a
              href={BOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="apy-primary-action"
            >
              Book a Class
            </a>
          </div>

          {/* Navigation — three grouped columns */}
          <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-6 sm:gap-8">
            {navGroups.map((group) => (
              <div key={group.heading}>
                <h4 className="font-body font-semibold text-xs text-brand-link uppercase tracking-[0.12em] mb-4">{group.heading}</h4>
                <ul className="space-y-2.5">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      {(link as any).isPage ? (
                        <a
                          href={link.href}
                          className="font-body text-sm text-muted-foreground hover:text-brand-link hover:underline underline-offset-4 transition-colors"
                        >
                          {link.label}
                        </a>
                      ) : (link as any).isExternal ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-body text-sm text-brand-link font-semibold hover:underline underline-offset-4 transition-colors"
                        >
                          {link.label} →
                        </a>
                      ) : (
                        <a
                          href={homeSectionHref(link.href)}
                          onClick={(e) => handleHomeSectionClick(e, link.href)}
                          className="font-body text-sm text-muted-foreground hover:text-brand-link hover:underline underline-offset-4 transition-colors"
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
            <h4 className="font-body font-semibold text-xs text-brand-link uppercase tracking-[0.12em] mb-5">Contact</h4>
            <div className="space-y-3">
              <div>
                <div className="font-body text-xs text-muted-foreground uppercase tracking-wide mb-1">Email</div>
                <a
                  href="mailto:afropuppyyoga@gmail.com"
                  className="font-body text-sm text-muted-foreground hover:text-brand-link hover:underline underline-offset-4 break-words transition-colors"
                >
                  afropuppyyoga@gmail.com
                </a>
              </div>
              <div>
                <div className="font-body text-xs text-muted-foreground uppercase tracking-wide mb-1">Instagram</div>
                <a
                  href="https://www.instagram.com/afropuppyyoga"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-sm text-muted-foreground hover:text-brand-link hover:underline underline-offset-4 break-words transition-colors"
                >
                  @afropuppyyoga
                </a>
              </div>
              <div>
                <div className="font-body text-xs text-muted-foreground uppercase tracking-wide mb-1">Locations</div>
                <div className="font-body text-sm text-muted-foreground">
                  Hamilton · Kitchener · Oakville
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-body text-xs text-muted-foreground">
            © {new Date().getFullYear()} AfroPuppyYoga. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
            <p className="font-body text-xs text-muted-foreground">
              Made with ❤️ in Canada
            </p>
            <a
              href="/staff"
              className="font-body text-xs text-muted-foreground hover:text-brand-link hover:underline underline-offset-4 transition-colors"
            >
              Staff Portal
            </a>
            <a href="/privacy" className="font-body text-xs text-muted-foreground hover:text-brand-link hover:underline underline-offset-4 transition-colors">Privacy</a>
            <a href="/terms" className="font-body text-xs text-muted-foreground hover:text-brand-link hover:underline underline-offset-4 transition-colors">Terms</a>
            <a href="/refund-policy" className="font-body text-xs text-muted-foreground hover:text-brand-link hover:underline underline-offset-4 transition-colors">Refund Policy</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
