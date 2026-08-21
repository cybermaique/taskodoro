"use client";

import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from "react";

const ambientMotes = [
  { x: 8, y: 18, size: 3, duration: 8.5, delay: -1.2 },
  { x: 18, y: 72, size: 5, duration: 11, delay: -4.8 },
  { x: 30, y: 38, size: 2, duration: 7.8, delay: -3.1 },
  { x: 43, y: 82, size: 4, duration: 10.2, delay: -6.4 },
  { x: 57, y: 21, size: 3, duration: 9.4, delay: -2.6 },
  { x: 68, y: 62, size: 5, duration: 12, delay: -7.2 },
  { x: 79, y: 34, size: 2, duration: 8.2, delay: -5.5 },
  { x: 91, y: 77, size: 4, duration: 10.8, delay: -3.9 },
];

interface ClickRipple {
  id: number;
  x: number;
  y: number;
}

function resetTilt(card: HTMLElement | null) {
  if (!card) return;
  card.style.removeProperty("--tilt-x");
  card.style.removeProperty("--tilt-y");
  card.style.removeProperty("--glare-x");
  card.style.removeProperty("--glare-y");
  card.removeAttribute("data-tilting");
}

export function AmbientEffects() {
  const layerRef = useRef<HTMLDivElement>(null);
  const activeCardRef = useRef<HTMLElement | null>(null);
  const rippleIdRef = useRef(0);
  const [ripples, setRipples] = useState<ClickRipple[]>([]);

  useEffect(() => {
    const supportsFinePointer = window.matchMedia("(pointer: fine)").matches;

    const handlePointerMove = (event: PointerEvent) => {
      layerRef.current?.style.setProperty("--pointer-x", `${event.clientX}px`);
      layerRef.current?.style.setProperty("--pointer-y", `${event.clientY}px`);

      if (!supportsFinePointer || !(event.target instanceof Element)) return;

      const nextCard = event.target.closest<HTMLElement>("[data-tilt-card]");
      if (activeCardRef.current !== nextCard) {
        resetTilt(activeCardRef.current);
        activeCardRef.current = nextCard;
      }

      if (!nextCard) return;
      const rect = nextCard.getBoundingClientRect();
      const horizontal = (event.clientX - rect.left) / rect.width;
      const vertical = (event.clientY - rect.top) / rect.height;

      nextCard.style.setProperty("--tilt-x", `${(0.5 - vertical) * 5}deg`);
      nextCard.style.setProperty("--tilt-y", `${(horizontal - 0.5) * 6}deg`);
      nextCard.style.setProperty("--glare-x", `${horizontal * 100}%`);
      nextCard.style.setProperty("--glare-y", `${vertical * 100}%`);
      nextCard.setAttribute("data-tilting", "true");
    };

    const handlePointerLeave = () => {
      resetTilt(activeCardRef.current);
      activeCardRef.current = null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      rippleIdRef.current += 1;
      const ripple = {
        id: rippleIdRef.current,
        x: event.clientX,
        y: event.clientY,
      };
      setRipples((current) => [...current.slice(-4), ripple]);
      window.setTimeout(() => {
        setRipples((current) =>
          current.filter((item) => item.id !== ripple.id),
        );
      }, 720);
    };

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerleave", handlePointerLeave);
    window.addEventListener("blur", handlePointerLeave);
    window.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });

    return () => {
      resetTilt(activeCardRef.current);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("blur", handlePointerLeave);
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  return (
    <div ref={layerRef} className="app-ambient-layer" aria-hidden="true">
      <span className="app-pointer-spotlight" />
      {ambientMotes.map((mote, index) => (
        <span
          key={`${mote.x}-${mote.y}`}
          className="app-ambient-mote"
          style={
            {
              "--mote-x": `${mote.x}%`,
              "--mote-y": `${mote.y}%`,
              "--mote-size": `${mote.size}px`,
              "--mote-duration": `${mote.duration}s`,
              "--mote-delay": `${mote.delay}s`,
              "--mote-index": index,
            } as CSSProperties
          }
        />
      ))}
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="app-click-ripple"
          style={{ left: ripple.x, top: ripple.y }}
        />
      ))}
    </div>
  );
}
