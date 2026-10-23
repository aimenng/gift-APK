import React, { useState, useEffect, useMemo } from 'react';

interface CuteLoadingScreenProps {
  show: boolean;
  text?: string;
}

/* ─── Pixel-art colour palette ─── */
const PX: Record<string, string> = {
  h: '#3d3d3d', // hair – dark charcoal
  s: '#fae8d4', // skin
  e: '#1a1a1a', // eye
  w: '#ffffff', // eye highlight
  b: '#f4a0a0', // blush
  g: '#8a9a5b', // body green
  d: '#6b7a3c', // dark-green (depth arm)
  p: '#e8837c', // scarf pink
  l: '#5a5a5f', // legs / shoes
};

/* ── 2-frame run cycle, 11×15 grid ── */
const FRAMES: string[][] = [
  /* Frame A — right foot forward */
  [
    '...hhhhh..',
    '..hhhhhhh.',
    '.hhhhhhhhh',
    '.hsssssssh',
    '.ssewsewss',
    '.sssssssss',
    '..sbsssbss',
    '...sssss..',
    '..ppppppp.',
    '.dggggggg.',
    '..gggggggd',
    '...ggggg..',
    '....g.g...',
    '...g...gg.',
    '..ll..lll.',
  ],
  /* Frame B — left foot forward */
  [
    '...hhhhh..',
    '..hhhhhhh.',
    '.hhhhhhhhh',
    '.hsssssssh',
    '.ssewsewss',
    '.sssssssss',
    '..sbsssbss',
    '...sssss..',
    '..ppppppp.',
    '..gggggggd',
    '.dggggggg.',
    '...ggggg..',
    '....g.g...',
    '.gg...g...',
    '.lll..ll..',
  ],
];

const P = 5; // pixel size

/** Render a single pixel-art frame as SVG <rect> list */
function renderFrame(grid: string[]) {
  const rects: React.ReactElement[] = [];
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.' && PX[ch]) {
        rects.push(
          <rect key={`${x}-${y}`} x={x * P} y={y * P} width={P} height={P} fill={PX[ch]} />
        );
      }
    });
  });
  return rects;
}

/* ─── Pixel Runner sub-component ─── */
const PixelRunner: React.FC = () => {
  const frameA = useMemo(() => renderFrame(FRAMES[0]), []);
  const frameB = useMemo(() => renderFrame(FRAMES[1]), []);
  const cols = FRAMES[0][0].length;
  const rows = FRAMES[0].length;
  const w = cols * P;
  const h = rows * P;

  return (
    <div className="pixel-runner-stage">
      <svg width={w * 1.6} height={(h + 14) * 1.6} viewBox={`0 0 ${w + 40} ${h + 14}`} xmlns="http://www.w3.org/2000/svg">
        {/* Scrolling ground line */}
        <line x1="0" y1={h + 4} x2={w + 40} y2={h + 4} stroke="#8a9a5b" strokeWidth="1" opacity="0.2" />
        <g className="pixel-ground-marks">
          <rect x="5"  y={h + 3} width="6" height="1.5" rx="0.5" fill="#8a9a5b" opacity="0.15" />
          <rect x="25" y={h + 3} width="8" height="1.5" rx="0.5" fill="#8a9a5b" opacity="0.1" />
          <rect x="50" y={h + 3} width="5" height="1.5" rx="0.5" fill="#8a9a5b" opacity="0.15" />
          <rect x="70" y={h + 3} width="7" height="1.5" rx="0.5" fill="#8a9a5b" opacity="0.1" />
          <rect x="90" y={h + 3} width="6" height="1.5" rx="0.5" fill="#8a9a5b" opacity="0.15" />
        </g>

        {/* Shadow */}
        <ellipse className="pixel-shadow" cx={w / 2 + 20} cy={h + 5} rx={w * 0.35} ry={2.5} fill="#3d3d3d" opacity="0.08" />

        {/* Dust */}
        <circle className="pixel-dust-a" r="2" fill="#8a9a5b" />
        <circle className="pixel-dust-b" r="1.5" fill="#8a9a5b" />

        {/* Character bounce group */}
        <g className="pixel-bounce" transform={`translate(20, 0)`}>
          {/* Frame A — visible during first half of animation */}
          <g className="pixel-frame-a">{frameA}</g>
          {/* Frame B — visible during second half */}
          <g className="pixel-frame-b">{frameB}</g>
        </g>
      </svg>
    </div>
  );
};

/* ─── SVG Vector Runner sub-component ─── */
const SvgRunner: React.FC = () => (
  <div className="runner-stage">
    <svg viewBox="0 0 200 110" xmlns="http://www.w3.org/2000/svg">
      <line x1="0" y1="100" x2="200" y2="100" stroke="#8a9a5b" strokeWidth="1.5" opacity="0.2" />
      <g className="runner-ground-marks">
        <rect x="10" y="99.5" width="12" height="2" rx="1" fill="#8a9a5b" opacity="0.15" />
        <rect x="60" y="99.5" width="16" height="2" rx="1" fill="#8a9a5b" opacity="0.12" />
        <rect x="110" y="99.5" width="10" height="2" rx="1" fill="#8a9a5b" opacity="0.15" />
        <rect x="160" y="99.5" width="14" height="2" rx="1" fill="#8a9a5b" opacity="0.12" />
        <rect x="210" y="99.5" width="12" height="2" rx="1" fill="#8a9a5b" opacity="0.15" />
      </g>
      <ellipse className="runner-shadow" cx="100" cy="101" rx="15" ry="3" fill="#8a9a5b" opacity="0.12" />
      <circle className="runner-dust-a" r="3" fill="#8a9a5b" />
      <circle className="runner-dust-b" r="2.5" fill="#8a9a5b" />
      <circle className="runner-dust-c" r="2" fill="#8a9a5b" />
      <g className="runner-bounce">
        <g className="runner-arm-b">
          <line x1="0" y1="0" x2="0" y2="13" stroke="#6b7a3c" strokeWidth="3.5" strokeLinecap="round" />
        </g>
        <g className="runner-leg-b">
          <line x1="0" y1="0" x2="0" y2="20" stroke="#6b7a3c" strokeWidth="4.5" strokeLinecap="round" />
        </g>
        <ellipse cx="100" cy="68" rx="11" ry="14" fill="#8a9a5b" />
        <g className="runner-leg-f">
          <line x1="0" y1="0" x2="0" y2="20" stroke="#8a9a5b" strokeWidth="4.5" strokeLinecap="round" />
        </g>
        <g className="runner-arm-f">
          <line x1="0" y1="0" x2="0" y2="13" stroke="#8a9a5b" strokeWidth="3.5" strokeLinecap="round" />
        </g>
        <rect x="90" y="53" width="20" height="5" rx="2.5" fill="#e8837c" />
        <path className="runner-scarf-tail" d="M90,55.5 Q82,59 76,55.5 Q70,52 65,56" fill="none" stroke="#e8837c" strokeWidth="4" strokeLinecap="round" />
        <circle cx="100" cy="40" r="14" fill="#fae8d4" />
        <path d="M87,36 Q91,24 100,22 Q109,24 113,36 Q109,30 100,28 Q91,30 87,36Z" fill="#7a8a4b" />
        <g className="runner-blink">
          <ellipse cx="95" cy="40" rx="2" ry="2.2" fill="#3d3d3d" />
          <ellipse cx="105" cy="40" rx="2" ry="2.2" fill="#3d3d3d" />
          <circle cx="96.2" cy="39" r="0.8" fill="white" />
          <circle cx="106.2" cy="39" r="0.8" fill="white" />
        </g>
        <ellipse cx="91" cy="44.5" rx="3" ry="1.5" fill="#e8837c" opacity="0.3" />
        <ellipse cx="109" cy="44.5" rx="3" ry="1.5" fill="#e8837c" opacity="0.3" />
        <path d="M97,46 Q100,49 103,46" fill="none" stroke="#3d3d3d" strokeWidth="1.2" strokeLinecap="round" />
      </g>
    </svg>
  </div>
);

/* ─── Loading texts ─── */
const LOADING_TEXTS = [
  '稍等一下，正在努力奔跑中...',
  '少女祈祷中...',
  '加载中，请稍候...',
  '就快好了，再等等...',
];

/* ─── Main Component ─── */
export const CuteLoadingScreen: React.FC<CuteLoadingScreenProps> = ({ show, text }) => {
  const [scene, setScene] = useState(0); // 0 = pixel, 1 = svg
  const [loadingText, setLoadingText] = useState('');

  useEffect(() => {
    if (!show) return;
    const id = setInterval(() => setScene(s => (s + 1) % 2), 4000);
    return () => clearInterval(id);
  }, [show]);

  // Reset scene when hidden
  useEffect(() => {
    if (!show) setScene(0);
  }, [show]);

  useEffect(() => {
    if (!show) {
      setLoadingText('');
      return;
    }
    setLoadingText(text || LOADING_TEXTS[Math.floor(Math.random() * LOADING_TEXTS.length)]);
  }, [show, text]);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-eye-bg-primary/[0.92] backdrop-blur-sm">
      <div className="cute-loading-card">
        {/* Dual-scene container */}
        <div className="loading-scene-wrap">
          <div className={`loading-scene ${scene === 0 ? 'scene-active' : 'scene-inactive'}`}>
            <PixelRunner />
          </div>
          <div className={`loading-scene ${scene === 1 ? 'scene-active' : 'scene-inactive'}`}>
            <SvgRunner />
          </div>
        </div>
        <p className="cute-loading-text">{loadingText}</p>
      </div>
    </div>
  );
};
