/**
 * Static wave bands behind the page. Drawn as SVG rather than layered CSS
 * gradients so the curves are real curves, and so each band can take its
 * colour straight from the theme tokens — a data: URI could not.
 *
 * preserveAspectRatio="none" lets the viewBox stretch to any window, which is
 * what keeps the bands in the same relative place on a phone and on a monitor.
 */
export default function BackgroundWaves() {
  return (
    <div className="waves" aria-hidden="true">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="none">
        <defs>
          <linearGradient id="wave-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--glow-a)" />
            <stop offset="100%" stopColor="var(--glow-c)" />
          </linearGradient>
          <linearGradient id="wave-b" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--glow-b)" />
            <stop offset="100%" stopColor="var(--glow-a)" />
          </linearGradient>
          <linearGradient id="wave-c" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--glow-c)" />
            <stop offset="100%" stopColor="var(--glow-b)" />
          </linearGradient>
        </defs>

        {/* top band, sweeping down from the masthead */}
        <path
          fill="url(#wave-a)"
          d="M0,0 H1440 V232 C1200,300 968,196 720,248 C472,300 240,206 0,268 Z"
        />

        {/* mid band */}
        <path
          fill="url(#wave-b)"
          d="M0,470 C236,404 472,516 720,462 C968,408 1204,510 1440,452
             L1440,632 C1204,700 968,592 720,646 C472,700 236,596 0,660 Z"
        />

        {/* bottom band, running off the foot of the screen */}
        <path
          fill="url(#wave-c)"
          d="M0,742 C240,678 480,790 720,736 C960,682 1200,780 1440,720 L1440,900 H0 Z"
        />
      </svg>
    </div>
  );
}
