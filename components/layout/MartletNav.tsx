import Link from "next/link";

const links = [
  { href: "/meetups", label: "Meet" },
  { href: "/explore", label: "Explore" },
  { href: "/meetups/new", label: "Create" },
  { href: "/profile", label: "Profile" },
];

export function MartletNav() {
  return (
    <nav aria-label="Martlet navigation" className="flex flex-wrap items-center justify-between gap-3 border-b border-red-100 bg-white px-5 py-4 text-neutral-900">
      <Link href="/meetups" className="font-bold tracking-tight text-red-700">🐦 McGill Martlet</Link>
      <div className="flex flex-wrap gap-2 text-sm">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="rounded-lg px-3 py-2 font-medium hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700">
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
