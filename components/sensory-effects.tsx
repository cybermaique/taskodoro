"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SoundEffect =
  | "click"
  | "type"
  | "success"
  | "error"
  | "warning"
  | "move"
  | "complete"
  | "login"
  | "logout"
  | "toggle";

interface SensoryEffectsContextValue {
  soundEnabled: boolean;
  toggleSound: () => void;
  playSound: (effect: SoundEffect) => void;
}

interface ToneOptions {
  frequency: number;
  endFrequency?: number;
  duration: number;
  delay?: number;
  volume?: number;
  type?: OscillatorType;
}

interface TypingBurst {
  id: number;
  x: number;
  y: number;
  hue: number;
}

const SOUND_PREFERENCE_KEY = "taskboard_sound_enabled";
const SOUND_ACTIVITY_EVENT = "taskboard:sound-activity";
const soundPreferenceListeners = new Set<() => void>();
const SensoryEffectsContext = createContext<SensoryEffectsContextValue | null>(
  null,
);

function subscribeToSoundPreference(listener: () => void) {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SOUND_PREFERENCE_KEY) listener();
  };

  soundPreferenceListeners.add(listener);
  window.addEventListener("storage", handleStorage);
  return () => {
    soundPreferenceListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSoundPreference() {
  return window.localStorage.getItem(SOUND_PREFERENCE_KEY) !== "false";
}

function setSoundPreference(enabled: boolean) {
  window.localStorage.setItem(SOUND_PREFERENCE_KEY, String(enabled));
  soundPreferenceListeners.forEach((listener) => listener());
}

function isTextEntryTarget(
  target: EventTarget | null,
): target is HTMLInputElement | HTMLTextAreaElement {
  if (target instanceof HTMLTextAreaElement) return true;
  if (!(target instanceof HTMLInputElement)) return false;

  return ["email", "password", "search", "text", "url"].includes(target.type);
}

function getCaretPoint(target: HTMLInputElement | HTMLTextAreaElement) {
  const rect = target.getBoundingClientRect();
  const style = window.getComputedStyle(target);
  const fontSize = Number.parseFloat(style.fontSize) || 14;
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.45;
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 10;
  const paddingTop = Number.parseFloat(style.paddingTop) || 8;
  const cursor = target.selectionStart ?? target.value.length;
  const beforeCursor = target.value.slice(0, cursor);
  const lines = beforeCursor.split("\n");
  const currentLine = lines.at(-1) ?? "";
  const approximateCharacterWidth = fontSize * 0.54;
  const maximumX = Math.max(paddingLeft, rect.width - paddingLeft - 8);
  const localX = Math.min(
    maximumX,
    paddingLeft + currentLine.length * approximateCharacterWidth - target.scrollLeft,
  );
  const localY =
    target instanceof HTMLTextAreaElement
      ? Math.min(
          rect.height - 8,
          Math.max(8, paddingTop + (lines.length - 0.5) * lineHeight - target.scrollTop),
        )
      : rect.height / 2;

  return {
    x: rect.left + Math.max(paddingLeft, localX),
    y: rect.top + localY,
  };
}

function TypingEffectsRuntime({
  playSound,
}: {
  playSound: (effect: SoundEffect) => void;
}) {
  const burstIdRef = useRef(0);
  const lastBurstAtRef = useRef(0);
  const [bursts, setBursts] = useState<TypingBurst[]>([]);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.isComposing ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        !isTextEntryTarget(event.target)
      ) {
        return;
      }

      const isTypingKey =
        event.key.length === 1 ||
        event.key === "Backspace" ||
        event.key === "Delete" ||
        event.key === "Enter";
      if (!isTypingKey) return;

      playSound("type");

      const target = event.target;
      if (!reducedMotion.matches) {
        target.animate(
          [
            {
              boxShadow:
                "0 0 0 1px rgb(45 212 191 / 0%), 0 0 0 rgb(99 102 241 / 0%)",
            },
            {
              boxShadow:
                "0 0 0 2px rgb(45 212 191 / 52%), 0 0 22px rgb(99 102 241 / 24%)",
              offset: 0.3,
            },
            {
              boxShadow:
                "0 0 0 1px rgb(45 212 191 / 0%), 0 0 0 rgb(99 102 241 / 0%)",
            },
          ],
          { duration: 260, easing: "cubic-bezier(0.16, 0.82, 0.2, 1)" },
        );
      }

      const now = performance.now();
      if (reducedMotion.matches || now - lastBurstAtRef.current < 54) return;
      lastBurstAtRef.current = now;

      const point = getCaretPoint(target);
      burstIdRef.current += 1;
      const burst = {
        id: burstIdRef.current,
        x: point.x,
        y: point.y,
        hue: [174, 195, 258, 320][burstIdRef.current % 4],
      };

      setBursts((current) => [...current.slice(-7), burst]);
      window.setTimeout(() => {
        setBursts((current) =>
          current.filter((item) => item.id !== burst.id),
        );
      }, 620);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const control = event.target.closest<HTMLElement>(
        "button, [role='tab'], [role='button']",
      );
      if (
        !control ||
        control.dataset.sound === "none" ||
        control.hasAttribute("disabled") ||
        control.getAttribute("aria-disabled") === "true"
      ) {
        return;
      }

      playSound(
        control.dataset.variant === "destructive" ? "warning" : "click",
      );
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [playSound]);

  return (
    <div className="app-typing-effects-layer" aria-hidden="true">
      {bursts.map((burst) => (
        <span
          key={burst.id}
          className="app-typing-burst"
          style={
            {
              left: burst.x,
              top: burst.y,
              "--typing-hue": burst.hue,
            } as CSSProperties
          }
        >
          <i />
          <i />
          <i />
          <i />
        </span>
      ))}
    </div>
  );
}

export function SensoryEffectsProvider({ children }: { children: ReactNode }) {
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastTypingSoundAtRef = useRef(0);
  const soundEnabled = useSyncExternalStore(
    subscribeToSoundPreference,
    getSoundPreference,
    () => true,
  );

  useEffect(() => {
    return () => {
      void audioContextRef.current?.close();
    };
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).webkitAudioContext;

      if (!AudioContextConstructor) return null;
      audioContextRef.current = new AudioContextConstructor();
    }

    const context = audioContextRef.current;
    if (context.state === "suspended") void context.resume();
    return context;
  }, []);

  const synthesize = useCallback(
    (effect: SoundEffect) => {
      const context = getAudioContext();
      if (!context) return;

      const playTone = ({
        frequency,
        endFrequency,
        duration,
        delay = 0,
        volume = 0.025,
        type = "sine",
      }: ToneOptions) => {
        const startsAt = context.currentTime + delay;
        const endsAt = startsAt + duration;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, startsAt);
        if (endFrequency) {
          oscillator.frequency.exponentialRampToValueAtTime(
            endFrequency,
            endsAt,
          );
        }

        gain.gain.setValueAtTime(0.0001, startsAt);
        gain.gain.exponentialRampToValueAtTime(
          volume,
          startsAt + Math.min(0.018, duration * 0.25),
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(startsAt);
        oscillator.stop(endsAt + 0.02);
      };

      if (effect === "type") {
        const now = performance.now();
        if (now - lastTypingSoundAtRef.current < 34) return;
        lastTypingSoundAtRef.current = now;
        playTone({
          frequency: 760 + Math.random() * 190,
          endFrequency: 700 + Math.random() * 120,
          duration: 0.026,
          volume: 0.009,
          type: "triangle",
        });
      } else if (effect === "click") {
        playTone({
          frequency: 320,
          endFrequency: 205,
          duration: 0.055,
          volume: 0.018,
          type: "triangle",
        });
      } else if (effect === "success" || effect === "login") {
        [523.25, 659.25, 783.99].forEach((frequency, index) =>
          playTone({
            frequency,
            duration: 0.16,
            delay: index * 0.065,
            volume: 0.025,
            type: "sine",
          }),
        );
      } else if (effect === "error") {
        playTone({
          frequency: 210,
          endFrequency: 138,
          duration: 0.22,
          volume: 0.024,
          type: "sawtooth",
        });
      } else if (effect === "warning") {
        [330, 294].forEach((frequency, index) =>
          playTone({
            frequency,
            duration: 0.11,
            delay: index * 0.1,
            volume: 0.02,
            type: "triangle",
          }),
        );
      } else if (effect === "move") {
        playTone({
          frequency: 260,
          endFrequency: 620,
          duration: 0.22,
          volume: 0.028,
          type: "sine",
        });
        playTone({
          frequency: 780,
          duration: 0.12,
          delay: 0.16,
          volume: 0.018,
          type: "triangle",
        });
      } else if (effect === "complete") {
        [392, 523.25, 659.25, 783.99, 1046.5].forEach(
          (frequency, index) =>
            playTone({
              frequency,
              duration: index === 4 ? 0.42 : 0.2,
              delay: index * 0.075,
              volume: index === 4 ? 0.034 : 0.03,
              type: index % 2 ? "triangle" : "sine",
            }),
        );
      } else if (effect === "logout") {
        [659.25, 523.25, 392].forEach((frequency, index) =>
          playTone({
            frequency,
            duration: 0.16,
            delay: index * 0.075,
            volume: 0.022,
            type: "sine",
          }),
        );
      } else {
        playTone({
          frequency: 440,
          endFrequency: 720,
          duration: 0.14,
          volume: 0.024,
          type: "sine",
        });
      }

      window.dispatchEvent(
        new CustomEvent(SOUND_ACTIVITY_EVENT, { detail: effect }),
      );
    },
    [getAudioContext],
  );

  const playSound = useCallback(
    (effect: SoundEffect) => {
      if (soundEnabled) synthesize(effect);
    },
    [soundEnabled, synthesize],
  );

  const toggleSound = useCallback(() => {
    const next = !soundEnabled;
    if (!next) synthesize("toggle");
    setSoundPreference(next);
    if (next) window.setTimeout(() => synthesize("toggle"), 0);
  }, [soundEnabled, synthesize]);

  const contextValue = useMemo(
    () => ({ soundEnabled, toggleSound, playSound }),
    [playSound, soundEnabled, toggleSound],
  );

  return (
    <SensoryEffectsContext.Provider value={contextValue}>
      <TypingEffectsRuntime playSound={playSound} />
      {children}
    </SensoryEffectsContext.Provider>
  );
}

export function useSensoryEffects() {
  const context = useContext(SensoryEffectsContext);
  if (!context) {
    throw new Error(
      "useSensoryEffects must be used within SensoryEffectsProvider",
    );
  }
  return context;
}

export function SoundToggle({ className }: { className?: string }) {
  const { soundEnabled, toggleSound } = useSensoryEffects();
  const [active, setActive] = useState(false);

  useEffect(() => {
    let timeoutId = 0;
    const handleActivity = () => {
      setActive(false);
      window.requestAnimationFrame(() => setActive(true));
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => setActive(false), 360);
    };

    window.addEventListener(SOUND_ACTIVITY_EVENT, handleActivity);
    return () => {
      window.clearTimeout(timeoutId);
      window.removeEventListener(SOUND_ACTIVITY_EVENT, handleActivity);
    };
  }, []);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      data-sound="none"
      aria-label={soundEnabled ? "Desativar sons" : "Ativar sons"}
      aria-pressed={soundEnabled}
      title={soundEnabled ? "Sons ativados" : "Sons desativados"}
      onClick={toggleSound}
      className={cn(
        "app-sound-toggle relative size-11 overflow-visible rounded-full bg-background/80 shadow-sm backdrop-blur sm:size-8",
        active && soundEnabled && "app-sound-toggle-active",
        className,
      )}
    >
      {soundEnabled ? (
        <Volume2 className="size-4" />
      ) : (
        <VolumeX className="size-4" />
      )}
      <span className="app-sound-wave" aria-hidden="true" />
    </Button>
  );
}
