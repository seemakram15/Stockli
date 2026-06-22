import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/shell/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/">
          <Logo />
        </Link>
        <ThemeToggle />
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-10">
        {children}
      </main>
    </div>
  );
}
