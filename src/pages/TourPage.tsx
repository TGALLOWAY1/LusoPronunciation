import { Link } from 'react-router-dom';
import { PlayCircle, Github, LogIn, ArrowRight, CheckCircle2 } from 'lucide-react';
import { DEMO_ITEMS } from '@/lib/demo/demoData';
import {
  HERO_META,
  LOOP_STEPS,
  BUILT_CARDS,
  CHALLENGES,
  STAT_TILES,
  EVIDENCE_CHIPS,
  ARCH_STAGES,
} from './tour/tourContent';
import { ScoredAttemptCard, RawVsCoached, SampleProgress } from './tour/TourVisuals';

const GITHUB_URL = 'https://github.com/TGALLOWAY1/LusoPronunciation';

/** Section wrapper with an eyebrow + heading, consistent rhythm. */
function Section({
  id,
  eyebrow,
  title,
  intro,
  children,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-400">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">{title}</h2>
      {intro && <p className="mt-3 max-w-2xl text-sm text-slate-400 sm:text-base">{intro}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

export default function TourPage() {
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-200">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#070b14]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/tour" className="flex items-center gap-2 text-lg font-bold">
            <span>🇧🇷</span>
            <span className="text-slate-100">
              Luso<span className="text-primary-400">Pronounce</span>
            </span>
          </Link>
          <nav className="flex items-center gap-1.5 sm:gap-3">
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5 sm:inline-flex"
            >
              <Github size={16} />
              GitHub
            </a>
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-white/5"
            >
              <LogIn size={16} />
              <span className="hidden sm:inline">Sign in</span>
            </Link>
            <Link
              to="/demo"
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
            >
              <PlayCircle size={16} />
              Try Demo
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <div className="relative overflow-hidden border-b border-white/10">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(60rem 40rem at 85% -10%, rgba(45,134,89,0.22), transparent 60%), radial-gradient(50rem 30rem at 0% 100%, rgba(45,134,89,0.10), transparent 60%)',
          }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary-400/30 bg-primary-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary-300">
              Full-stack speech AI · portfolio project
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-50 sm:text-5xl">
              Brazilian Portuguese pronunciation coaching —{' '}
              <span className="text-primary-400">turning raw speech scores into feedback you can act on</span>
            </h1>
            <p className="mt-5 max-w-xl text-base text-slate-300 sm:text-lg">
              An end-to-end app that evaluates Brazilian Portuguese pronunciation with Azure Speech and
              translates the raw output into clear, phoneme-level coaching. Designed, built, and shipped
              as a single full-stack project.
            </p>

            {/* Meta chips */}
            <dl className="mt-7 grid grid-cols-2 gap-3 sm:max-w-lg">
              {HERO_META.map((m) => (
                <div key={m.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5">
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{m.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-slate-200">{m.value}</dd>
                </div>
              ))}
            </dl>

            {/* CTAs */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link
                to="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-500 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-primary-600"
              >
                <PlayCircle size={20} />
                Try the interactive demo
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-5 py-3 text-base font-semibold text-slate-200 transition-colors hover:bg-white/[0.07]"
              >
                <Github size={20} />
                View source
              </a>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              The demo needs no account, microphone, or API keys.
            </p>
          </div>

          <div className="lg:pl-4">
            <ScoredAttemptCard />
          </div>
        </div>
      </div>

      {/* Product in 30 seconds */}
      <Section
        eyebrow="Product in 30 seconds"
        title="Listen, record, score, improve"
        intro="The whole learner loop — hear a native reference, record yourself, get scored by Azure Speech, and drill the exact sounds you missed."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LOOP_STEPS.map((s, i) => (
            <div
              key={s.title}
              className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-5"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/15 text-primary-300 ring-1 ring-inset ring-primary-400/20">
                  <s.icon size={19} />
                </span>
                <span className="text-xs font-semibold text-slate-500">STEP {i + 1}</span>
              </div>
              <h3 className="mt-3 font-semibold text-slate-100">{s.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{s.body}</p>
              {i < LOOP_STEPS.length - 1 && (
                <ArrowRight
                  size={16}
                  className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-slate-600 lg:block"
                />
              )}
            </div>
          ))}
        </div>

        {/* Compact real-content preview */}
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5">
          <p className="mb-3 text-xs font-medium text-slate-400">
            Real phrases from the practice set, graded by CEFR level:
          </p>
          <div className="flex flex-wrap gap-2">
            {DEMO_ITEMS.map((d) => (
              <span
                key={d.id}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1.5 text-sm text-slate-200"
              >
                {d.text}
                {d.cefr && (
                  <span className="rounded bg-primary-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary-300">
                    {d.cefr}
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      </Section>

      {/* Key differentiator */}
      <div className="border-y border-white/10 bg-white/[0.015]">
        <Section
          eyebrow="The key differentiator"
          title="Raw pronunciation signals → coaching a learner can use"
          intro="The value isn’t calling a speech API — it’s the mapping layer that turns opaque phoneme scores and error codes into a specific, teachable fix."
        >
          <RawVsCoached />
        </Section>
      </div>

      {/* What I built */}
      <Section
        eyebrow="What I built"
        title="End-to-end ownership"
        intro="Frontend, backend, speech integration, and the coaching logic in between — designed and implemented as one project."
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {BUILT_CARDS.map((c) => (
            <div key={c.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-500/15 text-primary-300 ring-1 ring-inset ring-primary-400/20">
                <c.icon size={20} />
              </span>
              <h3 className="mt-4 font-semibold text-slate-100">{c.title}</h3>
              <p className="mt-2 text-sm text-slate-400">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Engineering challenges */}
      <div className="border-y border-white/10 bg-white/[0.015]">
        <Section
          eyebrow="Engineering challenges"
          title="Technical decisions worth defending"
          intro="A handful of problems that shaped the architecture and the learner experience."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {CHALLENGES.map((c) => (
              <div key={c.title} className="flex gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-500/15 text-primary-300 ring-1 ring-inset ring-primary-400/20">
                  <c.icon size={20} />
                </span>
                <div>
                  <h3 className="font-semibold text-slate-100">{c.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-400">{c.body}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Evidence & results */}
      <Section
        eyebrow="Evidence & results"
        title="Real, and grounded in the codebase"
        intro="Verified capabilities and dataset facts — no invented metrics."
      >
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-4 lg:col-span-2">
            {STAT_TILES.map((s) => (
              <div key={s.label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="text-3xl font-bold text-primary-300">{s.value}</div>
                <div className="mt-1 text-sm font-medium text-slate-200">{s.label}</div>
                <div className="mt-1 font-mono text-[10px] text-slate-500">{s.note}</div>
              </div>
            ))}
          </div>
          {/* Sample progress */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <SampleProgress />
          </div>
        </div>

        {/* Qualitative capability chips */}
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {EVIDENCE_CHIPS.map((chip) => (
            <div
              key={chip}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-sm text-slate-300"
            >
              <CheckCircle2 size={16} className="shrink-0 text-primary-400" />
              {chip}
            </div>
          ))}
        </div>
      </Section>

      {/* Technical architecture */}
      <div className="border-y border-white/10 bg-white/[0.015]">
        <Section
          eyebrow="Technical architecture"
          title="From microphone to MongoDB"
          intro="The pronunciation pipeline, end to end."
        >
          <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
            {ARCH_STAGES.map((s, i) => (
              <div key={s.title} className="flex items-center gap-3 lg:flex-1 lg:flex-col lg:gap-0">
                <div className="flex w-full flex-1 flex-col items-center rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-4 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/15 text-primary-300 ring-1 ring-inset ring-primary-400/20">
                    <s.icon size={19} />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-slate-100">{s.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{s.sub}</p>
                </div>
                {i < ARCH_STAGES.length - 1 && (
                  <ArrowRight
                    size={18}
                    className="shrink-0 rotate-90 text-slate-600 lg:rotate-0"
                  />
                )}
              </div>
            ))}
          </div>
        </Section>
      </div>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-primary-400/30 bg-gradient-to-br from-primary-600 to-primary-700 p-8 sm:p-12">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{ background: 'radial-gradient(30rem 20rem at 80% 0%, rgba(255,255,255,0.18), transparent 60%)' }}
          />
          <div className="relative flex flex-col items-start justify-between gap-6 lg:flex-row lg:items-center">
            <div className="max-w-xl">
              <h2 className="text-2xl font-bold text-white sm:text-3xl">Explore the working demo</h2>
              <p className="mt-2 text-primary-50">
                Walk the full record → score → coaching flow with real phrases and sample scoring. It’s
                self-contained — no account, microphone, or setup required. Sign in to the full app for
                live recording and saved progress.
              </p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row lg:w-auto lg:flex-col xl:flex-row">
              <Link
                to="/demo"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-base font-semibold text-primary-700 transition-colors hover:bg-primary-50"
              >
                <PlayCircle size={20} />
                Launch the demo
              </Link>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/40 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-white/10"
              >
                <Github size={20} />
                View source
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10">
        <div className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-slate-500 sm:px-6">
          <p>
            LusoPronounce — a full-stack Brazilian Portuguese speech-AI project built with React,
            TypeScript, Azure Speech, and MongoDB.
          </p>
          <p className="mt-1">Tour and demo use clearly-labelled sample data. No account or microphone required.</p>
        </div>
      </footer>
    </div>
  );
}
