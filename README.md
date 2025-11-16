**LusoPronounce** 
A Personal Pronunciation Trainer For Brazilian Portuguese**

LusoPronounce is a lightweight, offline-friendly Portuguese pronunciation training app designed for a single user (me). It generates sentences, words, and pronunciation tips; stores local scoring history; and provides a simple UI for practicing speaking, getting feedback, and improving over time through spaced repetition.
This app focuses on practical, real-world Portuguese (Brazilian Portuguese optional), not academic linguistics — and is optimized for daily self-driven practice.

📌 Why This Project Exists
I want to become conversationally fluent in Portuguese with a tool optimized specifically for the pronunciation problems English speakers face. Generic apps don't give real feedback — LusoPronounce does.


✨ Features (MVP)
🎤 Pronunciation Practice
Listen to native-quality audio for each sentence or word
Record your own attempt
Automatically score pronunciation (1–5 scale)
Show phoneme-level tips for improvement

📚 Content
Static, pre-generated dataset including:
Sentences (English + Portuguese)
Vocabulary words
Common mispronunciations for English speakers
Pronunciation tips
Male & female audio variations (optional)

🎯 Difficulty System
Each sentence/word is tagged with:
Difficulty 1–5
Category (food, travel, family/friends, etc.)
Phoneme targets (e.g., “ão”, “lh”, “rr”)

📈 Progress Tracking
Local progress log
Visual progress bar for each category
Spaced repetition algorithm automatically surfaces weak items\

🗂️ Category-Based Learning (V2 – Planned)
Choose themed categories (food, travel, family, friends)
Multiple-choice testing mode
Progress per category (XP + mastery %)
Adaptive review based on past mistakes

🧱 Architecture Overview
Front End
Lightweight web UI
Sentence review view
Word drill view
Progress dashboard
Category selection view (V2)

🧪 Data Generation Plan
All source data is static but can be regenerated via a script:
Sentence generation (pattern-based + curated)
Word lists by theme
Pronunciation tips (English-speaker-specific)
Audio files using multiple TTS voices
Difficulty assignments using heuristics:
- length
- phoneme complexity
- stress patterns

🔄 Spaced Repetition (Simplified)
A simple algorithm determines what to review:
Items with low scores surface more often
Items with long gaps since last practice appear again
Category decks shuffle but prefer weak words

🖥️ Pages
1. Home / Dashboard
Quick practice button
Category overview with progress bars
Daily goal (XP or attempts)
2. Sentence Practice Page
Audio playback
Recording + score
Tip highlights on mistakes
3. Word Drill Page
Single word view
Fast repetition loop
Quick tip for tough phonemes
4. Category Learning Page
V2: Multiple-choice mode
Spaced repetition queue
Category progress
5. Settings
Voice selection (male/female/both)
Accent: Brazilian / European
Difficulty range


🛠️ Tech Stack
Vanilla JS / TypeScript (or lightweight framework)
Local JSON datastore
Browser speech capture
Azure Speech / Web Speech API for scoring
Static hosting (e.g., Vercel)

