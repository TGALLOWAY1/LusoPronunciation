import { useState, useRef, useCallback, useEffect } from 'react';

// Type alias for MediaRecorder error events
type MediaRecorderErrorEventLike = Event & { error?: DOMException };

export type UseMicrophoneRecorderResult = {
  isRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
  error: string | null;
};

/**
 * Helper function to properly release a MediaStream and all its tracks.
 * This ensures the audio device is fully released.
 */
function releaseMediaStream(stream: MediaStream | null): void {
  if (stream) {
    stream.getTracks().forEach(track => {
      track.stop();
      // Remove all event listeners to prevent memory leaks
      track.onended = null;
      track.onmute = null;
      track.onunmute = null;
    });
  }
}

/**
 * React hook for recording audio from the user's microphone.
 * 
 * Uses MediaRecorder API with preferred codec 'audio/ogg;codecs=opus',
 * falling back to browser default if unsupported.
 * 
 * Ensures proper cleanup of MediaStreams to release audio device locks.
 */
export function useMicrophoneRecorder(): UseMicrophoneRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const currentAudioUrlRef = useRef<string | null>(null);

  // Cleanup function to revoke object URL
  const revokeAudioUrl = useCallback((url: string | null) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }, []);

  // Comprehensive cleanup function
  const cleanup = useCallback(() => {
    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        // Ignore errors when stopping
      }
    }

    // Release MediaStream and all tracks
    releaseMediaStream(streamRef.current);
    streamRef.current = null;

    // Revoke previous URL
    if (currentAudioUrlRef.current) {
      revokeAudioUrl(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }

    // Reset state
    setIsRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setError(null);
    chunksRef.current = [];
    mediaRecorderRef.current = null;
  }, [revokeAudioUrl]);

  // Reset function
  const reset = useCallback(() => {
    cleanup();
  }, [cleanup]);

  // Start recording
  const startRecording = useCallback(async () => {
    // Clean up any existing stream first
    cleanup();

    try {
      // Reset any previous error
      setError(null);

      // Reset previous state
      setAudioBlob(null);
      setAudioUrl(null);
      chunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

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

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;

      // Accumulate chunks
      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = () => {
        // Create blob from accumulated chunks
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/ogg' });
        setAudioBlob(blob);

        // Create object URL for playback
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        currentAudioUrlRef.current = url;

        // Release MediaStream after recording is complete
        releaseMediaStream(streamRef.current);
        streamRef.current = null;

        setIsRecording(false);
        chunksRef.current = [];
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        const errorEvent = event as MediaRecorderErrorEventLike;
        setError(`Recording error: ${errorEvent.error?.message || 'Unknown error'}`);
        setIsRecording(false);
        // Clean up stream on error
        releaseMediaStream(streamRef.current);
        streamRef.current = null;
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      // Always clean up stream on error
      releaseMediaStream(streamRef.current);
      streamRef.current = null;

      // Handle permission denied or other errors
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          setError('Microphone permission denied. Please allow microphone access to record audio.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No microphone found. Please connect a microphone and try again.');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Microphone is already in use by another application.');
        } else {
          setError(`Failed to access microphone: ${err.message}`);
        }
      } else {
        setError(`Failed to start recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
      setIsRecording(false);
    }
  }, [cleanup]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        // Stream will be released in onstop handler
      } catch (err) {
        setError(`Failed to stop recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
        // If stop fails, still release the stream to free the device
        releaseMediaStream(streamRef.current);
        streamRef.current = null;
        setIsRecording(false);
      }
    } else {
      // If not recording, just reset
      reset();
    }
  }, [reset]);

  // Cleanup on unmount - always run, don't depend on audioUrl
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // Release stream when page becomes hidden or is about to unload
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && streamRef.current) {
        // Page is hidden - release the stream to free the audio device
        releaseMediaStream(streamRef.current);
        streamRef.current = null;
        if (isRecording) {
          setIsRecording(false);
          // Try to stop recording if active
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
              mediaRecorderRef.current.stop();
            } catch (err) {
              // Ignore errors
            }
          }
        }
      }
    };

    const handleBeforeUnload = () => {
      // Page is unloading - ensure all streams are released
      cleanup();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handleBeforeUnload);
    };
  }, [cleanup, isRecording]);

  return {
    isRecording,
    audioBlob,
    audioUrl,
    startRecording,
    stopRecording,
    reset,
    error,
  };
}

