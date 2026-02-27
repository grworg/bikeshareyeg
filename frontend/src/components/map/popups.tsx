import type { BikeStation } from "@/lib/types";
import { FACTOR_LABELS, type HexScore } from "@/lib/suitability";
import { stationHexColor, FACTOR_COLORS, PATHABLE_FACTORS } from "@/components/map/helpers";

export function HexPopupContent({
  h3Id,
  score,
  proxFactor,
  activePathFactor,
  loadingFactor,
  onFactorClick,
}: {
  h3Id: string;
  score: HexScore;
  proxFactor: number;
  activePathFactor: string | null;
  loadingFactor: string | null;
  onFactorClick: (factorKey: string) => void;
}) {
  const pct = (n: number) => Math.round(n * 100);

  return (
    <div className="px-3.5 py-3">
      <div className="text-[13px] font-semibold mb-1">
        Suitability: {pct(score.overall)}%
      </div>
      <div className="text-[11px] text-[var(--color-secondary)] leading-relaxed space-y-0.5">
        {Object.entries(FACTOR_LABELS).map(([key, label]) => {
          const fr = score.factors[key];
          if (!fr) return null;
          const isPathable = PATHABLE_FACTORS.has(key);
          const isActive = activePathFactor === key;
          const isLoading = loadingFactor === key;
          const color = FACTOR_COLORS[key] ?? "#5f6368";

          return (
            <div
              key={key}
              className={`flex items-center gap-1 rounded px-1 -mx-1 ${
                isPathable
                  ? "cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
                  : ""
              } ${isActive ? "bg-[var(--color-active-bg)]" : ""}`}
              onClick={isPathable ? () => onFactorClick(key) : undefined}
              title={isPathable ? `Show route to nearest ${label.toLowerCase()}` : undefined}
            >
              {isPathable && (
                <span className="flex-none w-3 text-center">
                  {isLoading ? (
                    <span className="inline-block w-2 h-2 border border-[#9aa0a6] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg
                      width="10"
                      height="10"
                      viewBox="0 0 16 16"
                      fill={isActive ? color : "#9aa0a6"}
                      className="inline-block"
                    >
                      <path d="M8 0C5.2 0 3 2.2 3 5c0 3.5 5 9.5 5 9.5s5-6 5-9.5C13 2.2 10.8 0 8 0zm0 7c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
                    </svg>
                  )}
                </span>
              )}
              <span className={isActive ? "font-medium" : ""}>
                {label}: {pct(fr.score)}%
              </span>
              {fr.extra && (
                <span className="text-[var(--color-secondary)] ml-auto text-[10px]">
                  {fr.extra}
                </span>
              )}
            </div>
          );
        })}
        {proxFactor < 0.99 && (
          <div className="mt-1 pt-1 border-t border-[var(--color-border)]">
            Station modifier:{" "}
            <span
              className="font-semibold"
              style={{ color: proxFactor < 0.7 ? "#e53935" : "#fb8c00" }}
            >
              ×{proxFactor.toFixed(2)}
            </span>
          </div>
        )}
      </div>
      {activePathFactor && (
        <div className="mt-1.5 pt-1.5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-secondary)]">
          Click factor again to hide route
        </div>
      )}
    </div>
  );
}

export function StationPopupContent({
  station,
  designerMode,
  onDelete,
}: {
  station: BikeStation;
  designerMode: boolean;
  onDelete?: () => void;
}) {
  const pct = station.bikes / Math.max(station.capacity, 1);
  const color = stationHexColor(station.bikes, station.capacity);

  return (
    <div className="px-3.5 py-3">
      <div className="flex items-center gap-2 mb-2 pr-5">
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="5.5" cy="17" r="3.5" />
          <circle cx="18.5" cy="17" r="3.5" />
          <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
        </svg>
        <span className="text-[13px] font-medium text-[var(--color-fg)] truncate">
          {station.name}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px] text-[var(--color-secondary)] mb-2">
        <span>{station.bikes} bikes</span>
        <span>{station.capacity - station.bikes} docks free</span>
        <span>{station.capacity} total</span>
      </div>
      <div className="h-[4px] rounded-full bg-[var(--color-border)] overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-[10px] text-[var(--color-secondary)] mb-1">
        ID: {station.id}
      </div>
      {onDelete && (
        <button
          onClick={onDelete}
          className="mt-1 w-full text-[12px] font-medium text-[#d32f2f] bg-[#fde7e7] hover:bg-[#fbc8c8] rounded-md py-1.5 transition-colors"
        >
          Delete Station
        </button>
      )}
    </div>
  );
}
