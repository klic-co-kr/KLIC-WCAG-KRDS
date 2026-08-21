"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/brand";

const NAV = [
  { href: "#features", label: "진단 범위" },
  { href: "#report", label: "리포트" },
  { href: "#process", label: "절차" },
  { href: "#faq", label: "FAQ" },
] as const;

export function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <Image
            src="/brand/klic-krds-mark.svg"
            alt={BRAND.productName}
            width={32}
            height={32}
            className="h-8 w-8 object-contain"
            priority
          />
          <span className="text-base font-semibold tracking-tight text-foreground">
            {BRAND.productName}
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex" aria-label="주요 메뉴">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" size="lg" className="h-9 px-3" render={<Link href="/login" />}>
            로그인
          </Button>
          <Button size="lg" className="h-9 px-4" render={<Link href="/dashboard" />}>
            진단 시작
          </Button>
        </div>

        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-md border border-border md:hidden"
          aria-expanded={open}
          aria-label={open ? "메뉴 닫기" : "메뉴 열기"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>

      <div className={cn("border-t border-border bg-background md:hidden", open ? "block" : "hidden")}>
        <nav className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3" aria-label="모바일 메뉴">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-muted"
              onClick={() => setOpen(false)}
            >
              {item.label}
            </a>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
            <Button variant="outline" className="h-10 w-full" render={<Link href="/login" />}>
              로그인
            </Button>
            <Button className="h-10 w-full" render={<Link href="/dashboard" />}>
              진단 시작
            </Button>
          </div>
        </nav>
      </div>
    </header>
  );
}
