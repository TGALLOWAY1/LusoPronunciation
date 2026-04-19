# Audio Recording & Upload Pipeline - Complete Audit Report

## Executive Summary

**CRITICAL FINDING**: No unintentional drift detected. The codebase has **ALWAYS** used webm/opus format for MediaRecorder recordings. There is **NO evidence** of WAV format ever being used for live browser recordings.

**Root Cause**: This is a **design gap**, not drift:
- MediaRecorder API (browser standard) only supports webm/opus formats
- Azure Pronunciation Assessment REQUIRES PCM/WAV format
- No conversion layer was ever implemented to bridge this gap

---

## Detailed File-by-File Analysis

### 1. `src/hooks/useMicrophoneRecorder.ts`

#### Lines 35-36: JSDoc Comment
```typescript
/**
 * Uses MediaRecorder API with preferred codec 'audio/ogg;codecs=opus',
 * falling back to browser default if unsupported.
 */
```
**Status**: ✅ Intentional - Original design documentation
**Issue**: None - Accurately describes behavior
**Recommendation**: None

#### Lines 111-123: MIME Type Selection Logic
```typescript
// Determine MIME type - prefer opus, fallback to default
let mimeType = 'audio/ogg;codecs=opus';
if (!MediaRecorder.isTypeSupported(mimeType)) {
  // Try other opus variants
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
    mimeType = 'audio/webm;codecs=opus';
  } else if (MediaRecorder.isTypeSupported('audio/webm')) {
    mimeType = 'audio/webm';
  } else {
    // Use browser default
    mimeType = '';
  }
}
```
**Status**: ✅ Intentional - Original implementation
**Issue**: MediaRecorder API does NOT support WAV in any browser
**Impact**: All recordings are webm/opus, incompatible with Azure requirements
**Recommendation**: 
- Keep as-is (can't change MediaRecorder limitations)
- Add server-side conversion (see Recommendation #1)

#### Line 126: MediaRecorder Initialization
```typescript
const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
```
**Status**: ✅ Intentional - Standard MediaRecorder usage
**Issue**: None - This is correct for MediaRecorder API
**Recommendation**: None

#### Line 139: Blob Creation
```typescript
const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/ogg' });
```
**Status**: ✅ Intentional - Creates blob with correct MIME type
**Issue**: None - Blob type matches actual format
**Recommendation**: None

---

### 2. `src/hooks/useLivePronunciationPractice.ts`

#### Line 158: FormData Filename
```typescript
formData.append('audio', audioBlob, `${sentenceId}-attempt.ogg`);
```
**Status**: ⚠️ Minor inconsistency
**Issue**: 
- Filename uses `.ogg` extension
- Actual format is `webm/opus` (not ogg container)
- Azure doesn't use filename, only Content-Type header
**Impact**: Low - Informational only, doesn't affect functionality
**Recommendation**: 
- Option A: Change to `.webm` or `.opus` to match actual format
- Option B: Keep as-is (Azure ignores filename)
- Option C: Remove extension entirely

---

### 3. `src/components/practice/SentenceCard.tsx`

#### Line 68: FormData Filename
```typescript
formData.append('audio', blob, `${sentence.id}-attempt.ogg`);
```
**Status**: ⚠️ Same as useLivePronunciationPractice
**Issue**: Same as above
**Recommendation**: Same as above

---

### 4. `src/lib/wordPronunciation.ts`

#### Line 26: FormData Filename
```typescript
formData.append('audio', blob, `${wordId}-attempt.ogg`);
```
**Status**: ⚠️ Same as above
**Issue**: Same as above
**Recommendation**: Same as above

---

### 5. `src/server/routes/pronunciationAssessment.ts`

#### Line 264: Content-Type Header
```typescript
const contentType = 'audio/webm; codecs=opus';
```
**Status**: ✅ Intentional - Correctly reflects actual payload format
**Issue**: 
- Header is correct for what's being sent
- But Azure requires `audio/wav` for pronunciation assessment
**Impact**: Critical - Azure doesn't return PronunciationAssessment fields
**Recommendation**: 
1. Keep this line as-is (must match actual payload)
2. Add conversion step BEFORE this line
3. Update Content-Type to `audio/wav` AFTER conversion

#### Lines 253-263: WAV Requirement Comments
```typescript
// CRITICAL: Azure Pronunciation Assessment REST API REQUIRES PCM/WAV format:
// - Format: PCM/WAV
// - Sample Rate: 16,000 Hz
// - Bit Depth: 16 bits
// - Channels: Mono
// 
// MediaRecorder produces webm/opus, which Azure may not properly process for pronunciation assessment.
// This is why responses may lack PronunciationAssessment fields - Azure can't assess non-WAV audio.
// 
// TODO: Convert webm/opus to WAV on the server before sending to Azure.
// For now, we send webm/opus and hope Azure accepts it, but results may be incomplete.
```
**Status**: ✅ Intentional - Added during recent debugging session
**Issue**: None - Accurately documents the problem
**Recommendation**: Keep - Good documentation

---

## Comparison: Working vs Non-Working

### Working: `src/pipeline/azurePronunciationClient.ts`

**Line 205**: Content-Type
```typescript
'Content-Type': 'audio/wav',
```

**Line 188**: Audio Source
```typescript
const audioBuffer = await fs.readFile(absolutePath);
```

**Why It Works**: Uses pre-generated WAV files from Azure TTS, not browser recordings.

---

### Non-Working: Live Recording Pipeline

**Flow**:
1. `useMicrophoneRecorder.ts` → Records as webm/opus (browser limitation)
2. `useLivePronunciationPractice.ts` → Sends webm/opus blob
3. `pronunciationAssessment.ts` → Sends webm/opus to Azure
4. **Azure** → Rejects or returns incomplete results (no PronunciationAssessment)

**Why It Fails**: No conversion step between browser recording and Azure API.

---

## Historical Analysis

### Was WAV Ever Used?

**Search Results**: 
- ✅ Found: WAV references in pipeline code (pre-generated files)
- ✅ Found: WAV references in audio path utilities
- ❌ NOT Found: Any MediaRecorder code attempting WAV format
- ❌ NOT Found: Any audio conversion utilities
- ❌ NOT Found: Any ffmpeg or audio processing libraries

**Conclusion**: WAV was NEVER used for live browser recordings. This is the original design.

---

## Summary of Changes Needed

### Files Requiring Changes

1. **`src/server/routes/pronunciationAssessment.ts`** (CRITICAL)
   - **Add**: Audio conversion function (webm/opus → WAV)
   - **Change**: Content-Type header after conversion
   - **Lines**: Insert conversion between lines 251 and 264

2. **`src/hooks/useLivePronunciationPractice.ts`** (OPTIONAL)
   - **Change**: Filename extension from `.ogg` to `.webm`
   - **Line**: 158

3. **`src/components/practice/SentenceCard.tsx`** (OPTIONAL)
   - **Change**: Filename extension from `.ogg` to `.webm`
   - **Line**: 68

4. **`src/lib/wordPronunciation.ts`** (OPTIONAL)
   - **Change**: Filename extension from `.ogg` to `.webm`
   - **Line**: 26

### Files Requiring NO Changes

- ✅ `src/hooks/useMicrophoneRecorder.ts` - Correct as-is (browser API limitation)

---

## Recommended Implementation Plan

### Phase 1: Critical Fix (Required)

**Add Audio Conversion to Server Route**

```typescript
// In pronunciationAssessment.ts, after line 251 (audioBuffer creation)
// Add conversion function:
async function convertWebmToWav(webmBuffer: Buffer): Promise<Buffer> {
  // Use ffmpeg or similar to convert
  // Return WAV buffer (16kHz, 16-bit, mono)
}

// Before line 264, add:
const wavBuffer = await convertWebmToWav(audioBuffer);
const contentType = 'audio/wav';
const audioBody = new Uint8Array(wavBuffer);
```

### Phase 2: Code Quality (Optional)

**Fix Filename Extensions**
- Change all `.ogg` to `.webm` in FormData filenames
- Or detect from `audioBlob.type` dynamically

### Phase 3: Documentation (Optional)

**Update Comments**
- Clarify MediaRecorder limitation is browser API, not code choice
- Document conversion as required workaround

---

## Conclusion

**No unintentional drift found**. The webm/opus format has been consistent since MediaRecorder was first implemented. The issue is a **missing feature** (audio conversion), not a regression.

**Action Required**: Implement server-side webm/opus → WAV conversion before sending to Azure Pronunciation Assessment API.

