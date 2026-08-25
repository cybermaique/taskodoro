import type { CSSProperties } from "react";

const JOY_PARTICLES = [
  { left: "8%", top: "58%", size: 4, duration: "3.8s", delay: "-1.4s" },
  { left: "20%", top: "32%", size: 3, duration: "4.6s", delay: "-3.2s" },
  { left: "34%", top: "68%", size: 5, duration: "4.2s", delay: "-2.1s" },
  { left: "49%", top: "28%", size: 3, duration: "3.5s", delay: "-0.8s" },
  { left: "64%", top: "64%", size: 4, duration: "4.8s", delay: "-3.8s" },
  { left: "78%", top: "34%", size: 3, duration: "3.9s", delay: "-2.6s" },
  { left: "91%", top: "60%", size: 5, duration: "4.4s", delay: "-1.7s" },
] as const;

export function CompactJoyField() {
  return (
    <div className="compact-joy-field" aria-hidden="true">
      <span className="compact-joy-field__halo" />
      <span className="compact-joy-field__ribbon" />
      <span className="compact-joy-field__ribbon compact-joy-field__ribbon--second" />
      {JOY_PARTICLES.map((particle, index) => (
        <i
          key={`${particle.left}-${particle.top}`}
          className="compact-joy-field__particle"
          style={
            {
              "--joy-left": particle.left,
              "--joy-top": particle.top,
              "--joy-size": `${particle.size}px`,
              "--joy-duration": particle.duration,
              "--joy-delay": particle.delay,
              "--joy-index": index,
            } as CSSProperties
          }
        />
      ))}
      <span className="compact-joy-field__spark compact-joy-field__spark--one">✦</span>
      <span className="compact-joy-field__spark compact-joy-field__spark--two">✧</span>
      <span className="compact-joy-field__spark compact-joy-field__spark--three">✦</span>
    </div>
  );
}
