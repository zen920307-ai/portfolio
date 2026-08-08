import { useMemo, useRef, useLayoutEffect } from 'react';
import './DriftWall.css';

/**
 * 无缝竖向漂移墙。
 * - 每列先补足为高于视口的循环单元，再渲染两份完全相同的内容。
 * - Web Animations 保持连续时间轴，不通过重设 CSS 动画触发跳帧。
 * - tile 高度按图片比例自适应（object-fit: contain），海报完整不裁切。
 * - 奇偶列方向相反、速度略错，营造漂流感。
 * - 每张图可点击查看，底部显示标题/类型。
 */
const DriftWall = ({
  items,
  columns = 3,
  tileWidth = 220,
  gap = 16,
  radius = 8,
  speed = 32,
  direction = 'up',
  variance = 0.3,
  className = '',
  onTileActivate = null,
  onOpen = null,
}) => {
  const containerRef = useRef(null);
  const trackRefs = useRef([]);
  const animationRefs = useRef([]);

  const resolvedItems = useMemo(
    () => (Array.isArray(items) && items.length ? items : []),
    [items]
  );

  const columnItems = useMemo(() => {
    const cols = Array.from({ length: columns }, () => []);
    resolvedItems.forEach((item, i) => cols[i % columns].push(item));
    return cols.map((col) => (col.length ? col : resolvedItems.slice(0, 1)));
  }, [resolvedItems, columns]);

  const loopUnits = useMemo(() => columnItems.map((col) => {
    const repeats = Math.max(1, Math.ceil(12 / col.length));
    return Array.from({ length: repeats }, () => col).flat();
  }), [columnItems]);

  // 等图片加载完成后再启动；循环过程中不再改终点或重启动画。
  useLayoutEffect(() => {
    let disposed = false;
    let frameId;
    const tracks = trackRefs.current.filter(Boolean);
    const images = tracks.flatMap((track) => Array.from(track.querySelectorAll('img')));
    const ready = images.map((img) => img.complete
      ? Promise.resolve()
      : new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true });
          img.addEventListener('error', resolve, { once: true });
        }));

    Promise.all(ready).then(() => {
      if (disposed) return;
      frameId = requestAnimationFrame(() => {
        if (disposed) return;
        animationRefs.current = tracks.map((track, c) => {
          const dir = direction === 'up' ? (c % 2 === 0 ? 'up' : 'down') : c % 2 === 0 ? 'down' : 'up';
          const factor = 1 + variance * (((c * 0.6180339887 + 0.35) % 1) * 2 - 1);
          const loopDistance = Math.max(track.scrollHeight / 2, 1);
          const duration = Math.max(30000, (loopDistance / Math.max(speed * factor, 8)) * 1000);
          const frames = dir === 'up'
            ? [{ transform: 'translate3d(0,0,0)' }, { transform: 'translate3d(0,-50%,0)' }]
            : [{ transform: 'translate3d(0,-50%,0)' }, { transform: 'translate3d(0,0,0)' }];
          return track.animate(frames, { duration, iterations: Infinity, easing: 'linear' });
        });
      });
    });

    return () => {
      disposed = true;
      if (frameId) cancelAnimationFrame(frameId);
      animationRefs.current.forEach((animation) => animation?.cancel());
      animationRefs.current = [];
    };
  }, [loopUnits, direction, speed, variance]);

  const handleTileEnter = (item) => {
    if (typeof onTileActivate === 'function') onTileActivate(item);
  };
  const handleTileLeave = () => {
    if (typeof onTileActivate === 'function') onTileActivate(null);
  };
  const handleTileOpen = (item) => {
    if (typeof onOpen === 'function') onOpen(item);
  };
  const pauseWall = (event) => {
    animationRefs.current.forEach((animation) => animation?.pause());
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };
  const resumeWall = (event) => {
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    requestAnimationFrame(() => {
      animationRefs.current.forEach((animation) => animation?.play());
    });
  };

  const rootClass = ['drift-wall', className].filter(Boolean).join(' ');
  return (
    <div className={rootClass} ref={containerRef} role="group" aria-label="Drifting wall of tiles">
      {loopUnits.map((col, c) => {
        const renderOne = (prefix) =>
          col.map((item, i) => (
            <button
              type="button"
              className="drift-wall__tile"
              key={`${prefix}-${c}-${i}`}
              onMouseEnter={() => handleTileEnter(item)}
              onMouseLeave={handleTileLeave}
              onFocus={() => handleTileEnter(item)}
              onBlur={handleTileLeave}
              onPointerDown={pauseWall}
              onPointerUp={resumeWall}
              onPointerCancel={resumeWall}
              onClick={() => handleTileOpen(item)}
              aria-label={item.title ?? `作品 ${i + 1}`}
            >
              <span className="drift-wall__inner">
                <img src={item.image} alt={item.title ?? ''} loading="eager" decoding="async" draggable={false} />
                <span className="drift-wall__caption">
                  {item.type ? <small>{item.type}</small> : null}
                  <strong>{item.title ?? ''}</strong>
                </span>
              </span>
            </button>
          ));
        return (
          <div
            className="drift-wall__col"
            key={`col-${c}`}
            style={{ '--dw-col-w': `${tileWidth}px` }}
          >
            <div
              className="drift-wall__track"
              ref={(el) => { trackRefs.current[c] = el; }}
            >
              {renderOne('a')}
              {renderOne('b')}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DriftWall;
