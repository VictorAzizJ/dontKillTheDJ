const commands = [
  { label: "Temperature", example: "HOT, COLD, or 1–5" },
  { label: "In your words", example: "too loud, this slaps, play something we know" },
  { label: "Song", example: "REQUEST Title - Artist" },
] as const;

export function TextLine({
  isLive,
  phone,
  slug,
}: {
  isLive: boolean;
  phone: string | null;
  slug: string;
}) {
  return (
    <section className="mt-8 flex flex-col gap-4">
      <h2 className="text-sm font-medium tracking-wide text-white/70 uppercase">
        Text the DJ
      </h2>

      {phone ? (
        <a
          href={`tel:${phone}`}
          className="rounded-2xl bg-surface px-5 py-6 text-center ring-1 ring-cyan/40"
        >
          <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">
            Message this number
          </p>
          <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-cyan">
            {phone}
          </p>
        </a>
      ) : (
        <div className="rounded-2xl bg-surface px-5 py-6 ring-1 ring-white/10">
          <p className="text-sm leading-relaxed">
            The text line is not connected yet. The room joins by message once
            the DJ number is set.
          </p>
        </div>
      )}

      {phone ? (
        <p className="text-muted-foreground text-sm leading-relaxed">
          {isLive
            ? "Send a text. The DJ sees the room on their dashboard."
            : "Texts open when this session goes live."}
        </p>
      ) : null}

      <ul className="flex flex-col gap-2">
        {commands.map((command) => (
          <li
            key={command.label}
            className="rounded-xl bg-surface px-4 py-3 ring-1 ring-white/10"
          >
            <p className="text-xs font-medium tracking-wide text-neon uppercase">
              {command.label}
            </p>
            <p className="mt-1 text-sm leading-relaxed">{command.example}</p>
          </li>
        ))}
        <li className="rounded-xl bg-surface px-4 py-3 ring-1 ring-white/10">
          <p className="text-xs font-medium tracking-wide text-neon uppercase">
            This night
          </p>
          <p className="mt-1 text-sm leading-relaxed">
            If you are asked which session, text{" "}
            <span className="font-mono text-cyan">JOIN {slug}</span>
          </p>
        </li>
      </ul>
    </section>
  );
}
