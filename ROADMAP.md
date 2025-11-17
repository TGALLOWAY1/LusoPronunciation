🚀 Roadmap
V1 (MVP) — Local, Static App
[x] Build full data model
[x] Generate static sentence & word datasets
    - Created 'STATIC DATA' folder with sentences.json and words.json 
    [] Create questions data model for the word multiple choice 
[x] Generate audio files
    [x] Use Azure Speech to generate the audio files 
[x] Build UI with real data
    [x] Complete UI architecture with React + TypeScript + Tailwind
    [x] Dashboard, Sentence Practice, Word Practice, Review Queue screens
    [x] Audio playback integration (male/female voices)
    [x] Data loading and caching utilities
    [x] Performance optimizations (memo, useCallback, useMemo)
    [x] Responsive design with dark mode support
[x] Switch to real data (completed as part of UI build)
[x] Implement spaced repetition (basic implementation)
    [x] LocalStorage-based progress tracking
    [x] Simple spaced repetition algorithm (Easy/Good/Hard ratings)
    [x] Review queue with due items
    [⚠️] Dashboard progress shows placeholder data (needs real calculation)
[x] Build progress tracking (basic implementation)
    [x] Progress store with React Context
    [x] LocalStorage persistence
    [x] Rating system for sentences and words
[] Implement pronunciation scoring

V2

 Category system flashcards 
 Progress per category
 Multiple-choice testing
 Better speech scoring UI
 Real-time phoneme highlighting
[] Add multiple speech files for each sentence (evaluate the different models)
[] Add a 'notes' section for seeing grammar rules and pitfalls that are common 


TODO 
[] write azure speech resource summary for synthesis step