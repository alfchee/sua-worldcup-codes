const CONFETTI_PIECES = Array.from({ length: 24 }, (_, index) => ({
  id: index,
  left: `${(index * 97) % 100}%`,
  delay: `${(index % 6) * 0.45}s`,
  duration: `${6 + (index % 5)}s`,
  rotation: `${(index * 33) % 360}deg`,
  drift: `${-18 + ((index * 11) % 36)}vw`,
}));

export function ConfettiBurst() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {CONFETTI_PIECES.map((piece) => (
        <span
          key={piece.id}
          className="confetti-piece"
          style={
            {
              left: piece.left,
              animationDelay: piece.delay,
              animationDuration: piece.duration,
              "--confetti-rotate": piece.rotation,
              "--confetti-drift": piece.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
