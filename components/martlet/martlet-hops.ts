type TimedFrame = { time: number; transform: string; easing?: string };

export type HopDirection = 1 | -1;

/** A group of one to five hops, followed by a glance, with steps relative to the current heading. */
export function martletHopGroup(viewportWidth: number, limit: number, start: number, direction: HopDirection) {
  const face = `scaleX(${direction})`;
  const track: TimedFrame[] = [{ time: 0, transform: `translateX(${start}px)` }];
  const body: TimedFrame[] = [{ time: 0, transform: face, easing: "ease-out" }];
  const destination = direction === 1 ? limit : 0;
  let time = 0;
  let position = start;
  let facing: HopDirection = direction;
  const hops = 1 + Math.floor(Math.random() * 5);

  const trackPosition = () => ({ time, transform: `translateX(${position}px)` });
  const withinTrack = (x: number) => Math.max(0, Math.min(limit, x));

  for (let hop = 0; hop < hops && position !== destination; hop++) {
    const airtime = 230 + Math.random() * 80;
    const stride = viewportWidth * (0.018 + Math.random() * 0.017);
    const forward = Math.random() < 0.75;
    const next = withinTrack(position + stride * direction * (forward ? 1 : -1));
    const landing = next === position ? withinTrack(position + stride * direction) : next;
    facing = landing > position ? 1 : -1;
    position = landing;
    const hopFace = `scaleX(${facing})`;

    // Start the new pose at takeoff so the sprite never turns in mid-hop.
    body.push(
      { time, transform: hopFace, easing: "ease-out" },
      { time: time + airtime / 2, transform: `translateY(calc(-1 * min(6px, 1.5vh))) ${hopFace}`, easing: "ease-in" },
    );
    time += airtime;
    track.push(trackPosition());
    body.push({ time, transform: hopFace });

    time += 102; // landing pause
    track.push(trackPosition());
    body.push({ time, transform: hopFace });
  }

  const atEdge = position === destination;
  if (!atEdge) {
    const pause = 1140 + Math.random() * 600; // look around before the next group of hops
    body.push(
      { time: time + 160, transform: `scaleX(${facing})`, easing: "steps(1, end)" },
      { time: time + 320, transform: `scaleX(${-facing})`, easing: "steps(1, end)" },
      { time: time + pause - 200, transform: face },
    );
    time += pause;
    track.push(trackPosition());
    body.push({ time, transform: face });
  }

  const keyframes = (frames: TimedFrame[]) => frames.map(({ time: at, ...frame }) => ({ ...frame, offset: at / time }));
  return { track: keyframes(track), body: keyframes(body), duration: time, position, atEdge };
}
