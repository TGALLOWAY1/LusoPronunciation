import { useState, useRef, useCallback, useEffect } from 'react';

export type UseMicrophoneRecorderResult = {
  isRecording: boolean;
  audioBlob: Blob | null;
  audioUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  reset: () => void;
  error: string | null;
};

/**
 * React hook for recording audio from the user's microphone.
 * 
 * Uses MediaRecorder API with preferred codec 'audio/ogg;codecs=opus',
 * falling back to browser default if unsupported.
 */
export function useMicrophoneRecorder(): UseMicrophoneRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Cleanup function to revoke object URL
  const revokeAudioUrl = useCallback((url: string | null) => {
    if (url) {
      URL.revokeObjectURL(url);
    }
  }, []);

  // Reset function
  const reset = useCallback(() => {
    // Stop recording if active
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        // Ignore errors when stopping
      }
    }

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Revoke previous URL
    revokeAudioUrl(audioUrl);

    // Reset state
    setIsRecording(false);
    setAudioBlob(null);
    setAudioUrl(null);
    setError(null);
    chunksRef.current = [];
    mediaRecorderRef.current = null;
  }, [audioUrl, revokeAudioUrl]);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      // Reset any previous error
      setError(null);

      // Revoke previous audio URL if exists
      revokeAudioUrl(audioUrl);

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

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }

        setIsRecording(false);
        chunksRef.current = [];
      };

      // Handle errors
      mediaRecorder.onerror = (event) => {
        const errorEvent = event as MediaRecorderErrorEvent;
        setError(`Recording error: ${errorEvent.error?.message || 'Unknown error'}`);
        setIsRecording(false);
      };

      // Start recording
      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
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
  }, [audioUrl, revokeAudioUrl]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (err) {
        setError(`Failed to stop recording: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    } else {
      // If not recording, just reset
      reset();
    }
  }, [reset]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (err) {
          // Ignore errors
        }
      }

      // Stop all tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // Revoke object URL
      revokeAudioUrl(audioUrl);
    };
  }, [audioUrl, revokeAudioUrl]);

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

