import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  AudioLines,
  ExternalLink,
  Github,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  CAPABILITIES,
  DATASET_FACTS,
  GITHUB_URL,
  IMPLEMENTATION_LABELS,
  WALKTHROUGH_STEPS,
} from './tour/tourContent';
import {
  AssessmentTransformation,
  CapabilityMark,
  DemoAccessSummary,
  InteractiveAttemptFrame,
  PipelineDiagram,
  WalkthroughFrame,
} from './tour/TourVisuals';

function SectionHeading({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-300">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold leading-tight tracking-[-0.025em] text-white sm:text-4xl">
        {title}
      </h2>
      <p className="mt-4 max-w-2xl text-base leading-7 text-slate-400">{intro}</p>
    </div>
  );
}

function TourHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#080d15]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[86rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/tour"
          className="flex min-h-11 items-center gap-2 rounded-lg text-base font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          aria-label="LusoPronounce product tour"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary-300/25 bg-primary-300/10 text-primary-200">
            <AudioLines size={17} aria-hidden="true" />
          </span>
          <span className="hidden min-[360px]:inline">
            Luso<span className="text-primary-300">Pronounce</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Tour navigation">
          <a
            href="#evidence"
            className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 md:flex"
          >
            Evidence
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
          >
            <Github size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Source</span>
          </a>
          <Link
            to="/demo"
            className="flex min-h-11 items-center gap-2 rounded-lg bg-primary-500 px-3.5 text-sm font-semibold text-white hover:bg-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080d15]"
          >
            <PlayCircle size={16} aria-hidden="true" />
            Try demo
          </Link>
        </nav>
      </div>
    </header>
  );
}

function GuidedWalkthrough() {
  const [activeStep, setActiveStep] = useState(0);
  const stepRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!active) return;
        const index = Number((active.target as HTMLElement).dataset.step);
        if (Number.isFinite(index)) setActiveStep(index);
      },
      { rootMargin: '-28% 0px -48% 0px', threshold: [0.2, 0.45, 0.7] },
    );

    stepRefs.current.forEach((node) => node && observer.observe(node));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="mt-10">
      <div className="mb-5 flex gap-2 overflow-x-auto pb-2 lg:hidden" aria-label="Walkthrough step selector">
        {WALKTHROUGH_STEPS.map((step, index) => (
          <button
            key={step.title}
            type="button"
            onClick={() => setActiveStep(index)}
            aria-pressed={activeStep === index}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 ${
              activeStep === index
                ? 'border-primary-300/40 bg-primary-300/10 text-primary-100'
                : 'border-white/10 text-slate-400'
            }`}
          >
            {index + 1}. {step.kicker}
          </button>
        ))}
      </div>

      <div className="mb-5 border-l-2 border-primary-300 py-1 pl-4 lg:hidden" aria-live="polite">
        <p className="text-sm font-semibold text-white">{WALKTHROUGH_STEPS[activeStep].title}</p>
        <p className="mt-1 text-xs leading-5 text-slate-400">{WALKTHROUGH_STEPS[activeStep].body}</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-12">
        <div className="order-2 hidden lg:order-1 lg:block lg:space-y-4 lg:py-6">
          {WALKTHROUGH_STEPS.map((step, index) => {
            const active = activeStep === index;
            return (
              <div
                key={step.title}
                ref={(node) => {
                  stepRefs.current[index] = node;
                }}
                data-step={index}
                className="scroll-mt-28 lg:min-h-[16rem]"
              >
                <button
                  type="button"
                  onClick={() => setActiveStep(index)}
                  onFocus={() => setActiveStep(index)}
                  aria-pressed={active}
                  className={`group w-full border-l-2 py-4 pl-5 text-left transition-[border-color,opacity] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-4 focus-visible:ring-offset-[#080d15] motion-reduce:transition-none sm:pl-7 ${
                    active ? 'border-primary-300 opacity-100' : 'border-white/10 opacity-60 hover:opacity-90'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                        active
                          ? 'border-primary-300/30 bg-primary-300/10 text-primary-200'
                          : 'border-white/10 bg-white/[0.03] text-slate-500'
                      }`}
                    >
                      <step.icon size={18} aria-hidden="true" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {String(index + 1).padStart(2, '0')} / {String(WALKTHROUGH_STEPS.length).padStart(2, '0')}
                    </span>
                  </span>
                  <span className="mt-4 block text-xl font-semibold leading-snug text-white">{step.title}</span>
                  <span className="mt-2 block text-sm leading-6 text-slate-400">{step.body}</span>
                  <span className="mt-4 inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary-300">
                    {step.evidence}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        <div className="order-1 self-start lg:order-2 lg:sticky lg:top-24">
          <WalkthroughFrame activeStep={activeStep} />
        </div>
      </div>
    </div>
  );
}

export default function TourPage() {
  useEffect(() => {
    document.title = 'LusoPronounce — From scores to PT-BR coaching';
  }, []);

  return (
    <div className="min-h-screen overflow-x-clip bg-[#080d15] text-slate-200 selection:bg-primary-300/25 selection:text-white">
      <TourHeader />
      <main>
        <section className="border-b border-white/10" aria-labelledby="tour-title">
          <div className="mx-auto grid max-w-[86rem] items-center gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.86fr_1.14fr] lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-300">
                Brazilian Portuguese pronunciation practice
              </p>
              <h1
                id="tour-title"
                className="mt-4 text-4xl font-bold leading-[1.07] tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.6rem]"
              >
                From speech scores to Brazilian Portuguese coaching you can act on.
              </h1>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                LusoPronounce combines Azure Speech word-level assessment with a Brazilian Portuguese coaching library, helping a learner move from “this word was weak” to a specific sound worth practicing.
              </p>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500">
                An independent full-stack portfolio build spanning browser audio, an Express assessment service, React feedback, and MongoDB-backed attempt storage.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/demo"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary-500 px-5 text-sm font-semibold text-white hover:bg-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#080d15]"
                >
                  <PlayCircle size={18} aria-hidden="true" />
                  Try the sample demo
                </Link>
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/[0.03] px-5 text-sm font-semibold text-slate-200 hover:border-white/25 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                >
                  <Github size={18} aria-hidden="true" />
                  View source
                  <ExternalLink size={13} aria-hidden="true" />
                </a>
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Explore the guided sample without signing in or granting microphone access.
              </p>

              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/10 pt-5" aria-label="Implementation summary">
                {IMPLEMENTATION_LABELS.map((label) => (
                  <li key={label} className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary-300" aria-hidden="true" />
                    {label}
                  </li>
                ))}
              </ul>
            </div>

            <InteractiveAttemptFrame />
          </div>
        </section>

        <section id="walkthrough" className="mx-auto max-w-[86rem] px-4 py-20 sm:px-6 sm:py-24 lg:px-8" aria-labelledby="walkthrough-title">
          <SectionHeading
            eyebrow="Learner experience"
            title="Hear it. Try it. Understand what to improve."
            intro="The learner moves from an Azure-generated PT-BR reference to a recorded attempt, word-level assessment, and a concrete pronunciation correction."
          />
          <div id="walkthrough-title" className="sr-only">Guided product walkthrough</div>
          <GuidedWalkthrough />
        </section>

        <section className="border-y border-white/10 bg-[#0a101a]" aria-labelledby="transformation-title">
          <div className="mx-auto max-w-[86rem] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <SectionHeading
              eyebrow="What makes it different"
              title="A speech score becomes coaching the learner can use"
              intro="Azure identifies the weak word. LusoPronounce adds the teaching layer: it connects that result to PT-BR sound guidance and turns an opaque score into a focused next attempt."
            />
            <div id="transformation-title" className="sr-only">Assessment to coaching transformation</div>
            <div className="mt-10">
              <AssessmentTransformation />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[86rem] px-4 py-20 sm:px-6 sm:py-24 lg:px-8" aria-labelledby="pipeline-title">
          <SectionHeading
            eyebrow="Full-stack ownership"
            title="From microphone input to progress history"
            intro="The product spans browser audio, an Express service, Azure Speech, a PT-BR coaching layer, and persistence. The pipeline makes those boundaries—and the work owned at each one—clear."
          />
          <div id="pipeline-title" className="sr-only">Technical pipeline stages</div>
          <div className="mt-10">
            <PipelineDiagram />
          </div>
        </section>

        <section id="evidence" className="border-y border-white/10 bg-[#0a101a]" aria-labelledby="evidence-title">
          <div className="mx-auto max-w-[86rem] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <SectionHeading
              eyebrow="Implemented and verifiable"
              title="Working features, backed by the repository"
              intro="The demo is immediately explorable, the authenticated speech path is implemented, and dataset counts are generated directly from the current source data."
            />
            <div id="evidence-title" className="sr-only">Verified evidence and implementation</div>

            <div className="mt-12 grid gap-12 xl:grid-cols-[1.08fr_0.92fr]">
              <div>
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                  <h3 className="text-sm font-semibold text-white">Product capabilities</h3>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Current scope</span>
                </div>
                <ul className="divide-y divide-white/10">
                  {CAPABILITIES.map((capability) => (
                    <li key={capability.title} className="flex gap-3 py-5">
                      <CapabilityMark />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <p className="text-sm font-semibold text-white">{capability.title}</p>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                            {capability.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm leading-6 text-slate-400">{capability.description}</p>
                        <details className="mt-2 text-xs text-slate-500">
                          <summary className="min-h-11 cursor-pointer py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                            Implementation evidence
                          </summary>
                          <p className="pb-1 font-mono text-[10px] leading-5 text-slate-600">{capability.source}</p>
                        </details>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
                  <h3 className="text-sm font-semibold text-white">Dataset depth</h3>
                  <span className="text-[10px] uppercase tracking-[0.14em] text-slate-600">Generated at build time</span>
                </div>
                <dl className="divide-y divide-white/10">
                  {DATASET_FACTS.map((fact) => (
                    <div key={fact.label} className="grid grid-cols-[5.5rem_1fr] gap-4 py-4">
                      <dt className="text-2xl font-bold tabular-nums tracking-tight text-primary-200">
                        {fact.value.toLocaleString()}
                      </dt>
                      <dd>
                        <p className="text-sm font-semibold text-white">{fact.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-500">{fact.description}</p>
                        <details className="mt-1 text-xs text-slate-500">
                          <summary className="min-h-11 cursor-pointer py-3 text-[10px] font-medium uppercase tracking-[0.1em] text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                            Verification
                          </summary>
                          <p className="pb-1 leading-5">{fact.verification}</p>
                          <p className="font-mono text-[10px] leading-5 text-slate-600">{fact.source}</p>
                        </details>
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <div className="mt-10 flex items-start gap-3 border-l-2 border-amber-300/70 bg-amber-300/[0.04] px-5 py-4 text-sm leading-6 text-amber-100">
              <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                Scores shown on this page are illustrative product samples, not learner outcomes. Live assessment requires the authenticated product path and configured Azure credentials.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-white/10 bg-[#0a101a]">
          <div className="mx-auto max-w-[86rem] px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[1fr_0.9fr] lg:items-end">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary-300">Explore the product</p>
                <h2 className="mt-3 max-w-2xl text-3xl font-bold leading-tight tracking-[-0.025em] text-white sm:text-4xl">
                  Try the coaching experience. Then inspect the system behind it.
                </h2>
                <p className="mt-4 max-w-xl text-base leading-7 text-slate-400">
                  The public demo makes the learner experience immediately reviewable. The source shows how browser audio, Azure assessment, coaching, and progress tracking fit together.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link
                    to="/demo"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-primary-500 px-5 text-sm font-semibold text-white hover:bg-primary-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-200 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a101a]"
                  >
                    <PlayCircle size={18} aria-hidden="true" />
                    Open the sample demo
                    <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                  <a
                    href={GITHUB_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-white/15 px-5 text-sm font-semibold text-slate-200 hover:border-white/25 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
                  >
                    <Github size={18} aria-hidden="true" />
                    Inspect source
                  </a>
                </div>
              </div>
              <DemoAccessSummary />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-[86rem] flex-col gap-2 px-4 py-8 text-xs leading-5 text-slate-600 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <p>LusoPronounce · independent full-stack PT-BR pronunciation project</p>
          <p>Tour samples are explicitly illustrative. Dataset facts are generated from repository sources.</p>
        </div>
      </footer>
    </div>
  );
}
