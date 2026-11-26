import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Mic, MicOff, Square, Volume2 } from 'lucide-react';
import { api } from '../lib/api';
import type { UserProfile } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';

interface VoiceAssistantScreenProps {
  user: UserProfile;
  onUserUpdated: (user: UserProfile) => void;
  onUsageChanged: () => void;
}

const VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'];

export const VoiceAssistantScreen: React.FC<VoiceAssistantScreenProps> = ({
  user,
  onUserUpdated,
  onUsageChanged,
}) => {
  const [status, setStatus] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [voice, setVoice] = useState(user.preferredVoice || 'Kore');
  const [transcript, setTranscript] = useState('');
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleVoiceChange = async (nextVoice: string) => {
    setVoice(nextVoice);
    try {
      const res = await api.updateProfile({ preferredVoice: nextVoice });
      onUserUpdated(res.user);
    } catch {
      // Ignore
    }
  };

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setStatus('idle');
  };

  const speakResponse = async (text: string) => {
    setStatus('speaking');
    try {
      const tts = await api.generateSpeech(text, voice);
      const audio = new Audio(tts.audioDataUrl);
      audioRef.current = audio;
      audio.onended = () => setStatus('idle');
      audio.onerror = () => setStatus('idle');
      await audio.play();
    } catch {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text.slice(0, 1200));
        utter.onend = () => setStatus('idle');
        window.speechSynthesis.speak(utter);
      } else {
        setStatus('idle');
      }
    }
  };

  const processTranscript = async (spokenText: string) => {
    setTranscript(spokenText);
    setStatus('thinking');
    setReply('');

    try {
      let fullReply = '';
      await api.streamTool(
        {
          toolId: 'question-answering',
          input: spokenText,
          backendKey: user.preferredChatBackend,
        },
        (evt) => {
          if (evt.type === 'text' && evt.text) {
            fullReply += evt.text;
            setReply(fullReply);
          } else if (evt.type === 'error') {
            setError(evt.error || 'Failed to generate response.');
          }
        }
      );

      onUsageChanged();
      if (fullReply.trim() && user.autoSpeakVoice) {
        await speakResponse(fullReply.trim());
      } else {
        setStatus('idle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Voice assistant failed.');
      setStatus('idle');
    }
  };

  const toggleListening = async () => {
    if (status === 'listening') {
      mediaRecorderRef.current?.stop();
      return;
    }

    stopSpeaking();
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 400) {
          setStatus('idle');
          return;
        }
        setStatus('thinking');
        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = String(reader.result || '').split(',')[1];
          if (!base64) {
            setStatus('idle');
            return;
          }
          try {
            const res = await api.transcribeAudio(base64, blob.type || 'audio/webm');
            if (!res.text.trim()) {
              setError('Could not detect speech. Please try speaking again.');
              setStatus('idle');
              return;
            }
            await processTranscript(res.text.trim());
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Audio transcription failed.');
            setStatus('idle');
          }
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus('listening');
    } catch {
      setError('Microphone permission is required for Voice Assistant.');
      setStatus('idle');
    }
  };

  const waveBars = [0.4, 0.8, 0.55, 1, 0.7, 0.9, 0.45, 0.75, 0.5];

  return (
    <div className="max-w-3xl mx-auto w-full py-4 space-y-6">
      <div className="rounded-3xl bg-white p-6 sm:p-10 flex flex-col items-center text-center neo-soft-shadow">
        <div className="w-full flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#111827]">
            AI Voice Assistant
          </h1>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-[#6B7280]">
              Voice
            </label>
            <select
              value={voice}
              onChange={(e) => void handleVoiceChange(e.target.value)}
              aria-label="Select AI voice"
              className="px-3 py-1.5 rounded-xl border border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] cursor-pointer focus:outline-none focus:border-[#111827]"
            >
              {VOICES.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="text-sm text-[#6B7280] mb-8">
          {status === 'listening'
            ? 'Listening... Tap the button when you finish speaking.'
            : status === 'thinking'
              ? 'Processing your voice request...'
              : status === 'speaking'
                ? `Speaking with ${voice}...`
                : 'Tap the circular voice button to start speaking with NEO.'}
        </p>

        {/* Animated Circular Voice Button */}
        <div className="relative flex items-center justify-center mb-8">
          {(status === 'listening' || status === 'speaking') && (
            <motion.div
              animate={{ scale: [1, 1.32, 1], opacity: [0.16, 0.04, 0.16] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute w-36 h-36 rounded-full bg-[#111827] blur-md"
            />
          )}
          <button
            type="button"
            onClick={() => void toggleListening()}
            disabled={status === 'thinking'}
            aria-label={status === 'listening' ? 'Stop listening' : 'Start listening'}
            className={`relative z-10 w-28 h-28 rounded-full flex items-center justify-center text-white shadow-xl transition-transform active:scale-95 cursor-pointer disabled:opacity-60 ${
              status === 'listening' ? 'bg-rose-600' : 'bg-[#111827] hover:bg-black'
            }`}
          >
            {status === 'listening' ? <MicOff className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
          </button>
        </div>

        {/* Sound Waves */}
        <div className="h-12 flex items-center justify-center gap-1.5 mb-6" aria-hidden="true">
          {waveBars.map((scale, idx) => (
            <motion.span
              key={idx}
              animate={
                status === 'listening' || status === 'speaking'
                  ? { scaleY: [0.3, scale, 0.35] }
                  : { scaleY: 0.25 }
              }
              transition={{
                duration: 0.65,
                repeat: status === 'listening' || status === 'speaking' ? Infinity : 0,
                delay: idx * 0.08,
                ease: 'easeInOut',
              }}
              className="w-1.5 h-10 rounded-full bg-[#111827] origin-center"
            />
          ))}
        </div>

        {status === 'speaking' && (
          <button
            type="button"
            onClick={stopSpeaking}
            className="inline-flex items-center gap-2 px-5 py-2.5 min-h-[44px] rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm font-medium cursor-pointer"
          >
            <Square className="w-4 h-4 fill-current" />
            <span>Stop Speaking</span>
          </button>
        )}

        {error && (
          <div className="mt-4 w-full p-3.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs sm:text-sm">
            {error}
          </div>
        )}
      </div>

      {(transcript || reply) && (
        <div className="rounded-3xl bg-white p-6 space-y-4 neo-soft-shadow">
          {transcript && (
            <div>
              <p className="text-xs font-medium text-[#6B7280] mb-1">
                You said
              </p>
              <p className="text-sm sm:text-base font-medium text-[#111827]">
                {transcript}
              </p>
            </div>
          )}

          {reply && (
            <div className="pt-4 border-t border-[#F1F1F4]">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-[#111827]">
                  NEO AI Response
                </p>
                {status !== 'speaking' && (
                  <button
                    type="button"
                    onClick={() => void speakResponse(reply)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#6B7280] hover:text-[#111827] cursor-pointer"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Speak Again</span>
                  </button>
                )}
              </div>
              <MarkdownRenderer content={reply} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
