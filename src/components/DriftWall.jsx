import { useMemo } from 'react';
import './DriftWall.css';

/**
 * 纯 CSS 驱动的无缝竖向漂移墙。
 * - 每列内容渲染两份；track 高度 = 2 × (一份内容)。
 * - 用 CSS animation translateY(-50%) 循环，到 -50% 时第二份首项
 *   正好落到第一份首项位置 → 无缝衔接，零 JS 测量、零卡顿。
 * - tile 高度按图片比例自适应（object-fit: contain），海报完整不裁切。
 * - 奇偶列方向相反、速度略错，营造漂流感。
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
}) => {
  const resolvedItems = useMemo(
    () => (Array.isArray(items) && items.length ? items : []),
    [items]
  );

  const columnItems = useMemo(() => {
    const cols = Array.from({ length: columns }, () => []);
    resolvedItems.forEach((item, i) => cols[i % columns].push(item));
    return cols.map((col) => (col.length ? col : resolvedItems.slice(0, 1)));
  }, [resolvedItems, columns]);

  // 每列时长：基础 speed 上按 variance 错开，奇偶列方向相反。
  const columnDurations = useMemo(
    () =>
      columnItems.map((_, c) => {
        const factor = 1 + variance * (((c * 0.6180339887 + 0.35) % 1) * 2 - 1);
        return Math.max(12, (columnItems[c].length * 6) / (speed / 32) * factor);
      }),
    [columnItems, speed, variance]
  );

  const handleTileEnter = (item) => {
    if (typeof onTileActivate === 'function') onTileActivate(item);
  };
  const handleTileLeave = () => {
    if (typeof onTileActivate === 'function') onTileActivate(null);
  };

  const rootClass = ['drift-wall', className].filter(Boolean).join(' ');
  return (
    <div className={rootClass} role="group" aria-label="Drifting wall of tiles">
      {columnItems.map((col, c) => {
        const dir = direction === 'up' ? (c % 2 === 0 ? 'up' : 'down') : c % 2 === 0 ? 'down' : 'up';
        const dur = columnDurations[c];
        return (
          <div className="drift-wall__col" key={`col-${c}`} style={{ '--dw-col-w': `${tileWidth}px` }}>
            <div
              className={`drift-wall__track drift-wall__track--${dir}`}
              style={{ animationDuration: `${dur}s` }}
            >
              {/* 一份内容 */}
              {col.map((item, i) => (
                <div
                  className="drift-wall__tile"
                  key={`a-${c}-${i}`}
                  onMouseEnter={() => handleTileEnter(item)}
                  onMouseLeave={handleTileLeave}
                >
                  <span className="drift-wall__inner">
                    <img src={item.image} alt={item.title ?? ''} loading="lazy" decoding="async" draggable={false} />
                  </span>
                </div>
              ))}
              {/* 完全相同的第二份，保证 -50% 处无缝衔接 */}
              {col.map((item, i) => (
                <div
                  className="drift-wall__tile"
                  key={`b-${c}-${i}`}
                  onMouseEnter={() => handleTileEnter(item)}
                  onMouseLeave={handleTileLeave}
                >
                  <span className="drift-wall__inner">
                    <img src={item.image} alt={item.title ?? ''} loading="lazy" decoding="async" draggable={false} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DriftWall;
