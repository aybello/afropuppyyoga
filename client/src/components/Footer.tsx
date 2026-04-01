/* ============================================================
   Footer — Minimal, warm, brand-consistent
   ============================================================ */
const LOGO_URL = "https://files.manuscdn.com/user_upload_by_module/session_file/310519663446228701/pFRlGBKuUoljEWjn.png";
const BOOK_URL = "https://www.eventbrite.ca/o/afropuppyyoga-84060688843";

const navLinks = [
  { label: "Home", href: "#home" },
  { label: "About", href: "#about" },
  { label: "Experience", href: "#experience" },
  { label: "Private Events", href: "#private-events" },
  { label: "Gallery", href: "#gallery" },
  { label: "Reviews", href: "#reviews" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

const handleNavClick = (href: string) => {
  const el = document.querySelector(href);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
};

export default function Footer() {
  return (
    <footer className="bg-[#1E1208] text-white py-16">
      <div className="container">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
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
                <div className="font-body text-xs text-[#F4A800] tracking-widest uppercase">Canada's #1 Puppy Yoga</div>
              </div>
            </div>
            <p className="font-body text-white/50 text-sm leading-relaxed mb-6 max-w-xs">
              Where wellness meets culture and puppy love. Serving the Greater Toronto Area with joy, movement, and adorable puppies.
            </p>
            <a
              href={BOOK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-6 py-2.5 bg-[#F4A800] text-[#1E1208] font-body font-semibold text-sm rounded-full hover:bg-[#e09800] transition-colors"
            >
              Book a Class
            </a>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-display font-bold text-sm text-white/80 uppercase tracking-widest mb-5">Navigation</h4>
            <ul className="space-y-2.5">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    onClick={(e) => { e.preventDefault(); handleNavClick(link.href); }}
                    className="font-body text-sm text-white/50 hover:text-[#F4A800] transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-bold text-sm text-white/80 uppercase tracking-widest mb-5">Contact</h4>
            <div className="space-y-3">
              <div>
                <div className="font-body text-xs text-white/30 uppercase tracking-wide mb-1">Email</div>
                <a
                  href="mailto:afropuppyyogaofficial@gmail.com"
                  className="font-body text-sm text-white/60 hover:text-[#F4A800] transition-colors"
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
                  className="font-body text-sm text-white/60 hover:text-[#F4A800] transition-colors"
                >
                  @afropuppyyoga
                </a>
              </div>
              <div>
                <div className="font-body text-xs text-white/30 uppercase tracking-wide mb-1">Locations</div>
                <div className="font-body text-sm text-white/60">
                  Mississauga · Hamilton · Kitchener
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
          <p className="font-body text-xs text-white/20">
            Made with ❤️ in Canada
          </p>
        </div>
      </div>
    </footer>
  );
}
