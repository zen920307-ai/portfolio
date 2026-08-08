import { useRef, useState, useCallback, useEffect } from 'react';
import './TiltedCard.css';

/**
 * TiltedCard (React Bits style) — pure React + rAF, no `motion` dependency.
 * Supports either classic image mode, or full custom `children` (whole card tilts).
 */
export default function TiltedCard({
  imageSrc,
  altText = 'Tilted card image',
  captionText = '',
  containerHeight = '300px',
  containerWidth = '100%',
  imageHeight = '300px',
  imageWidth = '300px',
  scaleOnHover = 1.1,
  rotateAmplitude = 14,
  showMobileWarning = true,
  showTooltip = true,
  overlayContent = null,
  displayOverlayContent = false,
  children = null,
  onClick,
  className = '',
}) {
  const ref = useRef(null);
  const innerRef = useRef(null);
  const captionRef = useRef(null);
  const rafRef = useRef(0);
  const targetRef = useRef({
    rotateX: 0,
    rotateY: 0,
    scale: 1,
    captionX: 0,
    captionY: 0,
    captionOpacity: 0,
    captionRotate: 0,
  });
  const currentRef = useRef({ ...targetRef.current });
  const lastYRef = useRef(0);
  const [hovering, setHovering] = useState(false);

  useEffect(() => () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const tick = useCallback(() => {
    const current = currentRef.current;
    const target = targetRef.current;
    const ease = 0.14;

    current.rotateX += (target.rotateX - current.rotateX) * ease;
    current.rotateY += (target.rotateY - current.rotateY) * ease;
    current.scale += (target.scale - current.scale) * ease;
    current.captionX += (target.captionX - current.captionX) * ease;
    current.captionY += (target.captionY - current.captionY) * ease;
    current.captionOpacity += (target.captionOpacity - current.captionOpacity) * ease;
    current.captionRotate += (target.captionRotate - current.captionRotate) * ease;

    if (innerRef.current) {
      innerRef.current.style.transform =
        `rotateX(${current.rotateX.toFixed(3)}deg) rotateY(${current.rotateY.toFixed(3)}deg) scale(${current.scale.toFixed(4)})`;
    }
    if (captionRef.current) {
      captionRef.current.style.transform =
        `translate3d(${current.captionX.toFixed(1)}px, ${current.captionY.toFixed(1)}px, 0) rotate(${current.captionRotate.toFixed(2)}deg)`;
      captionRef.current.style.opacity = String(Math.max(0, Math.min(1, current.captionOpacity)));
    }

    const stillMoving =
      Math.abs(target.rotateX - current.rotateX) > 0.02 ||
      Math.abs(target.rotateY - current.rotateY) > 0.02 ||
      Math.abs(target.scale - current.scale) > 0.001 ||
      Math.abs(target.captionOpacity - current.captionOpacity) > 0.01 ||
      Math.abs(target.captionX - current.captionX) > 0.2 ||
      Math.abs(target.captionY - current.captionY) > 0.2 ||
      Math.abs(target.captionRotate - current.captionRotate) > 0.05;

    if (stillMoving) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      rafRef.current = 0;
    }
  }, []);

  const schedule = useCallback(() => {
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }
  }, [tick]);

  function handleMouse(e) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - rect.width / 2;
    const offsetY = e.clientY - rect.top - rect.height / 2;
    const rotationX = (offsetY / (rect.height / 2 || 1)) * -rotateAmplitude;
    const rotationY = (offsetX / (rect.width / 2 || 1)) * rotateAmplitude;
    const velocityY = offsetY - lastYRef.current;
    lastYRef.current = offsetY;

    targetRef.current.rotateX = rotationX;
    targetRef.current.rotateY = rotationY;
    targetRef.current.captionX = e.clientX - rect.left;
    targetRef.current.captionY = e.clientY - rect.top;
    targetRef.current.captionRotate = -velocityY * 0.6;
    schedule();
  }

  function handleMouseEnter() {
    setHovering(true);
    targetRef.current.scale = scaleOnHover;
    targetRef.current.captionOpacity = 1;
    schedule();
  }

  function handleMouseLeave() {
    setHovering(false);
    targetRef.current.rotateX = 0;
    targetRef.current.rotateY = 0;
    targetRef.current.scale = 1;
    targetRef.current.captionOpacity = 0;
    targetRef.current.captionRotate = 0;
    schedule();
  }

  const hasChildren = children != null;

  return (
    <figure
      ref={ref}
      className={`tilted-card-figure${hasChildren ? ' tilted-card-figure--content' : ''}${className ? ` ${className}` : ''}${hovering ? ' is-hovering' : ''}`}
      style={{
        height: containerHeight,
        width: containerWidth,
      }}
      onMouseMove={handleMouse}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick(e);
        }
      } : undefined}
    >
      {showMobileWarning && (
        <div className="tilted-card-mobile-alert">This effect is not optimized for mobile. Check on desktop.</div>
      )}
      <div
        ref={innerRef}
        className="tilted-card-inner"
        style={hasChildren ? undefined : {
          width: imageWidth,
          height: imageHeight,
        }}
      >
        {hasChildren ? (
          children
        ) : (
          <>
            <img
              src={imageSrc}
              alt={altText}
              className="tilted-card-img"
              style={{
                width: imageWidth,
                height: imageHeight,
              }}
              draggable={false}
            />
            {displayOverlayContent && overlayContent && (
              <div className="tilted-card-overlay">{overlayContent}</div>
            )}
          </>
        )}
      </div>
      {showTooltip && captionText ? (
        <figcaption ref={captionRef} className="tilted-card-caption">
          {captionText}
        </figcaption>
      ) : null}
    </figure>
  );
}
