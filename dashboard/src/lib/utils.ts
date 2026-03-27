export const randomFrom = <T>(arr: readonly T[]): T | undefined =>
  arr[Math.floor(Math.random() * arr.length)];

export const randomInt = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min)) + min;

export const randomLatency = (): number => randomInt(800, 4200);

export const fmtTs = (ts: number): string =>
  new Date(ts).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

export const fmtElapsed = (s: number): string =>
  `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
