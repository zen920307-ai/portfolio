import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './DriftWall.css';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const columnFactor = (index, variance) => {
  const pseudo = ((index * 0.6180339887 + 0.35) % 1) * 2 - 1;
  return 1 + variance * pseudo;
};

const DriftWall = ({
  items,
  columns = 3,
  tileWidth = 220,
  gap = 16,
  radius = 8,
  tilt = 6,
  turn = -4,
  roll = 0,
  perspective = 1400,
  depth = 60,
  speed = 32,
  direction = 'up',
  variance = 0.3,
  parallax = 0.4,
  pauseOnHover = false,
  lift = 48,
  className = '',
  onTileActivate = null,
  style
}) => {
  const containerRef = useRef(null);
  const planeRef = useRef(null);
  const trackRefs = useRef([]);
  const rafRef = useRef(null);
  const offsetsRef = useRef([]);
  const velocitiesRef = useRef([]);
  const hoveredColRef = useRef(-1);
  const wallHoveredRef = useRef(false);
  const pointerRef = useRef({ x: 0, y: 0 });
  const pointerDampedRef = useRef({ x: 0, y: 0 });
  const lastTsRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const activeIdRef = useRef(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(prefersReducedMotion());
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedItems = useMemo(
    () => (Array.isArray(items) && items.length ? items : []),
    [items]
  );

  // Deal items into N columns round-robin.
  const columnItems = useMemo(() => {
    const cols = Array.from({ length: columns }, () => []);
    resolvedItems.forEach((item, i) => cols[i % columns].push(item));
    return cols.map((col) => (col.length ? col : resolvedItems.slice(0, 1)));
  }, [resolvedItems, columns]);

  const baseVelocities = useMemo(() => {
    const dirSign = direction === 'up' ? 1 : -1;
    return columnItems.map((_, c) => {
      const altSign = c % 2 === 0 ? 1 : -1;
      return speed * columnFactor(c, variance) * dirSign * altSign;
    });
  }, [columnItems, speed, direction, variance]);

  // Each column renders its items TWICE back-to-back. The track height is then
  // exactly 2 × (one set). Translating by -half lands copy 2's first item
  // exactly under copy 1's first item → seamless infinite loop, no seam, no
  // blank jump. We measure half via scrollHeight at runtime so tile height can
  // be fully driven by image aspect ratio (object-fit: contain, no cropping).
  const halfHeightsRef = useRef([]);

  const measureHalves = useCallback(() => {
    halfHeightsRef.current = trackRefs.current.map((el) => {
      if (!el) return 1;
      const full = el.scrollHeight || 1;
      return full / 2 || 1;
    });
  }, []);

  useLayoutEffect(() => {
    measureHalves();
    const ro = new ResizeObserver(measureHalves);
    trackRefs.current.forEach((el) => el && ro.observe(el));
    // Re-measure after images load (heights change).
    const imgs = containerRef.current?.querySelectorAll('img') || [];
    const onLoad = () => measureHalves();
    imgs.forEach((img) => {
      if (img.complete) onLoad();
      else img.addEventListener('load', onLoad, { once: true });
    });
    return () => {
      ro.disconnect();
      imgs.forEach((img) => img.removeEventListener('load', onLoad));
    };
  }, [measureHalves, columnItems]);

  useEffect(() => {
    offsetsRef.current = columnItems.map(() => 0);
    velocitiesRef.current = columnItems.map(() => 0);
  }, [columnItems]);

  const applyPlaneTransform = useCallback(
    (px, py) => {
      const plane = planeRef.current;
      if (!plane) return;
      plane.style.transform =
        `translate(-50%, -50%) ` +
        `rotateX(${tilt + py}deg) rotateY(${turn + px}deg) rotateZ(${roll}deg) ` +
        `translateZ(${-depth}px)`;
    },
    [tilt, turn, roll, depth]
  );

  useEffect(() => {
    const animate = (ts) => {
      if (lastTsRef.current === null) lastTsRef.current = ts;
      const dt = Math.min(0.05, Math.max(0, ts - lastTsRef.current) / 1000);
      lastTsRef.current = ts;
      const maxTilt = parallax * 8;
      const targetX = pointerRef.current.x * maxTilt;
      const targetY = -pointerRef.current.y * maxTilt;
      const damp = 1 - Math.exp(-dt / 0.12);
      pointerDampedRef.current.x += (targetX - pointerDampedRef.current.x) * damp;
      pointerDampedRef.current.y += (targetY - pointerDampedRef.current.y) * damp;
      applyPlaneTransform(pointerDampedRef.current.x, pointerDampedRef.current.y);

      if (!reduced) {
        for (let c = 0; c < trackRefs.current.length; c++) {
          const half = halfHeightsRef.current[c] || 1;
          const paused = wallHoveredRef.current && pauseOnHover;
          const factor = paused || hoveredColRef.current === c ? 0 : 1;
          const target = baseVelocities[c] * factor;
          const ease = 1 - Math.exp(-dt / (target === 0 ? 0.16 : 0.28));
          velocitiesRef.current[c] += (target - velocitiesRef.current[c]) * ease;
          let next = (offsetsRef.current[c] ?? 0) + velocitiesRef.current[c] * dt;
          // Wrap within [-half, 0] so the second copy always covers the gap.
          next = ((next % half) + half) % half;
          offsetsRef.current[c] = next;
          const el = trackRefs.current[c];
          if (el) el.style.transform = `translate3d(0, ${-next}px, 0)`;
        }
      }
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    };
  }, [baseVelocities, pauseOnHover, parallax, reduced, applyPlaneTransform]);

  const activate = useCallback(
    (id, index, item) => {
      activeIdRef.current = id;
      hoveredColRef.current = index;
      setActiveId(id);
      if (typeof onTileActivate === 'function') onTileActivate(item);
    },
    [onTileActivate]
  );

  const release = useCallback(() => {
    activeIdRef.current = null;
    hoveredColRef.current = -1;
    setActiveId(null);
    if (typeof onTileActivate === 'function') onTileActivate(null);
  }, [onTileActivate]);

  const handlePointerMove = useCallback(
    (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (parallax > 0 && !reduced) {
        pointerRef.current = {
          x: (e.clientX - rect.left) / rect.width - 0.5,
          y: (e.clientY - rect.top) / rect.height - 0.5,
        };
      }
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const tile = hit && hit.closest ? hit.closest('[data-tile-id]') : null;
      if (!tile) return;
      const id = tile.dataset.tileId;
      if (id === activeIdRef.current) return;
      const col = Number(tile.dataset.col);
      const itemIndex = Number(tile.dataset.itemIndex);
      const item = columnItems[col]?.[itemIndex % columnItems[col].length];
      activate(id, col, item);
    },
    [parallax, reduced, columnItems, activate]
  );

  const handlePointerLeaveWall = useCallback(() => {
    wallHoveredRef.current = false;
    pointerRef.current = { x: 0, y: 0 };
    release();
  }, [release]);

  const cssVars = useMemo(
    () => ({
      '--dw-tile-w': `${tileWidth}px`,
      '--dw-gap': `${gap}px`,
      '--dw-radius': `${radius}px`,
      '--dw-perspective': `${perspective}px`,
      '--dw-lift': `${lift}px`,
      ...style,
    }),
    [tileWidth, gap, radius, perspective, lift, style]
  );

  const renderTile = (item, id, colIndex, itemIndex) => {
    const inner = (
      <span className="drift-wall__inner">
        <img src={item.image} alt={item.title ?? ''} loading="lazy" decoding="async" draggable={false} />
      </span>
    );
    const commonProps = {
      className: `drift-wall__tile${activeId === id ? ' is-active' : ''}`,
      'data-tile-id': id,
      'data-col': colIndex,
      'data-item-index': itemIndex,
      onFocus: () => activate(id, colIndex, item),
      onBlur: release,
    };
    if (item.href) {
      return (
        <a key={id} href={item.href} target="_blank" rel="noreferrer noopener" {...commonProps}>
          {inner}
        </a>
      );
    }
    return (
      <div key={id} tabIndex={0} role="button" aria-label={item.title ?? 'tile'} {...commonProps}>
        {inner}
      </div>
    );
  };

  const rootClass = ['drift-wall', reduced ? 'drift-wall--reduced' : '', className].filter(Boolean).join(' ');
  return (
    <div
      ref={containerRef}
      className={rootClass}
      style={cssVars}
      onPointerMove={handlePointerMove}
      onPointerEnter={() => { wallHoveredRef.current = true; }}
      onPointerLeave={handlePointerLeaveWall}
      role="group"
      aria-label="Drifting wall of tiles"
    >
      <div ref={planeRef} className="drift-wall__plane">
        {columnItems.map((col, c) => (
          <div className="drift-wall__col" key={`col-${c}`}>
            <div className="drift-wall__track" ref={(el) => { trackRefs.current[c] = el; }}>
              {/* Copy 1 */}
              {col.map((item, i) => renderTile(item, `${c}-0-${i}`, c, i))}
              {/* Copy 2 — identical, so -half snaps seamlessly onto 0 */}
              {col.map((item, i) => renderTile(item, `${c}-1-${i}`, c, i))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DriftWall;
