"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("demo@klic.local");
  const [password, setPassword] = useState("demo1234");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function readJson(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    const trimmed = text.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith("<") || trimmed.startsWith("<!")) {
      throw new Error(
        `서버가 HTML을 반환함 (HTTP ${res.status}). API 서버 기동 여부·포트 확인 필요.`,
      );
    }
    try {
      return JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      throw new Error(`JSON 파싱 실패 (HTTP ${res.status}): ${trimmed.slice(0, 120)}`);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (mode === "register") {
        const reg = await fetch("/api/v1/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password, name }),
        });
        const regJson = await readJson(reg);
        if (!reg.ok) throw new Error(String(regJson.error || "회원가입 실패"));
      }
      const res = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await readJson(res);
      if (!res.ok) throw new Error(String(json.error || "로그인 실패"));
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
      <div className="mb-6 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          KLIC RADIUS
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          {mode === "login" ? "로그인" : "회원가입"}
        </h1>
        <p className="text-sm text-muted-foreground">
          공공 웹 표준 진단 계정으로 {mode === "login" ? "로그인" : "가입"}하세요.
        </p>
      </div>

      <form className="space-y-4" onSubmit={onSubmit}>
        {mode === "register" && (
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">이름</span>
            <input
              className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary focus:ring-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
        )}
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">이메일</span>
          <input
            type="email"
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary focus:ring-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </label>
        <label className="block space-y-1.5 text-sm">
          <span className="font-medium">비밀번호</span>
          <input
            type="password"
            required
            minLength={6}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 outline-none ring-primary focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}

        <Button type="submit" className="h-11 w-full" disabled={loading}>
          {loading
            ? mode === "login"
              ? "로그인 중..."
              : "가입 중..."
            : mode === "login"
              ? "로그인"
              : "회원가입 후 로그인"}
        </Button>
      </form>

      <div className="mt-5 space-y-2 text-center text-sm text-muted-foreground">
        <button
          type="button"
          className="text-primary underline-offset-2 hover:underline"
          onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "새 계정 만들기" : "이미 계정이 있나요? 로그인"}
        </button>
        <p className="text-xs">
          시드 계정: <code className="rounded bg-muted px-1">demo@klic.local</code> /{" "}
          <code className="rounded bg-muted px-1">demo1234</code>
        </p>
        <Link href="/" className="block text-xs hover:text-foreground">
          ← 랜딩으로
        </Link>
      </div>
    </div>
  );
}
