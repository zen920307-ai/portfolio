import { useMemo, useRef, useState, useLayoutEffect } from 'react';
import './DriftWall.css';

/**
 * 无缝竖向漂移墙。
 * - 每列内容渲染两份；track 用 CSS animation 平移「一份内容的像素高度」。
 * - 到位后瞬间回到起点，因第二份与第一份完全相同 → 无缝衔接。
 * - 用像素值而非百分比，避免每帧重算基准 → 不卡顿。
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
  const [travels, setTravels] = useState([]);

  const resolvedItems = useMemo(
    () => (Array.isArray(items) && items.length ? items : []),
    [items]
  );

  const columnItems = useMemo(() => {
    const cols = Array.from({ length: columns }, () => []);
    resolvedItems.forEach((item, i) => cols[i % columns].push(item));
    return cols.map((col) => (col.length ? col : resolvedItems.slice(0, 1)));
  }, [resolvedItems, columns]);

  // 每列时长：基础 speed 上按 variance 错开。
  const columnDurations = useMemo(
    () =>
      columnItems.map((col, c) => {
        const factor = 1 + variance * (((c * 0.6180339887 + 0.35) % 1) * 2 - 1);
        return Math.max(14, (col.length * 4.5) * factor);
      }),
    [columnItems, variance]
  );

  // 测量每列「一份内容」的像素高度，供 CSS 动画用像素平移。
  useLayoutEffect(() => {
    const measure = () => {
      const vals = trackRefs.current.map((el) => {
        if (!el) return 0;
        // track 含两份内容 + 一个 gap，一份高度 = (scrollHeight - gap) / 2
        const gapPx = parseFloat(getComputedStyle(el).rowGap) || 0;
        return Math.max(1, (el.scrollHeight - gapPx) / 2);
      });
      setTravels(vals);
    };
    measure();
    // 图片加载后高度变化，重新测量。
    const imgs = containerRef.current?.querySelectorAll('img') || [];
    const onLoad = () => measure();
    imgs.forEach((img) => {
      if (img.complete) onLoad();
      else img.addEventListener('load', onLoad, { once: true });
    });
    const ro = new ResizeObserver(measure);
    trackRefs.current.forEach((el) => el && ro.observe(el));
    return () => {
      ro.disconnect();
      imgs.forEach((img) => img.removeEventListener('load', onLoad));
    };
  }, [columnItems]);

  const handleTileEnter = (item) => {
    if (typeof onTileActivate === 'function') onTileActivate(item);
  };
  const handleTileLeave = () => {
    if (typeof onTileActivate === 'function') onTileActivate(null);
  };
  const handleTileOpen = (item) => {
    if (typeof onOpen === 'function') onOpen(item);
  };

  const rootClass = ['drift-wall', className].filter(Boolean).join(' ');
  return (
    <div className={rootClass} ref={containerRef} role="group" aria-label="Drifting wall of tiles">
      {columnItems.map((col, c) => {
        const dir = direction === 'up' ? (c % 2 === 0 ? 'up' : 'down') : c % 2 === 0 ? 'down' : 'up';
        const dur = columnDurations[c];
        const travel = travels[c] || 0;
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
              onClick={() => handleTileOpen(item)}
              aria-label={item.title ?? `作品 ${i + 1}`}
            >
              <span className="drift-wall__inner">
                <img src={item.image} alt={item.title ?? ''} loading="lazy" decoding="async" draggable={false} />
                <span className="drift-wall__caption">
                  {item.type ? <small>{item.type}</small> : null}
                  <strong>{item.title ?? ''}</strong>
                </span>
              </span>
            </button>
          ));
        return (
          <div className="drift-wall__col" key={`col-${c}`} style={{ '--dw-col-w': `${tileWidth}px` }}>
            <div
              className={`drift-wall__track drift-wall__track--${dir}`}
              ref={(el) => { trackRefs.current[c] = el; }}
              style={{
                animationDuration: `${dur}s`,
                // 测量完成前用 0（不动），测量后用像素值，避免百分比卡顿。
                ['--dw-travel']: `${travel}px`,
              }}
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
