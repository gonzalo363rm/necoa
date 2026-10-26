import { useMemo } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';

import { formatCompact } from '@/src/lib/analytics';

export type TrendLine = {
  id: string;
  color: string;
  /** Valores ya escalados (monto o %). */
  values: number[];
};

type Props = {
  labels: string[];
  lines: TrendLine[];
  maxValue: number;
  height?: number;
  width?: number;
  formatY?: (v: number) => string;
};

/** Tendencia multi-serie con SVG (estable en web; gifted LineChart se rompe). */
export function MultiLineTrend({
  labels,
  lines,
  maxValue,
  height = 180,
  width = 280,
  formatY = formatCompact,
}: Props) {
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const chartW = Math.max(120, width - padL - padR);
  const chartH = Math.max(80, height - padT - padB);
  const n = Math.max(1, labels.length);
  const max = Math.max(1, maxValue);

  const pointsByLine = useMemo(() => {
    return lines.map((line) => {
      const pts = line.values.map((v, i) => {
        const x = padL + (n <= 1 ? chartW / 2 : (i / (n - 1)) * chartW);
        const y = padT + chartH - (Math.max(0, v) / max) * chartH;
        return { x, y, v };
      });
      return { ...line, pts, polyline: pts.map((p) => `${p.x},${p.y}`).join(' ') };
    });
  }, [lines, n, chartW, chartH, max, padL, padT]);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: padT + chartH * (1 - t),
    label: formatY(max * t),
  }));

  return (
    <View style={{ width }}>
      <View style={{ width, height, position: 'relative' }}>
        <Svg width={width} height={height}>
          {yTicks.map((tick, i) => (
            <Line
              key={`grid-${i}`}
              x1={padL}
              x2={padL + chartW}
              y1={tick.y}
              y2={tick.y}
              stroke="#E2E8F0"
              strokeWidth={1}
            />
          ))}
          <Line
            x1={padL}
            x2={padL}
            y1={padT}
            y2={padT + chartH}
            stroke="#CBD5E1"
            strokeWidth={1}
          />
          <Line
            x1={padL}
            x2={padL + chartW}
            y1={padT + chartH}
            y2={padT + chartH}
            stroke="#CBD5E1"
            strokeWidth={1}
          />

          {pointsByLine.map((line) => (
            <Polyline
              key={`line-${line.id}`}
              points={line.polyline}
              fill="none"
              stroke={line.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}

          {pointsByLine.map((line) =>
            line.pts.map((p, i) => (
              <Circle key={`pt-${line.id}-${i}`} cx={p.x} cy={p.y} r={3} fill={line.color} />
            )),
          )}
        </Svg>

        <View
          pointerEvents="none"
          style={{ position: 'absolute', left: 0, top: 0, width: padL, height }}
        >
          {yTicks.map((tick, i) => (
            <Text
              key={`yl-${i}`}
              style={{
                position: 'absolute',
                top: tick.y - 7,
                right: 4,
                fontSize: 10,
                color: '#94A3B8',
              }}
            >
              {tick.label}
            </Text>
          ))}
        </View>
      </View>

      <View className="mt-1 flex-row" style={{ paddingLeft: padL, paddingRight: padR }}>
        {labels.map((label, i) => (
          <Text
            key={`xl-${i}`}
            className="flex-1 text-center text-[10px] text-ink-500"
            numberOfLines={1}
          >
            {label}
          </Text>
        ))}
      </View>
    </View>
  );
}
