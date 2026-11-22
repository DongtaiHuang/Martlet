import Link from "next/link";
import { ArrowUpRight, Bird } from "lucide-react";

const sections = [
  {
    id: "discover",
    title: "Discover Martlet",
    links: [
      { href: "/meetups", label: "Meetup Feed" },
      { href: "/explore", label: "Explore Map" },
      { href: "/landmarks", label: "Campus Landmarks" },
      { href: "/progress", label: "Your Progress" },
    ],
  },
  {
    id: "involved",
    title: "Get Involved",
    links: [
      { href: "/meetups/new", label: "Create a Meetup" },
      { href: "/profile", label: "Student Profile" },
      { href: "/board", label: "Campus Board" },
      { href: "/achievements", label: "Achievements" },
      { href: "/play", label: "Play Martlet" },
    ],
  },
];

const layout = "mx-auto max-w-6xl px-6 sm:px-8";
const linkStyle = "inline-flex min-h-11 w-fit items-center gap-2 rounded-sm text-sm font-medium text-neutral-200 underline-offset-4 hover:text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white";

export function MartletFooter() {
  return (
    <footer className="martlet-footer bg-[#1c1c1c] text-white">
      <div className={`${layout} grid gap-x-10 gap-y-8 py-10 md:grid-cols-2 lg:grid-cols-3 lg:py-12`}>
        {sections.map(({ id, title, links }) => (
          <nav key={id} aria-labelledby={`footer-${id}`}>
            <h2 id={`footer-${id}`} className="mb-2 border-b border-neutral-700 pb-3 text-lg font-bold">{title}</h2>
            <ul>
              {links.map(({ href, label }) => (
                <li key={href}><Link href={href} className={linkStyle}>{label}</Link></li>
              ))}
            </ul>
          </nav>
        ))}
        <section aria-labelledby="footer-community">
          <h2 id="footer-community" className="mb-3 border-b border-neutral-700 pb-3 text-lg font-bold">Campus &amp; Community</h2>
          <p className="max-w-xs text-sm leading-6 text-neutral-300">
            Meet over coffee, find a study group, and get to know the people and places that make up campus.
          </p>
          <Link href="/meetups#trend-heading" className={linkStyle}>Community Trends</Link>
          <div>
            <a href="https://www.mcgill.ca/" className={linkStyle}>
              McGill University <ArrowUpRight size={14} aria-hidden="true" />
            </a>
          </div>
        </section>
      </div>
      <div className="border-t border-neutral-800 bg-[#090909]">
        {/* Clear the floating Martlet's bottom lane when the page is fully scrolled. */}
        <div className={`${layout} pb-24 pt-8`}>
          <div className="grid items-start gap-5 md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex items-center gap-3 text-xl font-bold tracking-tight">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand text-on-brand"><Bird size={22} aria-hidden="true" /></span>
                McGill Martlet
              </div>
              <p className="mt-3 text-sm font-semibold">Find your flock. Make campus yours.</p>
              <p className="mt-1 max-w-md text-sm leading-6 text-neutral-300">
                A student-built platform connecting people through meetups, shared discoveries, and campus experiences.
              </p>
            </div>
            <nav aria-label="Project and account links" className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <Link href="/notifications" className={linkStyle}>Notifications</Link>
              <a href="https://github.com/DongtaiHuang/Martlet" className={`${linkStyle} border border-neutral-700 px-3 hover:border-neutral-400`}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .75a11.25 11.25 0 0 0-3.56 21.92c.56.1.77-.24.77-.54v-2.1c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.39-1.22.71-1.5-2.5-.28-5.13-1.25-5.13-5.56 0-1.23.44-2.23 1.16-3.02-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.09 1.15a10.75 10.75 0 0 1 5.62 0c2.14-1.45 3.09-1.15 3.09-1.15.61 1.55.23 2.7.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.32-2.63 5.27-5.14 5.55.4.35.76 1.03.76 2.08v3.11c0 .3.2.65.77.54A11.25 11.25 0 0 0 12 .75Z" />
                </svg>
                Project on GitHub <ArrowUpRight size={14} aria-hidden="true" />
              </a>
            </nav>
          </div>
          <div className="mt-6 border-t border-neutral-800 pt-4 text-xs leading-5 text-neutral-300">
            <div className="flex flex-wrap justify-between gap-x-6 gap-y-1">
              <p>Built by students, for students in Montréal.</p>
              <p>© {new Date().getFullYear()} McGill Martlet.</p>
            </div>
            <p className="mt-2">McGill Martlet is an independent student project and is not affiliated with or endorsed by McGill University.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
