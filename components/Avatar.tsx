const COLORS = ["#FF5A5F", "#FFB400", "#2EC4B6", "#4CC9F0", "#E63E9B", "#6BD968", "#F77F00", "#7B6CF6"];

export function avatarColor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

/** Colored circle with the member's initial. The color is stable per member id. */
export function Avatar({
  id,
  name,
  size = 28,
  ring = false,
}: {
  id: string;
  name: string;
  size?: number;
  ring?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold text-white shadow-sm ${
        ring ? "ring-2 ring-offset-2 ring-offset-white ring-yellow-400 dark:ring-offset-zinc-900" : ""
      }`}
      style={{ width: size, height: size, background: avatarColor(id), fontSize: size * 0.45 }}
    >
      <span aria-hidden="true">{(name || id).slice(0, 1).toUpperCase()}</span>
    </span>
  );
}

/** Overlapping avatars; members in `highlight` get a gold ring. */
export function AvatarStack({
  ids,
  names,
  highlight = [],
  max = 8,
  size = 26,
}: {
  ids: string[];
  names: Record<string, string>;
  highlight?: string[];
  max?: number;
  size?: number;
}) {
  const shown = ids.slice(0, max);
  const more = ids.length - shown.length;
  return (
    <div className="flex items-center" aria-label={`${ids.length} members free`}>
      {shown.map((id, i) => (
        <span key={id} className="-ml-1.5 first:ml-0" style={{ zIndex: shown.length - i }}>
          <Avatar id={id} name={names[id] ?? id} size={size} ring={highlight.includes(id)} />
        </span>
      ))}
      {more > 0 && <span className="ml-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">+{more}</span>}
    </div>
  );
}
