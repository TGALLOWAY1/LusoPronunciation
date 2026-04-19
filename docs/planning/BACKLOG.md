# LusoPronunciation Backlog

This file tracks future work and enhancements for the LusoPronunciation project.

## Practice Words Page

### Dedicated Practice Words Experience
- **Status**: Not Started
- **Priority**: High
- **Description**: Implement a dedicated "Practice Words" page that provides focused word-by-word practice functionality.
- **Requirements**:
  - Show the lowest-scoring words across attempts (aggregated from all user attempts)
  - Display words using the "Focus on these words" style UI and logic (reuse from assessment view)
  - Provide looped native playback for each word
  - Enable user recording and playback for each word
  - Allow users to practice individual words in isolation
  - Track practice progress per word
- **Dependencies**: Word-level audio data, word-by-word scoring data
- **Related**: See "Synthetic Word Data" and "Word-by-Word Practice Button" items

### Practice Button Navigation
- **Status**: Not Started
- **Priority**: Medium
- **Description**: Wire the "Practice" button on the assessment page to navigate to or open the Practice Words page.
- **Requirements**:
  - Add navigation from assessment view to Practice Words page
  - Pass context about which words to practice (e.g., lowest-scoring words from current attempt)
  - Ensure smooth transition between assessment and practice modes
- **Note**: Currently non-functional. The Practice Words page must be implemented first.

## Word-by-Word Data & Practice

### Synthetic Word-Level Pronunciation Data
- **Status**: Not Started
- **Priority**: High
- **Description**: Create synthetic word-level pronunciation data for all words used in `sentences.json` to enable word-by-word practice beyond the 10 test fixtures.
- **Requirements**:
  - Define a data generation script or process that can be run to (re)build word-level datasets
  - Generate pronunciation scores, phoneme data, and audio paths for each word
  - Ensure data structure is consistent with existing fixture format
  - Support batch generation for all words in sentences.json
- **Technical Notes**:
  - May leverage Azure Speech API for generating word-level pronunciation assessments
  - Should produce data compatible with existing `WordFeedback` and `WordAudioVariant` types
  - Consider caching and incremental updates

### Word-by-Word Practice Button Functionality
- **Status**: Not Started
- **Priority**: Medium
- **Description**: Make the word-level "Practice" button functional by tying it into the future Practice Words page and word audio playback.
- **Requirements**:
  - Connect practice button clicks to Practice Words page navigation
  - Pass word context (word index, word text, current score) to practice page
  - Ensure word audio playback works in practice context
  - Provide visual feedback when practice button is clicked
- **Note**: This is a known TODO. Implementation depends on Practice Words page being available.

## Phoneme Metadata Enhancement

### Phoneme Metadata File
- **Status**: Completed
- **Priority**: Medium
- **Description**: Created `phoneme_metadata.json` at `data/phoneme_metadata.json` with rich metadata for common Brazilian Portuguese phonemes.
- **Completed**:
  - JSON file with IPA symbols, type (vowel/consonant), descriptions, Portuguese examples, and English examples
  - Loader utility `src/lib/phonemeMetadata.ts` with normalization support
  - Integrated into `PhonemePanel` component
- **Note**: Currently covers common IPA symbols. See "Phoneme Metadata Review" item below.

### PhonemePanel Metadata Display
- **Status**: Completed
- **Priority**: Medium
- **Description**: Updated `PhonemePanel` component to display rich phoneme metadata.
- **Completed**:
  - Enhanced tooltips with descriptions and examples
  - Added "How to pronounce these sounds" section with detailed metadata
  - Shows Portuguese and English examples for each phoneme
  - Graceful fallback for phonemes without metadata
- **Dependencies**: Phoneme metadata file created and integrated

### Phoneme Metadata Review and Validation
- **Status**: Not Started
- **Priority**: Medium
- **Description**: Review and validate `phoneme_metadata.json` with a native Brazilian Portuguese speaker or trusted linguistic reference.
- **Requirements**:
  - Verify accuracy of phonetic descriptions
  - Validate Portuguese example words are appropriate
  - Confirm English examples accurately represent similar sounds
  - Check that descriptions are clear and helpful for learners
- **Note**: Current metadata is a starting point and should be reviewed for accuracy.

### Extend Phoneme Metadata for Azure Symbols
- **Status**: Not Started
- **Priority**: Medium
- **Description**: Extend `phoneme_metadata.json` to cover all phonemes used in Azure Speech output and align symbol choices with Azure phoneme symbols.
- **Requirements**:
  - Map Azure phoneme symbols (e.g., "ae", "iy", "uw", "ax") to IPA equivalents or add direct entries
  - Ensure all phonemes appearing in Azure JSON outputs have corresponding metadata
  - Create mapping utility if Azure uses different symbol system (e.g., SAMPA)
  - Test with real Azure output to ensure all symbols are covered
- **Technical Notes**:
  - Azure may use SAMPA or similar system rather than pure IPA
  - May need symbol mapping/conversion layer
  - Consider adding both Azure symbols and IPA equivalents

## Multiple Native Voice Support

### Multiple Native Speakers
- **Status**: Not Started
- **Priority**: Low
- **Description**: Support multiple native speakers (e.g., male/female or regional accents) at both sentence and word levels.
- **Requirements**:
  - Provide UI control to switch between native voices
  - Ensure corresponding audio paths are correctly wired
  - Update scoring metadata to track which voice was used
  - Support voice selection in practice modes
- **Technical Notes**:
  - May leverage existing male/female audio structure in `sentences.json`
  - Consider regional accent variations (e.g., Brazilian vs European Portuguese)
  - Ensure voice switching doesn't break existing audio playback coordination

### Voice Selection UI
- **Status**: Not Started
- **Priority**: Low
- **Description**: Add UI controls for selecting native voice (male/female/regional) in sentence and word practice.
- **Requirements**:
  - Add voice selector to `SentenceAudioControls` component
  - Add voice selector to word-level practice interface
  - Persist voice preference (optional)
  - Ensure smooth switching without audio playback issues
- **Dependencies**: Multiple native speakers support must be implemented first

## Assessment vs Practice Separation

### Assessment View Cleanup
- **Status**: Completed
- **Priority**: High
- **Description**: Separate assessment and practice concerns by removing practice-specific UI from assessment view.
- **Completed**:
  - Removed "Focus on these words" section from `PhraseScoreOverview` in assessment view
  - Kept internal logic for potential reuse in Practice Words page
  - Removed `onPracticeWord` prop from assessment components
- **Note**: Practice functionality will be implemented on dedicated Practice Words page.

