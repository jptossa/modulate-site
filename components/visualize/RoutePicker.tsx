"use client";

import { Chip } from "@/components/ds";
import { RouteKey, route } from "@/components/ds/shared";
import type { OriginGroup } from "@/lib/visualize/data";

export const MAX_COMPARED = 3;

export interface RoutePickerProps {
  groups: OriginGroup[];
  originIndex: number;
  onOriginChange: (index: number) => void;
  /** Ids of the compared routes, in route order (route 1, 2, 3). */
  selectedIds: string[];
  onToggle: (id: string) => void;
}

/** Origin chips (when there is more than one) and a pick of up to three of that origin's destinations. */
export function RoutePicker({ groups, originIndex, onOriginChange, selectedIds, onToggle }: RoutePickerProps) {
  const group = groups[originIndex];
  return (
    <div className="vz-picker">
      {groups.length > 1 ? (
        <div className="vz-picker-block">
          <span id="vz-origin-label" className="eyebrow">
            Pick where you start
          </span>
          <div className="md-row" role="group" aria-labelledby="vz-origin-label">
            {groups.map((g, i) => (
              <Chip key={g.origin.soc} selected={i === originIndex} onClick={() => onOriginChange(i)}>
                {`${g.origin.title} (${g.routes.length})`}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      <div className="vz-picker-block">
        <span id="vz-routes-label" className="eyebrow">
          {`Compare up to ${MAX_COMPARED} routes from ${group.origin.title}`}
        </span>
        <div className="md-row" role="group" aria-labelledby="vz-routes-label">
          {group.routes.map((r) => {
            const position = selectedIds.indexOf(r.id);
            const selected = position !== -1;
            return (
              <Chip key={r.id} selected={selected} onClick={() => onToggle(r.id)}>
                <span className="vz-chip-label">
                  {selected ? <RouteKey index={position} color={route(position).light} /> : null}
                  {r.destination.title}
                </span>
              </Chip>
            );
          })}
        </div>
      </div>
    </div>
  );
}
