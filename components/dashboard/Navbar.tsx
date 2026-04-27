"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, UploadCloud, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/import", label: "Import CSV", icon: UploadCloud },
];

export default function Navbar() {
  const pathname = usePathname();

  // Property-specific pages have their own headers — hide the global nav on them.
  if (pathname === "/the-grove" || pathname.startsWith("/the-grove/")) return null;
  if (pathname === "/towne-east" || pathname.startsWith("/towne-east/")) return null;

  return (
    <nav className="bg-gray-900 text-white shadow-lg">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2 font-semibold text-white hover:text-blue-300 transition-colors">
              <Building2 className="h-5 w-5 text-blue-400" />
              <span className="hidden sm:inline">Aligned Portfolio</span>
              <span className="sm:hidden">Aligned</span>
            </Link>
            <div className="flex items-center gap-1">
              {links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    pathname === href
                      ? "bg-gray-700 text-white"
                      : "text-gray-300 hover:bg-gray-700 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div className="text-xs text-gray-400">
            Sample data loaded — <Link href="/import" className="text-blue-400 hover:underline">upload CSVs</Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
