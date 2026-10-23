import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';

interface AnimatedAvatarShowcaseProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CartoonAvatarDef {
  id: string;
  name: string;
  subtitle: string;
  accent: string;
  tags: string[];
}

interface CartoonStageTheme {
  top: string;
  bottom: string;
  halo: string;
  floor: string;
  shadow: string;
}

const CARTOON_AVATARS: CartoonAvatarDef[] = [
  {
    id: 'cartoon-original',
    name: '小兰·原版',
    subtitle: '抱臂站姿 · 圆框墨镜',
    accent: 'from-[#4a2a1a] to-[#6b3f2a]',
    tags: ['🕶️ 圆框墨镜', '🧥 印花白夹克', '💇 棕色长发', '👜 黑色挎包', '👖 阔腿裤', '💪 抱臂酷姿'],
  },
  {
    id: 'cartoon-doll',
    name: '小兰·玩偶',
    subtitle: '3D 公仔版 · Q萌大头',
    accent: 'from-[#8b5a3c] to-[#b27655]',
    tags: ['🕶️ 大圆墨镜', '🧥 白色夹克', '💇 中分直发', '👜 斜挎小包', '👖 白色阔腿裤', '👂 Q萌大头'],
  },
  {
    id: 'cartoon-travel',
    name: '小兰·旅行',
    subtitle: '藏蓝西装 · 粉围巾行李箱',
    accent: 'from-[#3a4a60] to-[#e8a0a8]',
    tags: ['🕶️ 圆框墨镜', '🧣 粉色围巾', '💼 藏蓝西装', '🧳 橙色行李箱', '👧 短发波浪卷', '😆 开怀大笑'],
  },
  {
    id: 'cartoon-winter',
    name: '小兰·冬日',
    subtitle: '红帽羽绒 · 暖手微笑',
    accent: 'from-[#c82030] to-[#a01828]',
    tags: ['🧶 红色毛线帽', '🧥 红色羽绒服', '😌 闭眼微笑', '🙏 双手暖手', '💇 棕色长发', '☺️ 红扑扑脸蛋'],
  },
  {
    id: 'cartoon-cool',
    name: '小兰·酷飒',
    subtitle: '扶框墨镜 · 拉箱出发',
    accent: 'from-[#3a4a60] to-[#e8a0a8]',
    tags: ['🕶️ 扶框墨镜', '🧣 粉色围巾', '💼 藏蓝西装', '🧳 橙色行李箱', '👩 短发波浪卷', '😆 张嘴大笑'],
  },
];

const CARTOON_STAGE_THEMES: Record<string, CartoonStageTheme> = {
  'cartoon-original': {
    top: '#fff4ea',
    bottom: '#f2e2d2',
    halo: '#f3c8a9',
    floor: '#c89e81',
    shadow: '#6d422d',
  },
  'cartoon-doll': {
    top: '#fff7ee',
    bottom: '#f2e8de',
    halo: '#f4dbc2',
    floor: '#cdb9a6',
    shadow: '#6e5747',
  },
  'cartoon-travel': {
    top: '#f3f6fd',
    bottom: '#e6edf9',
    halo: '#b8c7e5',
    floor: '#9facc8',
    shadow: '#465069',
  },
  'cartoon-winter': {
    top: '#fff2f3',
    bottom: '#f7e0e6',
    halo: '#f5bbc8',
    floor: '#d4909b',
    shadow: '#743845',
  },
  'cartoon-cool': {
    top: '#f3f6fd',
    bottom: '#e5edf9',
    halo: '#b6c6e6',
    floor: '#9daac8',
    shadow: '#44506a',
  },
};

/*
  viewBox = 0 0 200 320
  Character center = x:100
  Head center ≈ y:68, body top ≈ y:110, feet ≈ y:300
*/

const SharedDefs: React.FC = () => (
  <defs>
    <radialGradient id="cg-skin" cx="45%" cy="38%" r="55%">
      <stop offset="0%" stopColor="#fde8d0" />
      <stop offset="100%" stopColor="#f2c8a4" />
    </radialGradient>
    <radialGradient id="cg-skin-doll" cx="45%" cy="38%" r="55%">
      <stop offset="0%" stopColor="#fff4e8" />
      <stop offset="100%" stopColor="#f8d8bc" />
    </radialGradient>
    <linearGradient id="cg-hair" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0%" stopColor="#7a5038" />
      <stop offset="100%" stopColor="#3e2010" />
    </linearGradient>
    <linearGradient id="cg-hair-dark" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0%" stopColor="#5a3520" />
      <stop offset="100%" stopColor="#2a1208" />
    </linearGradient>
    <radialGradient id="cg-lens" cx="30%" cy="30%" r="60%">
      <stop offset="0%" stopColor="#5a6b7d" />
      <stop offset="45%" stopColor="#2f3948" />
      <stop offset="75%" stopColor="#161616" />
      <stop offset="100%" stopColor="#090909" />
    </radialGradient>
    <linearGradient id="cg-white-jkt" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#fdfaf6" />
      <stop offset="100%" stopColor="#e8e0d2" />
    </linearGradient>
    <linearGradient id="cg-navy" x1="0" y1="0" x2="0.15" y2="1">
      <stop offset="0%" stopColor="#4e5e72" />
      <stop offset="100%" stopColor="#2c3846" />
    </linearGradient>
    <linearGradient id="cg-red-coat" x1="0" y1="0" x2="0.2" y2="1">
      <stop offset="0%" stopColor="#d83038" />
      <stop offset="100%" stopColor="#a01420" />
    </linearGradient>
    <linearGradient id="cg-red-hat" x1="0.5" y1="0" x2="0.5" y2="1">
      <stop offset="0%" stopColor="#e84040" />
      <stop offset="70%" stopColor="#c01820" />
    </linearGradient>
    <linearGradient id="cg-suitcase" x1="0" y1="0" x2="0.8" y2="1">
      <stop offset="0%" stopColor="#eca858" />
      <stop offset="100%" stopColor="#c47830" />
    </linearGradient>
    <linearGradient id="cg-scarf" x1="0" y1="0" x2="1" y2="0.4">
      <stop offset="0%" stopColor="#f4b8c0" />
      <stop offset="100%" stopColor="#e0909c" />
    </linearGradient>
    <filter id="cg-soft">
      <feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="blur" />
      <feOffset in="blur" dx="0" dy="2" result="off" />
      <feFlood floodColor="#00000018" result="color" />
      <feComposite in="color" in2="off" operator="in" result="shadow" />
      <feMerge><feMergeNode in="shadow" /><feMergeNode in="SourceGraphic" /></feMerge>
    </filter>
  </defs>
);

/* ═══════════════════════════════════════════
   Avatar 1: 原版 — 白印花夹克+抱臂+墨镜+长发+黑挎包+阔腿裤
   ═══════════════════════════════════════════ */
const CartoonOriginal: React.FC<{ animated: boolean }> = ({ animated }) => (
  <g className={animated ? 'cartoon-avatar-breathe' : ''}>
    {/* -- HAIR BACK (long brown, drapes past shoulders) -- */}
    <path d="M72 58 C65 60, 58 80, 56 130 C55 148, 62 152, 68 148 L72 100Z" fill="url(#cg-hair)" />
    <path d="M128 58 C135 60, 142 80, 144 130 C145 148, 138 152, 132 148 L128 100Z" fill="url(#cg-hair)" />
    <path d="M140 70 C148 85, 150 128, 146 145 C148 152, 140 152, 138 142 L136 90Z" fill="#3e2010" opacity="0.5" />

    {/* -- HEAD -- */}
    <ellipse cx="100" cy="68" rx="32" ry="35" fill="url(#cg-skin)" />

    {/* -- HAIR FRONT — swept side bangs -- */}
    <path d="M67 58 C67 28, 100 18, 100 18 C100 18, 133 28, 133 58 C130 40, 100 32, 70 40Z" fill="url(#cg-hair)" />
    <path d="M70 48 C75 38, 90 36, 95 40 L88 46 C82 40, 76 42, 72 48Z" fill="url(#cg-hair)" />
    <path d="M80 30 Q90 26, 100 28" stroke="#906848" strokeWidth="1.2" fill="none" opacity="0.4" />
    <path d="M105 27 Q118 26, 128 34" stroke="#906848" strokeWidth="1" fill="none" opacity="0.3" />

    {/* -- EYEBROWS (behind glasses) -- */}
    <path d="M80 54 Q86 51, 93 54" stroke="#5a3828" strokeWidth="1.8" fill="none" />
    <path d="M108 54 Q114 51, 121 54" stroke="#5a3828" strokeWidth="1.8" fill="none" />

    {/* -- SUNGLASSES -- */}
    <ellipse cx="87" cy="62" rx="14" ry="11" fill="url(#cg-lens)" stroke="#2a2a2a" strokeWidth="2" />
    <ellipse cx="113" cy="62" rx="14" ry="11" fill="url(#cg-lens)" stroke="#2a2a2a" strokeWidth="2" />
    <path d="M101 62 Q100 60, 99 62" stroke="#2a2a2a" strokeWidth="2.5" fill="none" />
    <path d="M73 60 L66 58" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" />
    <path d="M127 60 L134 58" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" />
    {/* Gleam */}
    <ellipse className={animated ? 'cartoon-gleam' : ''} cx="81" cy="58" rx="4" ry="2.5" fill="white" opacity="0.35" />
    <ellipse cx="107" cy="58" rx="2.5" ry="1.5" fill="white" opacity="0.18" />

    {/* -- NOSE & MOUTH -- */}
    <path d="M99 74 Q100 76, 101 74" stroke="#d4a888" strokeWidth="1" fill="none" />
    <path d="M93 82 Q100 87, 107 82" stroke="#c87878" strokeWidth="2" fill="none" strokeLinecap="round" />

    {/* -- NECK -- */}
    <rect x="92" y="98" width="16" height="14" rx="6" fill="url(#cg-skin)" />

    {/* -- WHITE JACKET -- */}
    <path d="M56 115 C56 108, 72 106, 100 106 C128 106, 144 108, 144 115 L148 198 C148 204, 140 206, 100 206 C60 206, 52 204, 52 198Z" fill="url(#cg-white-jkt)" filter="url(#cg-soft)" />
    {/* Collar V */}
    <path d="M84 106 L92 118 L100 110 L108 118 L116 106" fill="none" stroke="#d8d0c4" strokeWidth="1.5" />
    {/* Jacket patches */}
    <circle cx="74" cy="138" r="6" fill="#4488bb" opacity="0.75" />
    <text x="71.5" y="140.5" fontSize="6" fill="white" fontWeight="bold">B</text>
    <circle cx="128" cy="145" r="5" fill="#e87840" opacity="0.75" />
    <rect x="116" y="130" width="14" height="8" rx="2.5" fill="#e0b840" opacity="0.75" />
    <text x="119" y="136.5" fontSize="7" fill="#8a6020" fontWeight="bold">BO</text>

    {/* -- BLACK BAG STRAP + BAG -- */}
    <path d="M82 108 C86 130, 94 170, 100 185" stroke="#282828" strokeWidth="4.5" fill="none" strokeLinecap="round" />
    <rect x="92" y="176" width="20" height="18" rx="5" fill="#282828" />
    <rect x="95" y="178" width="14" height="3" rx="1.5" fill="#404040" />

    {/* -- CROSSED ARMS -- */}
    <path d="M56 136 C64 126, 78 130, 100 142 C122 130, 136 126, 144 136 L142 154 C134 148, 120 152, 100 156 C80 152, 66 148, 58 154Z" fill="url(#cg-skin)" />

    {/* -- CREAM WIDE-LEG PANTS -- */}
    <path d="M64 204 L60 278 C60 284, 68 286, 84 286 L90 286 C94 286, 96 284, 96 278 L92 204Z" fill="#f0ece0" />
    <path d="M108 204 L104 278 C104 284, 108 286, 116 286 L130 286 C138 286, 140 284, 140 278 L144 204Z" fill="#f0ece0" />
    <line x1="76" y1="220" x2="78" y2="275" stroke="#ddd5c5" strokeWidth="1.2" />
    <line x1="122" y1="220" x2="120" y2="275" stroke="#ddd5c5" strokeWidth="1.2" />

    {/* -- SHOES -- */}
    <path d="M56 282 C56 278, 66 276, 92 276 L96 276 C100 276, 100 280, 100 284 C100 290, 56 292, 56 282Z" fill="#4a3828" />
    <path d="M104 282 C104 278, 110 276, 130 276 L140 276 C144 276, 146 280, 146 284 C146 292, 104 292, 104 282Z" fill="#4a3828" />
  </g>
);

/* ═══════════════════════════════════════════
   Avatar 2: 玩偶版 — Q萌大头+圆墨镜+白夹克+斜挎包+白鞋
   ═══════════════════════════════════════════ */
const CartoonDoll: React.FC<{ animated: boolean }> = ({ animated }) => (
  <g className={animated ? 'cartoon-avatar-breathe' : ''}>
    {/* -- HAIR BACK (long, draping both sides) -- */}
    <path d="M66 65 C56 72, 50 95, 48 150 C46 168, 56 170, 64 165 L68 100Z" fill="url(#cg-hair)" />
    <path d="M134 65 C144 72, 150 95, 152 150 C154 168, 144 170, 136 165 L132 100Z" fill="url(#cg-hair)" />
    <path d="M148 80 C156 100, 158 148, 154 162 C156 168, 148 168, 146 158 L144 95Z" fill="#3e2010" opacity="0.45" />

    {/* -- GIANT HEAD (doll: bigger) -- */}
    <ellipse cx="100" cy="68" rx="42" ry="45" fill="url(#cg-skin-doll)" />

    {/* -- EARS (visible for doll) -- */}
    <ellipse cx="57" cy="72" rx="9" ry="12" fill="url(#cg-skin-doll)" />
    <ellipse cx="57" cy="72" rx="5" ry="7" fill="#f0c8a8" opacity="0.35" />
    <ellipse cx="143" cy="72" rx="9" ry="12" fill="url(#cg-skin-doll)" />
    <ellipse cx="143" cy="72" rx="5" ry="7" fill="#f0c8a8" opacity="0.35" />

    {/* -- HAIR FRONT (center-parted, fluffy volume) -- */}
    <path d="M56 60 C54 24, 100 10, 100 10 C100 10, 146 24, 144 60 C140 36, 100 26, 60 36Z" fill="url(#cg-hair)" />
    {/* Parting highlight */}
    <path d="M100 12 C88 16, 72 28, 64 42" stroke="#906848" strokeWidth="1.5" fill="none" opacity="0.35" />
    <path d="M100 12 C112 16, 128 28, 136 42" stroke="#906848" strokeWidth="1.5" fill="none" opacity="0.35" />

    {/* -- EYEBROWS -- */}
    <path d="M76 54 Q84 50, 92 54" stroke="#7a5038" strokeWidth="1.8" fill="none" />
    <path d="M108 54 Q116 50, 124 54" stroke="#7a5038" strokeWidth="1.8" fill="none" />

    {/* -- SUNGLASSES (bigger for doll) -- */}
    <ellipse cx="84" cy="64" rx="16" ry="13" fill="url(#cg-lens)" stroke="#2a2a2a" strokeWidth="2.2" />
    <ellipse cx="116" cy="64" rx="16" ry="13" fill="url(#cg-lens)" stroke="#2a2a2a" strokeWidth="2.2" />
    <path d="M100 64 Q100 62, 100 64" stroke="#2a2a2a" strokeWidth="2.8" fill="none" />
    <path d="M68 62 L58 60" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" />
    <path d="M132 62 L142 60" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" />
    <ellipse className={animated ? 'cartoon-gleam' : ''} cx="76" cy="60" rx="5" ry="3" fill="white" opacity="0.3" />
    <ellipse cx="110" cy="60" rx="3" ry="2" fill="white" opacity="0.15" />

    {/* -- NOSE & MOUTH (small, cute) -- */}
    <circle cx="100" cy="80" r="1.5" fill="#e4b898" />
    <path d="M92 90 Q100 95, 108 90" stroke="#d38b92" strokeWidth="1.8" fill="none" strokeLinecap="round" />

    {/* -- TINY NECK (doll proportion) -- */}
    <rect x="94" y="110" width="12" height="8" rx="5" fill="url(#cg-skin-doll)" />

    {/* -- WHITE JACKET (compact doll body) -- */}
    <path d="M62 120 C62 116, 78 114, 100 114 C122 114, 138 116, 138 120 L142 196 C142 202, 134 204, 100 204 C66 204, 58 202, 58 196Z" fill="url(#cg-white-jkt)" filter="url(#cg-soft)" />
    <path d="M86 114 L92 122 L100 116 L108 122 L114 114" fill="none" stroke="#d8d0c4" strokeWidth="1.2" />

    {/* Patches */}
    <circle cx="76" cy="140" r="5" fill="#4488bb" opacity="0.65" />
    <circle cx="126" cy="148" r="4" fill="#e87840" opacity="0.65" />
    <rect x="114" y="134" width="11" height="6.5" rx="2" fill="#e0b840" opacity="0.65" />

    {/* Bag strap + bag */}
    <path d="M82 116 C86 135, 92 168, 96 184" stroke="#202125" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    <rect x="88" y="176" width="18" height="15" rx="4" fill="#202125" />

    {/* -- HANDS AT SIDES (doll) -- */}
    <ellipse cx="55" cy="188" rx="9" ry="10" fill="url(#cg-skin-doll)" />
    <ellipse cx="145" cy="188" rx="9" ry="10" fill="url(#cg-skin-doll)" />

    {/* -- WHITE PANTS -- */}
    <path d="M68 202 L66 264 C66 268, 72 270, 88 270 C94 270, 96 268, 96 264 L92 202Z" fill="#f6f2ea" />
    <path d="M108 202 L104 264 C104 268, 108 270, 116 270 C130 270, 134 268, 134 264 L138 202Z" fill="#f6f2ea" />

    {/* -- CREAM/WHITE SHOES -- */}
    <path d="M62 266 C62 262, 70 260, 92 260 C98 260, 100 264, 100 268 C100 274, 62 276, 62 266Z" fill="#e8e0d0" />
    <path d="M104 266 C104 262, 110 260, 130 260 C138 260, 140 264, 140 268 C140 276, 104 276, 104 266Z" fill="#e8e0d0" />
  </g>
);

/* ═══════════════════════════════════════════
   Avatar 3: 旅行版 — 短发波浪+墨镜+粉围巾+藏蓝西装+行李箱
   ═══════════════════════════════════════════ */
const CartoonTravel: React.FC<{ animated: boolean }> = ({ animated }) => (
  <g className={animated ? 'cartoon-avatar-breathe' : ''}>
    {/* -- HAIR (short wavy volume) -- */}
    <path d="M60 56 C58 24, 90 14, 90 14 C90 14, 122 24, 120 56 C118 34, 90 26, 62 34Z" fill="url(#cg-hair-dark)" />
    {/* Right side volume */}
    <path d="M118 42 C124 48, 128 64, 126 74 C128 78, 122 76, 120 68 L118 50Z" fill="url(#cg-hair-dark)" />
    {/* Left side */}
    <path d="M62 42 C56 48, 52 60, 54 70 C52 74, 58 72, 60 64 L62 48Z" fill="url(#cg-hair-dark)" />
    {/* Wavy highlights */}
    <path d="M68 26 Q78 22, 88 24" stroke="#6b3828" strokeWidth="1.2" fill="none" opacity="0.5" />
    <path d="M94 22 Q108 20, 116 28" stroke="#6b3828" strokeWidth="1" fill="none" opacity="0.4" />
    <path d="M122 50 Q126 58, 124 68" stroke="#6b3828" strokeWidth="1" fill="none" opacity="0.35" />

    {/* -- HEAD -- */}
    <ellipse cx="90" cy="60" rx="30" ry="33" fill="url(#cg-skin)" />

    {/* Brows */}
    <path d="M72 48 Q80 44, 88 48" stroke="#4a2818" strokeWidth="2" fill="none" />
    <path d="M94 48 Q102 44, 110 48" stroke="#4a2818" strokeWidth="2" fill="none" />

    {/* Sunglasses */}
    <ellipse cx="80" cy="58" rx="13" ry="11" fill="url(#cg-lens)" stroke="#2a2a2a" strokeWidth="2" />
    <ellipse cx="102" cy="58" rx="13" ry="11" fill="url(#cg-lens)" stroke="#2a2a2a" strokeWidth="2" />
    <path d="M93 58 Q91 56, 89 58" stroke="#2a2a2a" strokeWidth="2.2" fill="none" />
    <path d="M67 56 L58 54" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" />
    <path d="M115 56 L122 54" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" />
    <ellipse className={animated ? 'cartoon-gleam' : ''} cx="74" cy="54" rx="4" ry="2.5" fill="white" opacity="0.3" />

    {/* -- OPEN MOUTH LAUGHING -- */}
    <ellipse cx="91" cy="78" rx="9" ry="7" fill="#a83040" />
    <path d="M82 76 Q91 71, 100 76" fill="url(#cg-skin)" />
    <ellipse cx="91" cy="82" rx="6" ry="3" fill="#c84858" opacity="0.5" />

    {/* -- PINK SCARF -- */}
    <path d="M54 94 Q90 88, 126 94 C130 98, 128 104, 126 106 Q90 100, 54 106 C50 102, 52 98, 54 94Z" fill="url(#cg-scarf)" />
    {/* Scarf tails hanging */}
    <path d="M118 102 Q124 118, 116 136 Q114 140, 112 134 Q118 120, 114 104" fill="url(#cg-scarf)" opacity="0.75" />
    <path d="M122 102 Q130 120, 126 140 Q124 144, 122 136 Q128 122, 122 106" fill="#f4b8c0" opacity="0.5" />

    {/* Neck */}
    <rect x="84" y="90" width="14" height="10" rx="5" fill="url(#cg-skin)" />

    {/* -- NAVY SUIT BODY -- */}
    <path d="M48 110 C48 106, 66 104, 90 104 C114 104, 132 106, 132 110 L136 200 C136 204, 128 206, 90 206 C52 206, 44 204, 44 200Z" fill="url(#cg-navy)" filter="url(#cg-soft)" />
    {/* White shirt V */}
    <path d="M78 104 L88 122 L98 108 L108 122 L118 104" fill="#f0ece0" strokeWidth="0" />
    {/* Lapels */}
    <path d="M66 104 L78 120 L68 116Z" fill="#2a3648" opacity="0.5" />
    <path d="M118 104 L106 120 L116 116Z" fill="#2a3648" opacity="0.5" />
    <circle cx="91" cy="134" r="2" fill="#1e2e3e" />
    <circle cx="91" cy="148" r="2" fill="#1e2e3e" />

    {/* Left arm */}
    <path d="M44 112 C36 116, 32 126, 30 150 C28 162, 34 166, 40 164 L46 130Z" fill="url(#cg-navy)" />
    <ellipse cx="38" cy="168" rx="8" ry="9" fill="url(#cg-skin)" />

    {/* Right arm holding handle */}
    <path d="M132 112 C140 116, 144 126, 146 150 C148 162, 142 166, 136 164 L134 130Z" fill="url(#cg-navy)" />
    <ellipse cx="140" cy="168" rx="8" ry="9" fill="url(#cg-skin)" />

    {/* -- SUITCASE -- */}
    <g className={animated ? 'cartoon-suitcase-sway' : ''}>
      <rect x="148" y="142" width="4" height="30" rx="2" fill="#aaa" />
      <rect x="138" y="170" width="34" height="50" rx="6" fill="url(#cg-suitcase)" />
      <line x1="138" y1="188" x2="172" y2="188" stroke="#b07838" strokeWidth="1" opacity="0.5" />
      <line x1="138" y1="204" x2="172" y2="204" stroke="#b07838" strokeWidth="1" opacity="0.5" />
      <rect x="148" y="178" width="14" height="5" rx="2.5" fill="#b08038" opacity="0.6" />
      <circle cx="144" cy="222" r="4" fill="#999" />
      <circle cx="166" cy="222" r="4" fill="#999" />
    </g>

    {/* -- NAVY PANTS -- */}
    <path d="M54 204 L50 272 C50 278, 58 280, 78 280 L86 280 C90 280, 92 278, 92 272 L88 204Z" fill="#263442" />
    <path d="M96 204 L92 272 C92 278, 96 280, 108 280 L124 280 C132 280, 136 278, 136 272 L140 204Z" fill="#263442" />

    {/* Dark shoes */}
    <path d="M46 276 C46 272, 56 270, 88 270 C94 270, 96 274, 96 278 C96 286, 46 288, 46 276Z" fill="#2a2a2a" />
    <path d="M96 276 C96 272, 102 270, 128 270 C138 270, 140 274, 140 278 C140 288, 96 288, 96 276Z" fill="#2a2a2a" />
  </g>
);

/* ═══════════════════════════════════════════
   Avatar 4: 冬日版 — 红帽+长发可见+红羽绒+闭眼+腮红+暖手
   ═══════════════════════════════════════════ */
const CartoonWinter: React.FC<{ animated: boolean }> = ({ animated }) => (
  <g className={animated ? 'cartoon-avatar-breathe' : ''}>
    {/* -- HAIR BACK (visible beneath hat, long brown) -- */}
    <path d="M74 56 C66 62, 58 85, 56 140 C54 160, 64 164, 72 158 L76 90Z" fill="url(#cg-hair)" />
    <path d="M126 56 C134 62, 142 85, 144 140 C146 160, 136 164, 128 158 L124 90Z" fill="url(#cg-hair)" />
    <path d="M140 72 C148 90, 150 138, 148 155 C150 162, 142 162, 140 152 L138 88Z" fill="#3e2010" opacity="0.5" />

    {/* -- HEAD -- */}
    <ellipse cx="100" cy="70" rx="30" ry="32" fill="url(#cg-skin)" />

    {/* -- HAIR SIDES (visible below hat, framing face) -- */}
    <path d="M69 52 C66 56, 64 68, 66 82 C64 86, 68 84, 70 78 L72 60Z" fill="url(#cg-hair)" />
    <path d="M131 52 C134 56, 136 68, 134 82 C136 86, 132 84, 130 78 L128 60Z" fill="url(#cg-hair)" />
    {/* Bangs peeking under hat */}
    <path d="M72 50 C76 46, 82 44, 88 46 L84 52 C80 48, 76 48, 74 52Z" fill="url(#cg-hair)" />
    <path d="M128 50 C124 46, 118 44, 112 46 L116 52 C120 48, 124 48, 126 52Z" fill="url(#cg-hair)" />

    {/* -- RED BEANIE -- */}
    <path d="M66 48 C64 22, 100 10, 100 10 C100 10, 136 22, 134 48 L66 48Z" fill="url(#cg-red-hat)" />
    {/* Beanie ribbing */}
    {[74, 80, 86, 92, 98, 104, 110, 116, 122].map(x => (
      <line key={x} x1={x} y1={x < 80 || x > 116 ? 28 : 20} x2={x} y2="44" stroke="#a01020" strokeWidth="1.5" opacity="0.4" />
    ))}
    {/* Beanie fold brim */}
    <path d="M64 44 Q100 38, 136 44 Q138 52, 136 54 Q100 48, 64 54 Q62 50, 64 44Z" fill="#b82028" />

    {/* -- CLOSED EYES (peaceful, happy) -- */}
    <path d="M82 64 Q88 60, 94 64" stroke="#6a4030" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    <path d="M106 64 Q112 60, 118 64" stroke="#6a4030" strokeWidth="2.2" fill="none" strokeLinecap="round" />
    {/* Eyelashes */}
    <path d="M82 64 L79 62" stroke="#6a4030" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M118 64 L121 62" stroke="#6a4030" strokeWidth="1.2" strokeLinecap="round" />

    {/* -- BLUSH CHEEKS -- */}
    <ellipse cx="78" cy="74" rx="8" ry="4.5" fill="#f4a0a0" opacity="0.4" />
    <ellipse cx="122" cy="74" rx="8" ry="4.5" fill="#f4a0a0" opacity="0.4" />

    {/* -- GENTLE SMILE -- */}
    <path d="M90 82 Q100 89, 110 82" stroke="#d07080" strokeWidth="2" fill="none" strokeLinecap="round" />

    {/* -- RED TURTLENECK / COLLAR -- */}
    <path d="M72 98 Q100 92, 128 98 C132 104, 130 110, 128 112 Q100 106, 72 112 C68 108, 70 102, 72 98Z" fill="#c82030" />

    {/* -- RED PUFFER COAT -- */}
    <path d="M52 114 C52 110, 72 108, 100 108 C128 108, 148 110, 148 114 L152 216 C152 222, 144 224, 100 224 C56 224, 48 222, 48 216Z" fill="url(#cg-red-coat)" filter="url(#cg-soft)" />
    {/* Quilting lines */}
    {[132, 150, 168, 186, 204].map(y => (
      <line key={y} x1="50" y1={y} x2="150" y2={y} stroke="#881018" strokeWidth="0.8" opacity="0.25" />
    ))}
    {/* Puff volume highlights */}
    <path d="M52 114 Q100 120, 148 114 L148 132 Q100 126, 52 132Z" fill="#e03840" opacity="0.12" />
    <path d="M50 150 Q100 156, 150 150 L150 168 Q100 162, 50 168Z" fill="#e03840" opacity="0.1" />

    {/* -- SLEEVES (puffy) -- */}
    <path d="M52 116 C40 120, 36 135, 34 155 C32 168, 40 172, 50 168 L58 140Z" fill="url(#cg-red-coat)" />
    <path d="M148 116 C160 120, 164 135, 166 155 C168 168, 160 172, 150 168 L142 140Z" fill="url(#cg-red-coat)" />
    {/* Sleeve quilting */}
    <path d="M40 138 Q48 136, 56 138" stroke="#881018" strokeWidth="0.6" opacity="0.3" />
    <path d="M38 152 Q48 150, 56 152" stroke="#881018" strokeWidth="0.6" opacity="0.3" />
    <path d="M144 138 Q152 136, 160 138" stroke="#881018" strokeWidth="0.6" opacity="0.3" />
    <path d="M144 152 Q154 150, 164 152" stroke="#881018" strokeWidth="0.6" opacity="0.3" />

    {/* -- CLASPED HANDS (warming up) -- */}
    <g className={animated ? 'cartoon-hands-rub' : ''}>
      <ellipse cx="100" cy="154" rx="18" ry="14" fill="url(#cg-skin)" />
      <path d="M84 150 Q100 144, 116 150" stroke="#e4b898" strokeWidth="0.8" fill="none" />
      <path d="M86 160 Q100 166, 114 160" stroke="#e4b898" strokeWidth="0.8" fill="none" />
      <line x1="94" y1="146" x2="94" y2="162" stroke="#e4b898" strokeWidth="0.5" opacity="0.4" />
      <line x1="100" y1="144" x2="100" y2="164" stroke="#e4b898" strokeWidth="0.5" opacity="0.4" />
      <line x1="106" y1="146" x2="106" y2="162" stroke="#e4b898" strokeWidth="0.5" opacity="0.4" />
    </g>

    {/* -- DARK PANTS -- */}
    <rect x="66" y="222" width="26" height="24" rx="4" fill="#4a3848" />
    <rect x="108" y="222" width="26" height="24" rx="4" fill="#4a3848" />

    {/* -- BROWN BOOTS -- */}
    <path d="M62 242 C62 238, 70 236, 90 236 C96 236, 98 240, 98 244 C98 252, 62 254, 62 242Z" fill="#6a3020" />
    <path d="M102 242 C102 238, 110 236, 130 236 C138 236, 140 240, 140 244 C140 254, 102 254, 102 242Z" fill="#6a3020" />
    <path d="M64 244 Q80 240, 96 244" stroke="#502010" strokeWidth="0.8" fill="none" opacity="0.5" />
    <path d="M104 244 Q120 240, 138 244" stroke="#502010" strokeWidth="0.8" fill="none" opacity="0.5" />
  </g>
);

/* ═══════════════════════════════════════════
   Avatar 5: 酷飒版 — 左手扶墨镜+笑+粉围巾+西装+拉行李箱
   ═══════════════════════════════════════════ */
const CartoonCool: React.FC<{ animated: boolean }> = ({ animated }) => (
  <g className={animated ? 'cartoon-avatar-breathe' : ''}>
    {/* -- HAIR (short wavy volume) -- */}
    <path d="M56 56 C54 24, 86 12, 86 12 C86 12, 118 24, 116 56 C114 34, 86 26, 58 34Z" fill="url(#cg-hair-dark)" />
    <path d="M114 42 C120 48, 124 64, 122 74 C124 78, 118 76, 116 68 L114 50Z" fill="url(#cg-hair-dark)" />
    <path d="M58 42 C52 48, 48 60, 50 70 C48 74, 54 72, 56 64 L58 48Z" fill="url(#cg-hair-dark)" />
    <path d="M64 26 Q74 22, 84 24" stroke="#6b3828" strokeWidth="1.2" fill="none" opacity="0.5" />
    <path d="M90 22 Q104 20, 114 28" stroke="#6b3828" strokeWidth="1" fill="none" opacity="0.4" />

    {/* -- HEAD (slightly tilted) -- */}
    <ellipse cx="86" cy="60" rx="30" ry="33" fill="url(#cg-skin)" transform="rotate(-3 86 60)" />

    {/* Brows (raised, expressive) */}
    <path d="M66 46 Q74 42, 82 46" stroke="#4a2818" strokeWidth="2.2" fill="none" />
    <path d="M92 46 Q100 42, 108 46" stroke="#4a2818" strokeWidth="2.2" fill="none" />

    {/* Sunglasses */}
    <ellipse cx="76" cy="56" rx="13" ry="11" fill="url(#cg-lens)" stroke="#2a2a2a" strokeWidth="2" />
    <ellipse cx="98" cy="56" rx="13" ry="11" fill="url(#cg-lens)" stroke="#2a2a2a" strokeWidth="2" />
    <path d="M89 56 Q87 54, 85 56" stroke="#2a2a2a" strokeWidth="2.2" fill="none" />
    <path d="M63 54 L54 52" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" />
    <path d="M111 54 L118 52" stroke="#2a2a2a" strokeWidth="2" strokeLinecap="round" />
    <ellipse className={animated ? 'cartoon-gleam' : ''} cx="70" cy="52" rx="4" ry="2.5" fill="white" opacity="0.3" />

    {/* -- LEFT HAND pushing glasses up -- */}
    <g className={animated ? 'cartoon-push-glasses' : ''}>
      <path d="M48 52 C42 44, 44 34, 50 32 C54 30, 58 34, 58 40 L56 50" fill="url(#cg-skin)" />
    </g>

    {/* -- LEFT ARM raised to head -- */}
    <path d="M42 112 C30 102, 24 80, 22 60 C20 46, 26 36, 34 34 L44 40 C38 46, 36 60, 38 80 L44 108Z" fill="url(#cg-navy)" />

    {/* -- OPEN MOUTH LAUGHING -- */}
    <ellipse cx="87" cy="76" rx="10" ry="7.5" fill="#a83040" />
    <path d="M77 74 Q87 68, 97 74" fill="url(#cg-skin)" />
    <ellipse cx="87" cy="80" rx="6.5" ry="3" fill="#c84858" opacity="0.5" />

    {/* -- PINK SCARF -- */}
    <path d="M50 92 Q86 86, 122 92 C126 96, 124 102, 122 104 Q86 98, 50 104 C46 100, 48 96, 50 92Z" fill="url(#cg-scarf)" />
    <path d="M114 100 Q120 116, 112 134" stroke="#d08890" strokeWidth="3.5" fill="none" strokeLinecap="round" />
    <path d="M118 100 Q126 118, 122 138" stroke="#f4b8c0" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.6" />

    {/* Neck */}
    <rect x="80" y="88" width="14" height="10" rx="5" fill="url(#cg-skin)" />

    {/* -- NAVY SUIT BODY -- */}
    <path d="M44 108 C44 104, 62 102, 86 102 C110 102, 128 104, 128 108 L132 198 C132 202, 124 204, 86 204 C48 204, 40 202, 40 198Z" fill="url(#cg-navy)" filter="url(#cg-soft)" />
    {/* White shirt V */}
    <path d="M74 102 L84 120 L94 106 L104 120 L114 102" fill="#f0ece0" />
    <path d="M62 102 L74 118 L64 114Z" fill="#2a3648" opacity="0.5" />
    <path d="M114 102 L102 118 L112 114Z" fill="#2a3648" opacity="0.5" />
    <circle cx="87" cy="132" r="2" fill="#1e2e3e" />
    <circle cx="87" cy="146" r="2" fill="#1e2e3e" />

    {/* Right arm holding handle */}
    <path d="M128 112 C136 116, 140 126, 142 150 C144 162, 138 166, 132 164 L130 130Z" fill="url(#cg-navy)" />
    <ellipse cx="136" cy="168" rx="8" ry="9" fill="url(#cg-skin)" />

    {/* -- SUITCASE -- */}
    <g className={animated ? 'cartoon-suitcase-sway' : ''}>
      <rect x="144" y="140" width="4" height="30" rx="2" fill="#aaa" />
      <rect x="134" y="168" width="34" height="50" rx="6" fill="url(#cg-suitcase)" />
      <line x1="134" y1="186" x2="168" y2="186" stroke="#b07838" strokeWidth="1" opacity="0.5" />
      <line x1="134" y1="202" x2="168" y2="202" stroke="#b07838" strokeWidth="1" opacity="0.5" />
      <rect x="144" y="176" width="14" height="5" rx="2.5" fill="#b08038" opacity="0.6" />
      <circle cx="140" cy="220" r="4" fill="#999" />
      <circle cx="162" cy="220" r="4" fill="#999" />
    </g>

    {/* Navy pants */}
    <path d="M50 202 L46 270 C46 276, 54 278, 74 278 L82 278 C86 278, 88 276, 88 270 L84 202Z" fill="#263442" />
    <path d="M92 202 L88 270 C88 276, 92 278, 104 278 L120 278 C128 278, 132 276, 132 270 L136 202Z" fill="#263442" />

    {/* Dark shoes */}
    <path d="M42 274 C42 270, 52 268, 84 268 C90 268, 92 272, 92 276 C92 284, 42 286, 42 274Z" fill="#2a2a2a" />
    <path d="M92 274 C92 270, 98 268, 124 268 C134 268, 136 272, 136 276 C136 286, 92 286, 92 274Z" fill="#2a2a2a" />
  </g>
);

const CARTOON_RENDERERS = [CartoonOriginal, CartoonDoll, CartoonTravel, CartoonWinter, CartoonCool];

/* ─── Inline Cartoon SVG (reusable) ─── */
export const CartoonAvatarSVG: React.FC<{
  index: number;
  scale?: number;
  animated?: boolean;
}> = ({ index, scale = 0.75, animated = true }) => {
  const Renderer = CARTOON_RENDERERS[index];
  if (!Renderer) return null;
  const avatar = CARTOON_AVATARS[index];
  const stageTheme = avatar
    ? CARTOON_STAGE_THEMES[avatar.id]
    : CARTOON_STAGE_THEMES['cartoon-original'];
  const stageGradientId = `cg-stage-${avatar?.id ?? index}`;
  const stageHaloId = `cg-stage-halo-${avatar?.id ?? index}`;
  const stageFloorId = `cg-stage-floor-${avatar?.id ?? index}`;
  const stageShadowId = `cg-stage-shadow-${avatar?.id ?? index}`;

  return (
    <div className="cartoon-avatar-stage">
      <svg
        width={200 * scale}
        height={320 * scale}
        viewBox="0 0 200 320"
        xmlns="http://www.w3.org/2000/svg"
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id={stageGradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stageTheme.top} />
            <stop offset="100%" stopColor={stageTheme.bottom} />
          </linearGradient>
          <radialGradient id={stageHaloId} cx="50%" cy="36%" r="65%">
            <stop offset="0%" stopColor={stageTheme.halo} stopOpacity="0.82" />
            <stop offset="75%" stopColor={stageTheme.halo} stopOpacity="0.12" />
            <stop offset="100%" stopColor={stageTheme.halo} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={stageFloorId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={stageTheme.floor} stopOpacity="0" />
            <stop offset="50%" stopColor={stageTheme.floor} stopOpacity="0.52" />
            <stop offset="100%" stopColor={stageTheme.floor} stopOpacity="0" />
          </linearGradient>
          <filter id={stageShadowId} x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="3" stdDeviation="2.2" floodColor="#2b1c16" floodOpacity="0.16" />
          </filter>
        </defs>
        <SharedDefs />
        <rect
          x="18"
          y="16"
          width="164"
          height="278"
          rx="26"
          fill={`url(#${stageGradientId})`}
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.1"
        />
        <ellipse cx="100" cy="132" rx="72" ry="98" fill={`url(#${stageHaloId})`} />
        <line x1="36" y1="286" x2="164" y2="286" stroke={`url(#${stageFloorId})`} strokeWidth="1.8" />
        <g filter={`url(#${stageShadowId})`}>
          <Renderer animated={animated} />
        </g>
      </svg>
    </div>
  );
};

/* ─── Full-screen Showcase Modal ─── */
export const AnimatedAvatarShowcase: React.FC<AnimatedAvatarShowcaseProps> = ({ isOpen, onClose }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  if (!isOpen) return null;

  const activeAvatar = CARTOON_AVATARS[activeIndex];

  const goPrev = () => setActiveIndex((i) => (i - 1 + CARTOON_AVATARS.length) % CARTOON_AVATARS.length);
  const goNext = () => setActiveIndex((i) => (i + 1) % CARTOON_AVATARS.length);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].clientX;
    touchEndX.current = null;
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].clientX;
  };
  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const delta = touchStartX.current - touchEndX.current;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) goNext();
    if (delta < 0) goPrev();
  };

  const handleDownload = () => {
    const slides = document.querySelectorAll('.cartoon-avatar-stage svg');
    const svg = slides[activeIndex] as SVGSVGElement | null;
    if (!svg) return;
    const canvas = document.createElement('canvas');
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const svgData = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width * 3;
      canvas.height = img.height * 3;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(3, 3);
      ctx.drawImage(img, 0, 0);
      const link = document.createElement('a');
      link.download = `${activeAvatar.name}.png`;
      link.href = canvas.toDataURL();
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative bg-[var(--eye-bg-primary)] rounded-3xl p-6 pb-8 shadow-2xl max-w-sm w-full mx-4 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="关闭"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-5 h-5 text-[var(--eye-text-secondary)]" />
        </button>

        <h3 className="text-center text-lg font-bold text-[var(--eye-text-primary)] mb-1">
          🎨 动画小兰
        </h3>
        <p className="text-center text-xs text-[var(--eye-text-secondary)] mb-3">
          左右滑动切换形象
        </p>

        <div className="flex items-center justify-center gap-2 mb-3">
          {CARTOON_AVATARS.map((av, i) => (
            <button
              key={av.id}
              type="button"
              aria-label={av.name}
              onClick={() => setActiveIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === activeIndex
                  ? 'bg-[var(--eye-text-primary)] scale-125'
                  : 'bg-eye-text-secondary/30'
              }`}
            />
          ))}
        </div>

        <div
          className="pixel-avatar-carousel"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div
            className="pixel-avatar-track"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {CARTOON_AVATARS.map((_, i) => (
              <div key={CARTOON_AVATARS[i].id} className="pixel-avatar-slide">
                <CartoonAvatarSVG index={i} scale={0.75} animated />
              </div>
            ))}
          </div>

          <div className="pixel-avatar-nav">
            <button type="button" aria-label="上一个" onClick={goPrev} className="pixel-avatar-nav-btn">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button type="button" aria-label="下一个" onClick={goNext} className="pixel-avatar-nav-btn">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="pixel-avatar-meta">
          <p className="text-center text-sm font-semibold text-[var(--eye-text-primary)]">
            {activeAvatar.name}
          </p>
          <p className="text-center text-xs text-[var(--eye-text-secondary)]">
            {activeAvatar.subtitle}
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
          {activeAvatar.tags.map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 bg-white/70 dark:bg-white/10 text-[var(--eye-text-primary)] text-xs rounded-full font-medium"
            >
              {tag}
            </span>
          ))}
        </div>

        <button
          onClick={handleDownload}
          className={`w-full mt-5 h-11 rounded-xl bg-gradient-to-r ${activeAvatar.accent} text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:opacity-90 shadow-md`}
        >
          <Download className="w-4 h-4" />
          下载卡通头像
        </button>
      </div>
    </div>
  );
};
