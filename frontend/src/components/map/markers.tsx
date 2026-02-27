import type { BikeStation } from "@/lib/types";
import { stationHexColor } from "@/components/map/helpers";

export function PinMarker({ color, size = 40 }: { color: string; size?: number }) {
  const w = Math.round(size * (24 / 36));
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 24 36"
      fill="none"
      style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))" }}
    >
      <path
        d="M12 0C5.372 0 0 5.372 0 12c0 9 12 24 12 24s12-15 12-24C24 5.372 18.628 0 12 0z"
        fill={color}
      />
      <circle cx="12" cy="12" r="4.5" fill="white" />
    </svg>
  );
}

export function BikeStationIcon({
  size = 24,
  selected = false,
  color = "#34a853",
  onClick,
  title,
}: {
  size?: number;
  selected?: boolean;
  color?: string;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <div
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: selected ? "3px solid #1a73e8" : "2px solid white",
        boxShadow: selected
          ? "0 0 0 3px rgba(26,115,232,0.3), 0 2px 4px rgba(0,0,0,0.3)"
          : "0 1px 3px rgba(0,0,0,0.3)",
        cursor: onClick ? "grab" : "pointer",
        transition: "box-shadow 0.15s, border 0.15s, background-color 0.2s",
      }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="5.5" cy="17" r="3.5" />
        <circle cx="18.5" cy="17" r="3.5" />
        <path d="M15 6a1 1 0 100-2 1 1 0 000 2z" fill="white" stroke="none" />
        <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
      </svg>
    </div>
  );
}

export function TrainStationIcon({ size = 22 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "#7b1fa2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="3" width="16" height="13" rx="2" fill="white" fillOpacity="0.2" />
        <line x1="4" y1="11" x2="20" y2="11" />
        <circle cx="8.5" cy="13.5" r="1" fill="white" stroke="none" />
        <circle cx="15.5" cy="13.5" r="1" fill="white" stroke="none" />
        <path d="M9 16l-2 5M15 16l2 5" />
        <line x1="6" y1="21" x2="18" y2="21" />
      </svg>
    </div>
  );
}

function MicroBike({ filled, color }: { filled: boolean; color: string }) {
  return (
    <svg
      width="10"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke={filled ? color : "#d0d0d0"}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <circle cx="5.5" cy="17" r="3.5" />
      <circle cx="18.5" cy="17" r="3.5" />
      <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
    </svg>
  );
}

function DockGrid({ bikes, capacity }: { bikes: number; capacity: number }) {
  const cols = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(capacity * 1.5))));
  const docks: boolean[] = [];
  for (let i = 0; i < capacity; i++) docks.push(i < bikes);
  const color = stationHexColor(bikes, capacity);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "1px",
        padding: "3px 0 1px",
      }}
    >
      {docks.map((filled, i) => (
        <MicroBike key={i} filled={filled} color={color} />
      ))}
    </div>
  );
}

export function RichStationMarker({
  station,
  isSelected,
  onClick,
}: {
  station: BikeStation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const pct = station.bikes / Math.max(station.capacity, 1);
  const color = stationHexColor(station.bikes, station.capacity);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        backgroundColor: "white",
        borderRadius: 8,
        padding: "6px 10px 5px",
        borderLeft: `3px solid ${color}`,
        boxShadow: isSelected
          ? "0 0 0 2px #1a73e8, 0 2px 8px rgba(0,0,0,0.25)"
          : "0 1px 4px rgba(0,0,0,0.3)",
        cursor: "grab",
        minWidth: 72,
        maxWidth: 160,
        transition: "box-shadow 0.15s",
        userSelect: "none" as const,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 2,
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="5.5" cy="17" r="3.5" />
          <circle cx="18.5" cy="17" r="3.5" />
          <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
        </svg>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "#202124",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 120,
            lineHeight: "14px",
          }}
        >
          {station.name}
        </span>
      </div>
      <DockGrid bikes={station.bikes} capacity={station.capacity} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 2,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 3,
            borderRadius: 1.5,
            background: "#e0e0e0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct * 100}%`,
              background: color,
              borderRadius: 1.5,
              transition: "width 0.2s",
            }}
          />
        </div>
        <span
          style={{
            fontSize: 10,
            color: "#5f6368",
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {station.bikes}/{station.capacity}
        </span>
      </div>
    </div>
  );
}
