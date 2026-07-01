import { Link } from 'react-router-dom';
import {
  Mic,
  Volume2,
  BarChart3,
  Target,
  Repeat,
  Sparkles,
  PlayCircle,
  Headphones,
  ListChecks,
  LineChart,
  Cpu,
} from 'lucide-react';
import PublicPageShell from '@/components/demo/PublicPageShell';
import PhraseScoreOverview from '@/components/pronunciation/PhraseScoreOverview';
import PhonemeChip from '@/components/pronunciation/PhonemeChip';
import { DEMO_ITEMS } from '@/lib/demo/demoData';

const showcase =
  DEMO_ITEMS.find((d) => d.id === 'gemini_family_friends_001') ?? DEMO_ITEMS[0];
// Highlight the trickiest word in the showcase sentence for the phoneme breakdown.
const showcaseWord = [...showcase.words].sort((a, b) => a.score - b.score)[0];

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-10 border-t border-gray-200/70 dark:border-gray-700 first:border-t-0">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-600 dark:text-primary-400">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function StepCard({
  icon: Icon,
  step,
  title,
  body,
}: {
  icon: typeof Mic;
  step: number;
  title: string;
  body: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-5">
      <div className="flex items-center gap-3 mb-2">
        <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
          <Icon size={18} />
        </span>
        <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">STEP {step}</span>
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{body}</p>
    </div>
  );
}

export default function TourPage() {
  return (
    <PublicPageShell>
      {/* Hero */}
      <div className="bg-gradient-to-b from-primary-50 to-transparent dark:from-primary-900/20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-14 pb-12 text-center">
          <span className="chip-soft">🇧🇷 Brazilian Portuguese pronunciation trainer</span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">
            Sound more like a native — <span className="text-primary-600 dark:text-primary-400">one phoneme at a time</span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-gray-600 dark:text-gray-300">
            LusoPronounce helps English speakers improve their Brazilian Portuguese pronunciation with
            instant, word-by-word and phoneme-level scoring — plus coaching on exactly what to fix next.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/demo" className="btn btn-primary btn-lg inline-flex items-center gap-2">
              <PlayCircle size={20} />
              Try the interactive demo
            </Link>
            <Link to="/auth" className="btn btn-secondary btn-lg">
              Sign in to the full app
            </Link>
          </div>
          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            The demo needs no account, microphone, or API keys.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 pb-16">
        {/* 1. What it does */}
        <Section eyebrow="Overview" title="What LusoPronounce does">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-5">
              <Target className="text-primary-500 mb-2" size={22} />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Targeted feedback</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Helps English speakers improve Brazilian Portuguese pronunciation with specific,
                actionable notes.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-5">
              <BarChart3 className="text-primary-500 mb-2" size={22} />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Real scoring</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Gives pronunciation scores for accuracy, fluency, completeness, and prosody — down to
                individual sounds.
              </p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-5">
              <LineChart className="text-primary-500 mb-2" size={22} />
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Measurable progress</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Tracks attempts over time so improvement on tricky sounds is visible, not guesswork.
              </p>
            </div>
          </div>
        </Section>

        {/* 2. Practice flow */}
        <Section eyebrow="How it works" title="The practice flow">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StepCard icon={ListChecks} step={1} title="Choose a word or phrase" body="Pick from curated PT-BR content graded by difficulty." />
            <StepCard icon={Volume2} step={2} title="Listen to native-style TTS" body="Hear a natural reference pronunciation before you try." />
            <StepCard icon={Mic} step={3} title="Record yourself" body="Record in the browser — audio is converted to WAV for assessment." />
            <StepCard icon={Headphones} step={4} title="Get an assessment" body="Azure Speech scores your attempt in seconds." />
            <StepCard icon={Sparkles} step={5} title="Review phoneme feedback" body="See which individual sounds were on target and which slipped." />
            <StepCard icon={Repeat} step={6} title="Retry and compare" body="Practice again and watch your scores climb over time." />
          </div>
        </Section>

        {/* 3. Pronunciation feedback */}
        <Section eyebrow="Feedback" title="Pronunciation feedback you can act on">
          <div className="grid gap-6 lg:grid-cols-2 items-start">
            <div>
              <p className="text-gray-600 dark:text-gray-300">
                Every attempt returns an overall score plus sub-scores for <strong>accuracy</strong>,{' '}
                <strong>fluency</strong>, <strong>completeness</strong>, and <strong>prosody</strong>.
                Then it drills into the sounds that matter most in PT-BR — nasal vowels, <code>ão</code>,{' '}
                <code>lh</code>, the tapped and guttural <code>r</code>, and reduced unstressed vowels.
              </p>
              <div className="mt-4">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Phoneme-level breakdown (sample for “{showcaseWord.text}” in “{showcase.text}”):
                </p>
                <div className="flex flex-wrap gap-2">
                  {showcaseWord.phonemes.map((p, i) => (
                    <PhonemeChip key={`${p.symbol}-${i}`} symbol={p.symbol} score={p.score} />
                  ))}
                </div>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  Hover a chip for its IPA symbol, English/Portuguese examples, and a teaching tip.
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 text-right">Sample score card</p>
              <PhraseScoreOverview attemptScore={showcase.attempt} />
            </div>
          </div>
        </Section>

        {/* 4. Progress tracking */}
        <Section eyebrow="Progress" title="Progress tracking that keeps you honest">
          <div className="grid gap-4 sm:grid-cols-2">
            <ul className="space-y-3">
              {[
                'Attempt history for every word and phrase you practice.',
                'Trendlines and sparklines that show score changes over time.',
                'Weak-phoneme analysis that surfaces recurring problem sounds.',
                'Filter by word, phrase, sound, or difficulty to focus your practice.',
              ].map((t) => (
                <li key={t} className="flex items-start gap-2 text-gray-700 dark:text-gray-300">
                  <BarChart3 size={18} className="text-primary-500 mt-0.5 flex-shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The <Link to="/demo" className="text-primary-600 dark:text-primary-400 font-medium hover:underline">interactive demo</Link>{' '}
                lets you watch a sample score climb across attempts for each word — the same view the
                full app builds from your real recordings.
              </p>
            </div>
          </div>
        </Section>

        {/* 5. Why it's useful */}
        <Section eyebrow="Why it helps" title="Why it beats generic language apps">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Focused improvement', 'Targets pronunciation specifically, instead of burying it inside vocabulary drills.'],
              ['Actionable, not vague', 'Tells you which sound to fix and how — not just “try again”.'],
              ['Pinpoints the problem', 'Phoneme-level scoring shows exactly where a word goes wrong.'],
            ].map(([title, body]) => (
              <div key={title} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-5">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{body}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* 6. Technical highlights */}
        <Section eyebrow="Under the hood" title="Technical highlights">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/70 dark:border-gray-700 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Cpu className="text-primary-500" size={20} />
              <span className="font-semibold text-gray-900 dark:text-gray-100">Built with a production-minded stack</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Azure Speech Pronunciation Assessment', 'Word- and phoneme-level scoring from Microsoft Cognitive Services.'],
                ['React 19 + TypeScript frontend', 'Vite build, Tailwind styling, React Router, strict typing.'],
                ['Audio recording + WAV processing', 'Browser MediaRecorder captures audio; ffmpeg transcodes to 16 kHz mono WAV.'],
                ['Native-style TTS playback', 'Reference pronunciation for every item.'],
                ['Phoneme-level feedback engine', 'Maps Azure output to a curated PT-BR phoneme knowledge base.'],
                ['State & history tracking', 'Express + MongoDB backend with JWT auth; progress persisted per user.'],
              ].map(([title, body]) => (
                <div key={title} className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary-500 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* 7. Try the demo */}
        <Section eyebrow="Your turn" title="Try the demo">
          <div className="rounded-2xl bg-primary-600 dark:bg-primary-700 text-white p-8 text-center">
            <h3 className="text-2xl font-bold">See a scored attempt for yourself</h3>
            <p className="mt-2 text-primary-50 max-w-xl mx-auto">
              Explore an interactive, self-contained demo with sample scores, phoneme feedback, and
              progress trends. No account, microphone, or Azure credentials required.
            </p>
            <Link
              to="/demo"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-white text-primary-700 font-semibold hover:bg-primary-50 transition-colors"
            >
              <PlayCircle size={20} />
              Launch the demo
            </Link>
          </div>
        </Section>
      </div>
    </PublicPageShell>
  );
}
