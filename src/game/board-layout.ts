import { colorCount, colorOrder } from './engine';
import type { Game } from './types';
export type Point = [number, number];
export type BoardLayout = {
  width: number;
  height: number;
  track: Point[];
  homes: Record<number, Point[]>;
  reserves: Record<number, Point[]>;
  seams: number[];
};

// Supplied board: two end panels and 0/1/2 removable middle panels.
export function boardLayout(game: Pick<Game, 'players'>): BoardLayout {
  const count = colorCount(game),
    middle = count / 2 - 2,
    width = 584 + middle * 400,
    height = 600;
  const order = colorOrder(game);
  const top: Point[] = [
    [112, 240],
    [112, 200],
    [112, 160],
    [72, 160],
    [32, 160],
    [32, 120],
    [48, 80],
    [80, 56],
    [112, 40],
    [152, 40],
    [192, 40],
    [232, 40],
    [272, 40],
    [272, 80],
    [272, 120],
    [312, 120],
  ];
  const middleSector: Point[] = [
    [0, 0],
    [40, 0],
    [80, 0],
    [80, -40],
    [80, -80],
    [120, -80],
    [160, -80],
    [160, -40],
    [200, -40],
    [240, -40],
    [280, -40],
    [320, -40],
    [320, -80],
    [360, -80],
    [360, -40],
    [360, 0],
  ];
  for (let panel = 0; panel < middle; panel++)
    top.push(...middleSector.map(([x, y]): Point => [x + 352 + panel * 400, y + 120]));
  top.push(
    ...(
      [
        [232, 120],
        [192, 120],
        [152, 120],
        [152, 80],
        [152, 40],
        [112, 40],
        [80, 56],
        [56, 80],
        [32, 120],
        [32, 160],
        [32, 200],
        [32, 240],
        [32, 280],
        [72, 280],
        [112, 280],
        [112, 320],
      ] as Point[]
    ).map(([x, y]): Point => [width - x, y]),
  );
  const mirror = ([x, y]: Point): Point => [width - x, height - y];
  const track = [...top, ...top.map(mirror)],
    homes: Record<number, Point[]> = {},
    reserves: Record<number, Point[]> = {};
  for (let sector = 0; sector < count / 2; sector++) {
    const start = top[sector * 16];
    const home = Array.from({ length: 4 }, (_, i): Point =>
      sector === 0 ? [152, 240 - i * 40] : [start[0] + i * 40, 160],
    );
    const reserve = Array.from({ length: 4 }, (_, i): Point =>
      sector === 0
        ? [63, 210 + i * 20]
        : sector === count / 2 - 1
          ? [width - 192, 210 + i * 20]
          : [start[0] - 30 + i * 20, 210],
    );
    homes[order[sector]] = home;
    reserves[order[sector]] = reserve;
    homes[order[sector + count / 2]] = home.map(mirror);
    reserves[order[sector + count / 2]] = reserve.map(mirror);
  }
  return {
    width,
    height,
    track,
    homes,
    reserves,
    seams: Array.from({ length: middle + 1 }, (_, i) => 292 + i * 400),
  };
}

// Rotate the whole board, including hit targets, so the viewer sits at the bottom.
export function boardOrientation(game: Pick<Game, 'players'>, color: number) {
  const layout = boardLayout(game);
  const sector = colorOrder(game).indexOf(color);
  const half = colorCount(game) / 2;
  const side = sector % half;
  const angle = (side === 0 ? -90 : side === half - 1 ? 90 : 180) + (sector >= half ? 180 : 0);
  const sideways = Math.abs(angle % 180) === 90;
  return {
    angle,
    width: sideways ? layout.height : layout.width,
    height: sideways ? layout.width : layout.height,
  };
}
