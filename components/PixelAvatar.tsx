import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';

interface PixelAvatarShowcaseProps {
  isOpen: boolean;
  onClose: () => void;
}

type PixelPalette = Record<string, string>;

interface PixelAvatarDefinition {
  id: string;
  name: string;
  subtitle: string;
  palette: PixelPalette;
  frames: string[][];
  tags: string[];
  accent: string;
}

interface PixelStageTheme {
  top: string;
  bottom: string;
  glow: string;
  sparkA: string;
  sparkB: string;
  sparkC: string;
  floor: string;
  shadow: string;
}

const PIXEL = 5; // pixel size in SVG units

/* ================================================================
   Avatar 1 — 像素小兰 原版 (真人, 抱臂, 深棕鞋)
   Avatar 2 — 像素小兰·玩偶 (3D 公仔, 大头, 白鞋)
   Avatar 3 — 旅行小兰 (西装墨镜, 粉围巾, 行李箱)
   每帧 16×28 高分辨率像素网格
   ================================================================ */

const AVATARS: PixelAvatarDefinition[] = [
  /* ────────────── Avatar 1: 原版（真人照片） ────────────── */
  {
    id: 'xiaolan',
    name: '像素小兰',
    subtitle: '原版形象 · 抱臂站姿',
    accent: 'from-[#4a2a1a] to-[#6b3f2a]',
    palette: {
      H: '#4a2a1a', // hair dark brown
      h: '#6b3f2a', // hair highlight
      S: '#f0c5a5', // skin warm
      s: '#d4a080', // skin shadow / eyebrow
      G: '#1a1a1a', // glasses frame
      g: '#354555', // lens reflection
      W: '#f5f0e8', // white jacket
      w: '#e0d8cc', // jacket shadow
      B: '#252528', // black bag/strap
      b: '#4080b0', // blue patch
      o: '#e08040', // orange patch
      y: '#e0b840', // yellow patch / "BO"
      P: '#f0ece0', // cream pants
      p: '#ddd5c5', // pants fold
      K: '#4a3a2a', // dark brown shoes
      L: '#d08088', // lips
    },
    frames: [
      // Frame A — 抱臂站立，头发两侧垂到肩下
      [
        '.....HHHHHH.....',  // 0  crown
        '....HhHHHhHH....',  // 1  parting + highlights
        '...HHHHHHHHHH...',  // 2  full hair
        '..HHhHHHHHhHHH..',  // 3  bangs wide
        '..HHSSssSSSSHH..',  // 4  forehead + brow hints
        '..HHSSSSSSSSHH..',  // 5  upper face + hair
        '.HHSGGGSSGGGSHH.',  // 6  sunglasses top
        '.HHSGgGSSGGgSHH.',  // 7  sunglasses + gleam
        '..HHSSSSSSSSHH..',  // 8  nose + hair draping
        '..hHSSSSLSSShH..',  // 9  mouth + lips
        '...HHSSSSSSHH...',  // 10 chin
        '..HH..SSSS..HH..',  // 11 neck + hair draping
        '..HHWwWWWWwWHH..',  // 12 collar + hair sides
        '.HHWbWWBWyWWWHH.',  // 13 shoulders + patches
        '.HHWoWWBWbWWWHH.',  // 14 torso + patches
        '.HHwSSSBSSSSWwH.',  // 15 arms crossed
        '..hHSSsBSSSShH..',  // 16 arms lower + hair ends
        '...WWSBBBBsWWW..',  // 17 bag + hands
        '....WWBBBWWW....',  // 18 bag body
        '....WWWWWWWW....',  // 19 waist
        '....PPPPPPPP....',  // 20 pants top
        '...PPPpPPpPPP...',  // 21 wide-leg with folds
        '..PPpp....ppPP..',  // 22 folds
        '..PPp......pPP..',  // 23 legs separated
        '..PPp......pPP..',  // 24 legs
        '..PPp......pPP..',  // 25 legs
        '..KKK......KKK..',  // 26 shoes
        '.KKKK......KKKK.',  // 27 shoe soles
      ],
      // Frame B — 头发微风, 反光偏移
      [
        '......HHHHHH....',  // 0  hair shifts right (wind)
        '....HHhHHhHH....',  // 1  highlight shift
        '...HHHHHHHHHH...',  // 2  same
        '..HHHhHHHHhHHH..',  // 3  highlights shift
        '..HHSSssSSSSHH..',  // 4  same
        '..HHSSSSSSSSHH..',  // 5  same
        '.HHSGGGSSGGGSHH.',  // 6  same
        '.HHSGGgSSGgGSHH.',  // 7  gleam shifts right
        '..HHSSSSSSSSHH..',  // 8  same
        '..hHSSSSLSSShH..',  // 9  same
        '...HHSSSSSSHH...',  // 10 same
        '..HH..SSSS..HH..',  // 11 same
        '..HHWwWWWWwWHH..',  // 12 same
        '.HHWbWWBWyWWWHH.',  // 13 same
        '.HHWoWWBWbWWWHH.',  // 14 same
        '.HHwSSSBSSSSWwH.',  // 15 same
        '..hHSSsBSSSShH..',  // 16 same
        '...WWSBBBBsWWW..',  // 17 same
        '....WWBBBWWW....',  // 18 same
        '....WWWWWWWW....',  // 19 same
        '....PPPPPPPP....',  // 20 same
        '...PPPpPPpPPP...',  // 21 same
        '..PPpp....ppPP..',  // 22 same
        '..PPp......pPP..',  // 23 same
        '..PPp......pPP..',  // 24 same
        '..PPp......pPP..',  // 25 same
        '..KKK......KKK..',  // 26 same
        '.KKKK......KKKK.',  // 27 same
      ],
    ],
    tags: ['🕶️ 圆框墨镜', '🧥 印花夹克', '💇 棕色长发', '👜 黑色挎包', '👖 阔腿裤', '💪 抱臂'],
  },

  /* ────────────── Avatar 2: 3D 公仔版 ────────────── */
  {
    id: 'xiaolan-doll',
    name: '像素小兰·玩偶',
    subtitle: '3D 公仔版 · 大头垂手',
    accent: 'from-[#8b5a3c] to-[#b27655]',
    palette: {
      H: '#7a4e33', // hair warm brown
      h: '#a07052', // hair highlight
      S: '#f7d7bd', // lighter doll skin
      s: '#e0b08f', // skin shadow / brows
      G: '#141414', // glasses
      g: '#2f3d4d', // lens reflection
      W: '#fbf7f2', // pure white jacket
      w: '#e9e1d6', // jacket shadow
      B: '#202125', // black bag/strap
      b: '#4080b0', // blue patch
      o: '#e08040', // orange patch
      y: '#e0b840', // yellow / "BO"
      P: '#f6f2ea', // white pants
      p: '#e5ded1', // pants fold
      K: '#e8e0d0', // cream/white shoes (doll!)
      L: '#d38b92', // lips (slightly more vivid)
    },
    frames: [
      // Frame A — 大头，可见耳朵，手放两侧，白鞋
      [
        '.....HHHHHH.....',  // 0  crown
        '....HHHHHHHH....',  // 1  expanding
        '...HHHHHHHHHH...',  // 2  wide
        '..HHHHHHHHHHHH..',  // 3  very wide (doll head)
        '.HHhHHHHHHHhHHH.',  // 4  widest + highlights
        '.HHHSSsSSsSSHHH.',  // 5  forehead + brows
        '.HHSGGGSSGGGSHH.',  // 6  sunglasses
        '.HHSGgGSSGGgSHH.',  // 7  gleam
        '.SHSSSSSSSSSSHS.',  // 8  wide face + ears
        '.SHSSSSSSSSSSHS.',  // 9  cheeks
        '..HSSSSSSSSSSH..',  // 10 narrowing
        '..HHSSSLLSSSHH..',  // 11 mouth + lips
        '...HHSSSSSSHH...',  // 12 chin
        '...HH..SS..HH...',  // 13 neck + hair draping
        '..HHWWWWWWWWHH..',  // 14 collar
        '..SWbWWBWyWWWS..',  // 15 shoulders + patches
        '..SWoWWBWbWWWS..',  // 16 torso + patches
        '..SWWWWBWWWWWS..',  // 17 arms + strap
        '...SWWBBBBWWS...',  // 18 hands + bag
        '....WWWWWWWW....',  // 19 waist
        '....PPPPPPPP....',  // 20 pants
        '...PPPpPPpPPP...',  // 21 wide pants
        '..PPpp....ppPP..',  // 22 folds
        '..PPp......pPP..',  // 23 legs
        '..PPp......pPP..',  // 24 legs
        '..KKK......KKK..',  // 25 shoes
        '.KKKK......KKKK.',  // 26 soles
        '................',  // 27 ground
      ],
      // Frame B — 头发微风 + 反光偏移
      [
        '......HHHHHH....',  // 0  hair shifts right
        '....HHHHHHHH....',  // 1  same
        '...HHHHHHHHHH...',  // 2  same
        '..HHHHHHHHHHHH..',  // 3  same
        '.HHHhHHHHHhHHHH.',  // 4  highlights shift
        '.HHHSSsSSsSSHHH.',  // 5  same
        '.HHSGGGSSGGGSHH.',  // 6  same
        '.HHSGGgSSGgGSHH.',  // 7  gleam shifts
        '.SHSSSSSSSSSSHS.',  // 8  same
        '.SHSSSSSSSSSSHS.',  // 9  same
        '..HSSSSSSSSSSH..',  // 10 same
        '..HHSSSLLSSSHH..',  // 11 same
        '...HHSSSSSSHH...',  // 12 same
        '...HH..SS..HH...',  // 13 same
        '..HHWWWWWWWWHH..',  // 14 same
        '..SWbWWBWyWWWS..',  // 15 same
        '..SWoWWBWbWWWS..',  // 16 same
        '..SWWWWBWWWWWS..',  // 17 same
        '...SWWBBBBWWS...',  // 18 same
        '....WWWWWWWW....',  // 19 same
        '....PPPPPPPP....',  // 20 same
        '...PPPpPPpPPP...',  // 21 same
        '..PPpp....ppPP..',  // 22 same
        '..PPp......pPP..',  // 23 same
        '..PPp......pPP..',  // 24 same
        '..KKK......KKK..',  // 25 same
        '.KKKK......KKKK.',  // 26 same
        '................',  // 27 same
      ],
    ],
    tags: ['🕶️ 大圆墨镜', '🧥 白色夹克', '💇 中分直发', '👜 斜挎小包', '👖 白色阔腿裤', '👂 呆萌大头'],
  },

  /* ────────────── Avatar 3: 旅行小兰 (墨镜西装女) ────────────── */
  {
    id: 'xiaolan-travel',
    name: '旅行小兰',
    subtitle: '西装墨镜 · 粉围巾行李箱',
    accent: 'from-[#3a4a60] to-[#e8a0a8]',
    palette: {
      H: '#4a2818', // dark brown short hair
      h: '#6b3a28', // hair highlight / wave
      S: '#f0c8a8', // skin warm
      s: '#d4a080', // skin shadow / brow
      G: '#1a1a1a', // glasses frame
      g: '#354555', // lens reflection
      N: '#3a4a60', // navy suit
      n: '#2a3648', // navy dark / shading
      W: '#f0ece0', // white shirt
      R: '#e8a0a8', // pink scarf
      r: '#d08890', // scarf dark
      T: '#d49050', // orange suitcase
      t: '#b07838', // suitcase shadow
      M: '#b84050', // open mouth
      K: '#3a3a3a', // dark shoes
      L: '#d08088', // lips
    },
    frames: [
      // Frame A — 短发波浪卷，粉色围巾，藏蓝西装，拉行李箱
      [
        '....HHHHHH......',  // 0  crown (short hair)
        '...HhHHHhHHH....',  // 1  curly highlights
        '..HHHHHHHHHH....',  // 2  full but short
        '..HhHHHHhHHHH...',  // 3  bangs curly
        '..HHSsSSSSsHH...',  // 4  forehead + brows
        '..HSGGGSSGGGSH..',  // 5  sunglasses
        '..HSGgGSSGGgSH..',  // 6  gleam
        '..HSSSSSSSSSH...',  // 7  cheeks (no drape)
        '..HSSSMMMSSSH...',  // 8  open mouth laughing
        '...HSSSSSSSSH...',  // 9  chin
        '...HHSSSSSHH....',  // 10 jaw
        '...RRRRRRRRRR...',  // 11 pink scarf
        '...RrRRSSRRrR...',  // 12 scarf + neck
        '..SNNWWWWWNNS...',  // 13 navy jacket + white
        '..SNNNNNNNNNS...',  // 14 navy torso
        '..SNnNNNNNnNS...',  // 15 shading
        '..SNnNNNNNnNS...',  // 16 lower torso
        '...SNNNNNNS.T...',  // 17 waist + handle
        '....NNNNNN.TT...',  // 18 pants + suitcase top
        '...NNnNNnNNTTT..',  // 19 pants + suitcase
        '...NNn..nNNTtT..',  // 20 legs + suitcase
        '...NNn..nNNTtT..',  // 21 legs + suitcase
        '...NNn..nNN.tT..',  // 22 legs + suitcase btm
        '...NNn..nNN.....',  // 23 legs only
        '....Nn..nN......',  // 24 ankles
        '...KKK..KKK.....',  // 25 shoes
        '..KKKK..KKKK....',  // 26 soles
        '................',  // 27 ground
      ],
      // Frame B — 头发微风 + 反光偏移 + 行李箱摆动
      [
        '.....HHHHHH.....',  // 0  hair shifts right
        '...HhHHHhHHH....',  // 1  same
        '..HHHHHHHHHH....',  // 2  same
        '..HhHHHHhHHHH...',  // 3  same
        '..HHSsSSSSsHH...',  // 4  same
        '..HSGGGSSGGGSH..',  // 5  same
        '..HSGGgSSGgGSH..',  // 6  gleam shifts
        '..HSSSSSSSSSH...',  // 7  same
        '..HSSSMMSSSSH...',  // 8  mouth slightly closed
        '...HSSSSSSSSH...',  // 9  same
        '...HHSSSSSHH....',  // 10 same
        '...RRRRRRRRRR...',  // 11 same
        '...RrRRSSRRrR...',  // 12 same
        '..SNNWWWWWNNS...',  // 13 same
        '..SNNNNNNNNNS...',  // 14 same
        '..SNnNNNNNnNS...',  // 15 same
        '..SNnNNNNNnNS...',  // 16 same
        '...SNNNNNNS..T..',  // 17 handle sways
        '....NNNNNN..TT..',  // 18 suitcase sways
        '...NNnNNnNN.TTT.',  // 19 suitcase sways
        '...NNn..nNN.TtT.',  // 20 sways
        '...NNn..nNN.TtT.',  // 21 sways
        '...NNn..nNN..tT.',  // 22 sways
        '...NNn..nNN.....',  // 23 same
        '....Nn..nN......',  // 24 same
        '...KKK..KKK.....',  // 25 same
        '..KKKK..KKKK....',  // 26 same
        '................',  // 27 same
      ],
    ],
    tags: ['🕶️ 圆框墨镜', '🧣 粉色围巾', '💼 藏蓝西装', '🧳 橙色行李箱', '👧 短发波浪卷', '😆 开怀大笑'],
  },

  /* ────────────── Avatar 4: 冬日小兰 (红帽暖冬) ────────────── */
  {
    id: 'xiaolan-winter',
    name: '冬日小兰',
    subtitle: '红帽羽绒 · 暖手微笑',
    accent: 'from-[#c82030] to-[#a01828]',
    palette: {
      R: '#c82030', // red hat & coat
      r: '#a01828', // red shadow
      D: '#e83840', // ribbing highlight
      H: '#5a3520', // dark brown hair
      h: '#7a4e33', // hair highlight
      S: '#f7d0b0', // skin warm
      s: '#d4a080', // skin shadow / brows / closed eyes
      C: '#f0a0a0', // blush
      L: '#d07080', // lips
      P: '#4a3848', // dark pants
      p: '#3a2838', // pants shadow
      K: '#6a3020', // brown boots
    },
    frames: [
      // Frame A — 红帽，闭眼微笑，双手合十暖手
      [
        '......RRRRR.....',  // 0  beanie peak
        '.....RRRRRRR....',  // 1  beanie wider
        '....RRDRRRDRRR..',  // 2  ribbing
        '....RRRRRRRRRR..',  // 3  beanie body
        '...RRDRRRDRRDRR.',  // 4  ribbing detail
        '..RRRRRRRRRRRR..',  // 5  brim
        '..HhSSSSSSSSHH..',  // 6  hair + forehead
        '.HHhSSSSSSSSHHH.',  // 7  hair sides wider
        '.HHSsSSSSSsSHHH.',  // 8  closed eyes
        '.HHSSCSSSCSSHH..',  // 9  blush cheeks
        '..HHSSSLSSSHH...',  // 10 smile
        '...HHSSSSHH.....',  // 11 chin
        '...HH.SS.HHHH...',  // 12 neck + hair right
        '..RRRRSSRRRRHH..',  // 13 coat collar + hair
        '.RRRRRRRRRRrRHH.',  // 14 shoulders + hair
        '.RrRRRRRRRRrRRR.',  // 15 quilting
        '.RRRSSSSSRRRRR..',  // 16 arms + clasped hands
        '.RRSSSSSSsRRRR..',  // 17 hands detail
        '..RRSSSSSRRR....',  // 18 hands lower
        '..rRRRRRRRRr....',  // 19 coat body
        '...RRRRRRRR.....',  // 20 coat lower
        '...rRRRRRRr.....',  // 21 coat bottom
        '....RRRRRR......',  // 22 coat hem
        '....PPPPPP......',  // 23 pants
        '...PPp..pPP.....',  // 24 legs
        '...KKK..KKK.....',  // 25 boots
        '..KKKK..KKKK....',  // 26 soles
        '................',  // 27 ground
      ],
      // Frame B — 搓手暖手动画
      [
        '.....RRRRR......',  // 0  beanie shifts left
        '.....RRRRRRR....',  // 1  beanie
        '....RRDRRRDRRR..',  // 2  same
        '....RRRRRRRRRR..',  // 3  same
        '...RRDRRRDRRDRR.',  // 4  same
        '..RRRRRRRRRRRR..',  // 5  same
        '..HhSSSSSSSSHH..',  // 6  same
        '.HHhSSSSSSSSHHH.',  // 7  same
        '.HHSsSSSSSsSHHH.',  // 8  same
        '.HHSSCSSSCSSHH..',  // 9  same
        '..HHSSSLSSSHH...',  // 10 same
        '...HHSSSSHH.....',  // 11 same
        '...HH.SS.HHHH...',  // 12 same
        '..RRRRSSRRRRHH..',  // 13 same
        '.RRRRRRRRRRrRHH.',  // 14 same
        '.RrRRRRRRRRrRRR.',  // 15 same
        '.RRRSSSSsRRRRR..',  // 16 hands shift slightly
        '.RRSSSSSsSRRRR..',  // 17 rubbing motion
        '..RRSSSSRRRR....',  // 18 hands shift
        '..rRRRRRRRRr....',  // 19 same
        '...RRRRRRRR.....',  // 20 same
        '...rRRRRRRr.....',  // 21 same
        '....RRRRRR......',  // 22 same
        '....PPPPPP......',  // 23 same
        '...PPp..pPP.....',  // 24 same
        '...KKK..KKK.....',  // 25 same
        '..KKKK..KKKK....',  // 26 same
        '................',  // 27 same
      ],
    ],
    tags: ['🧶 红色毛线帽', '🧥 红色羽绒服', '😌 闭眼微笑', '🙏 双手暖手', '💇 棕色长发', '☺️ 红扑扑脸蛋'],
  },

  /* ────────────── Avatar 5: 酷飒小兰 (墨镜扶框·拉行李箱) ────────────── */
  {
    id: 'xiaolan-cool',
    name: '酷飒小兰',
    subtitle: '扶框墨镜 · 拉箱出发',
    accent: 'from-[#3a4a60] to-[#e8a0a8]',
    palette: {
      H: '#4a2818', // dark brown hair
      h: '#6b3a28', // hair highlight / wave
      S: '#f0c8a8', // skin warm
      s: '#d4a080', // skin shadow / brow
      G: '#1a1a1a', // glasses frame
      g: '#354555', // lens reflection
      N: '#3a4a60', // navy suit
      n: '#2a3648', // navy dark
      W: '#f0ece0', // white shirt
      R: '#e8a0a8', // pink scarf
      r: '#d08890', // scarf dark
      T: '#d49050', // orange suitcase
      t: '#b07838', // suitcase shadow
      M: '#b84050', // open mouth
      K: '#3a3a3a', // dark shoes
    },
    frames: [
      // Frame A — 左手扶墨镜，右手拉行李箱，张嘴大笑
      [
        '.....HHHHHH.....',  // 0  crown (short wavy)
        '....HhHHhHHH....',  // 1  wavy highlights
        '...HHHHHHHHHH...',  // 2  full volume
        '..HHhHHHHHhHHH..',  // 3  widest + waves
        '..HHSSSSSSSSSHH.',  // 4  forehead
        '.SSSGGGSSGGGSSH.',  // 5  hand at glasses left
        '.SHSGGGSSGGGSSH.',  // 6  fingers on frame
        '..SHSSSSSSSSHH..',  // 7  cheeks
        '..HHSSSMMSSSSH..',  // 8  open mouth laughing
        '...HHSSSSSSHH...',  // 9  chin
        '....HHSSSSHH....',  // 10 jaw
        '...RRRRRRRRRR...',  // 11 pink scarf
        '...RrRRSSRRrR...',  // 12 scarf + neck
        '..SNNWWWWWNNS...',  // 13 suit + white shirt
        '.SSNNNNNNNNNS...',  // 14 raised left arm
        'SSNNNNNNNNNNS...',  // 15 arm reaching up
        '.SNNNNNNNNNNS.T.',  // 16 arm down + handle
        '..SNNNNNNNS.TT..',  // 17 waist + suitcase
        '...NNNNNNN.TTT..',  // 18 pants + suitcase
        '..NNnNNnNN.TtT..',  // 19 pants + suitcase
        '..NNn..nNN.TtT..',  // 20 legs + suitcase
        '..NNn..nNN.TtT..',  // 21 legs + suitcase
        '..NNn..nNN..tT..',  // 22 legs + suitcase btm
        '..NNn..nNN......',  // 23 legs only
        '...Nn..nN.......',  // 24 ankles
        '..KKK..KKK......',  // 25 shoes
        '.KKKK..KKKK.....',  // 26 soles
        '................',  // 27 ground
      ],
      // Frame B — 反光偏移 + 行李箱摆动
      [
        '......HHHHHH....',  // 0  hair shifts right
        '....HhHHhHHH....',  // 1  same
        '...HHHHHHHHHH...',  // 2  same
        '..HHhHHHHHhHHH..',  // 3  same
        '..HHSSSSSSSSSHH.',  // 4  same
        '.SSSGGGSSGGGSSH.',  // 5  same
        '.SHSGGgSSGgGSSH.',  // 6  gleam shifts
        '..SHSSSSSSSSHH..',  // 7  same
        '..HHSSSMMSSSSH..',  // 8  same
        '...HHSSSSSSHH...',  // 9  same
        '....HHSSSSHH....',  // 10 same
        '...RRRRRRRRRR...',  // 11 same
        '...RrRRSSRRrR...',  // 12 same
        '..SNNWWWWWNNS...',  // 13 same
        '.SSNNNNNNNNNS...',  // 14 same
        'SSNNNNNNNNNNS...',  // 15 same
        '.SNNNNNNNNNNS..T',  // 16 suitcase sways
        '..SNNNNNNNS..TT.',  // 17 sways
        '...NNNNNNN..TTT.',  // 18 sways
        '..NNnNNnNN..TtT.',  // 19 sways
        '..NNn..nNN..TtT.',  // 20 sways
        '..NNn..nNN..TtT.',  // 21 sways
        '..NNn..nNN...tT.',  // 22 sways
        '..NNn..nNN......',  // 23 same
        '...Nn..nN.......',  // 24 same
        '..KKK..KKK......',  // 25 same
        '.KKKK..KKKK.....',  // 26 same
        '................',  // 27 same
      ],
    ],
    tags: ['🕶️ 扶框墨镜', '🧣 粉色围巾', '💼 藏蓝西装', '🧳 橙色行李箱', '👩 短发波浪卷', '😆 张嘴大笑'],
  },
];

const PIXEL_STAGE_THEMES: Record<string, PixelStageTheme> = {
  xiaolan: {
    top: '#fff5eb',
    bottom: '#f3e1d1',
    glow: '#f3c8ac',
    sparkA: '#e8ae46',
    sparkB: '#d58ea2',
    sparkC: '#7490c8',
    floor: '#c59e86',
    shadow: '#6d432f',
  },
  'xiaolan-doll': {
    top: '#fff7ee',
    bottom: '#f1e7dc',
    glow: '#f3d8bf',
    sparkA: '#e8b96b',
    sparkB: '#d2a0af',
    sparkC: '#8e9cc9',
    floor: '#cfbca8',
    shadow: '#715746',
  },
  'xiaolan-travel': {
    top: '#f4f6fc',
    bottom: '#e8eef7',
    glow: '#b7c3df',
    sparkA: '#efb35f',
    sparkB: '#e4a0b3',
    sparkC: '#6d86bc',
    floor: '#9ba9c6',
    shadow: '#45526c',
  },
  'xiaolan-winter': {
    top: '#fff2f3',
    bottom: '#f8e2e6',
    glow: '#f6bcc7',
    sparkA: '#e6a34f',
    sparkB: '#dc7b8f',
    sparkC: '#9b8ec6',
    floor: '#d58e9a',
    shadow: '#7a3242',
  },
  'xiaolan-cool': {
    top: '#f4f6fc',
    bottom: '#e7edf8',
    glow: '#b8c4e1',
    sparkA: '#efb35f',
    sparkB: '#e49bb0',
    sparkC: '#6a84bb',
    floor: '#99a9c7',
    shadow: '#42526d',
  },
};

/** Render a pixel-art frame as SVG <rect> list */
function renderFrame(grid: string[], palette: PixelPalette) {
  const rects: React.ReactElement[] = [];
  grid.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== '.' && palette[ch]) {
        rects.push(
          <rect
            key={`${x}-${y}`}
            x={x * PIXEL}
            y={y * PIXEL}
            width={PIXEL}
            height={PIXEL}
            fill={palette[ch]}
          />
        );
      }
    });
  });
  return rects;
}

/* ─── Inline PixelAvatar SVG (reusable) ─── */
export const PixelAvatarSVG: React.FC<{
  avatar: PixelAvatarDefinition;
  scale?: number;
  animated?: boolean;
}> = ({
  avatar,
  scale = 2.5,
  animated = true,
}) => {
  const frameA = useMemo(() => renderFrame(avatar.frames[0], avatar.palette), [avatar]);
  const frameB = useMemo(() => renderFrame(avatar.frames[1], avatar.palette), [avatar]);
  const cols = avatar.frames[0][0].length;
  const rows = avatar.frames[0].length;
  const w = cols * PIXEL;
  const h = rows * PIXEL;
  const svgW = w + 40;
  const svgH = h + 20;
  const stageTheme = PIXEL_STAGE_THEMES[avatar.id] ?? PIXEL_STAGE_THEMES.xiaolan;
  const gradientId = `pixel-stage-${avatar.id}`;
  const haloId = `pixel-halo-${avatar.id}`;
  const floorId = `pixel-floor-${avatar.id}`;
  const frameFilterId = `pixel-frame-shadow-${avatar.id}`;

  // Dynamically find glasses position for gleam effect
  const glassesRow = avatar.frames[0].findIndex(row => row.includes('G'));
  const glassesCol = glassesRow >= 0 ? avatar.frames[0][glassesRow].indexOf('G') : 4;

  return (
    <div className="pixel-avatar-stage">
      <svg
        width={svgW * scale}
        height={svgH * scale}
        viewBox={`0 0 ${svgW} ${svgH}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stageTheme.top} />
            <stop offset="100%" stopColor={stageTheme.bottom} />
          </linearGradient>
          <radialGradient id={haloId} cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor={stageTheme.glow} stopOpacity="0.85" />
            <stop offset="70%" stopColor={stageTheme.glow} stopOpacity="0.12" />
            <stop offset="100%" stopColor={stageTheme.glow} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={floorId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={stageTheme.floor} stopOpacity="0" />
            <stop offset="50%" stopColor={stageTheme.floor} stopOpacity="0.5" />
            <stop offset="100%" stopColor={stageTheme.floor} stopOpacity="0" />
          </linearGradient>
          <filter id={frameFilterId} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="2" stdDeviation="1.2" floodColor="#2e1b14" floodOpacity="0.12" />
          </filter>
        </defs>

        {/* Stage plate */}
        <rect
          x="6"
          y="4"
          width={svgW - 12}
          height={h + 8}
          rx="14"
          fill={`url(#${gradientId})`}
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="0.9"
          filter={`url(#${frameFilterId})`}
        />
        <ellipse cx={svgW / 2} cy={h * 0.52} rx={w * 0.48} ry={h * 0.42} fill={`url(#${haloId})`} />

        {/* Floor line */}
        <line
          x1="10"
          y1={h + 8}
          x2={svgW - 10}
          y2={h + 8}
          stroke={`url(#${floorId})`}
          strokeWidth="1"
        />

        {/* Shadow */}
        <ellipse
          className={animated ? 'pixel-avatar-shadow' : ''}
          cx={svgW / 2}
          cy={h + 10}
          rx={w * 0.3}
          ry={2.5}
          fill={stageTheme.shadow}
          opacity="0.14"
        />

        {/* Sparkle effects */}
        {animated && (
          <>
            <circle className="pixel-avatar-sparkle-a" r="2" fill={stageTheme.sparkA} />
            <circle className="pixel-avatar-sparkle-b" r="1.5" fill={stageTheme.sparkB} />
            <circle className="pixel-avatar-sparkle-c" r="1.5" fill={stageTheme.sparkC} />
          </>
        )}

        {/* Character positioned center */}
        <g transform={`translate(20, 0)`}>
          <g className={animated ? 'pixel-avatar-bounce' : ''}>
            {/* Frame A */}
            <g className={animated ? 'pixel-avatar-frame-a' : ''}>{frameA}</g>
            {/* Frame B */}
            {animated && <g className="pixel-avatar-frame-b">{frameB}</g>}

            {/* Sunglasses gleam sweep */}
            {animated && (
              <rect
                className="pixel-avatar-gleam"
                x={glassesCol * PIXEL}
                y={glassesRow * PIXEL}
                width={3}
                height={2 * PIXEL}
                fill="white"
                opacity="0"
                rx="1"
              />
            )}
          </g>
        </g>
      </svg>
    </div>
  );
};

/* ─── Full-screen Showcase Modal ─── */
export const PixelAvatarShowcase: React.FC<PixelAvatarShowcaseProps> = ({ isOpen, onClose }) => {
  const [activeIndex, setActiveIndex] = useState(1); // 默认显示公仔版
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  if (!isOpen) return null;

  const activeAvatar = AVATARS[activeIndex];

  const goPrev = () => setActiveIndex((i) => (i - 1 + AVATARS.length) % AVATARS.length);
  const goNext = () => setActiveIndex((i) => (i + 1) % AVATARS.length);

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
    const canvas = document.createElement('canvas');
    const scale = 20;
    const frame = activeAvatar.frames[0];
    const cols = frame[0].length;
    const rows = frame.length;
    canvas.width = cols * scale;
    canvas.height = rows * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    frame.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        if (ch !== '.' && activeAvatar.palette[ch]) {
          ctx.fillStyle = activeAvatar.palette[ch];
          ctx.fillRect(x * scale, y * scale, scale, scale);
        }
      });
    });
    const link = document.createElement('a');
    link.download = `${activeAvatar.name}.png`;
    link.href = canvas.toDataURL();
    link.click();
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
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="关闭"
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-10"
        >
          <X className="w-5 h-5 text-[var(--eye-text-secondary)]" />
        </button>

        {/* Title */}
        <h3 className="text-center text-lg font-bold text-[var(--eye-text-primary)] mb-1">
          ✨ 像素小兰
        </h3>
        <p className="text-center text-xs text-[var(--eye-text-secondary)] mb-3">
          左右滑动切换形象
        </p>

        {/* Dot indicators */}
        <div className="flex items-center justify-center gap-2 mb-3">
          {AVATARS.map((av, i) => (
            <button
              key={av.id}
              type="button"
              aria-label={av.name}
              onClick={() => setActiveIndex(i)}
              className={`w-2 h-2 rounded-full transition-all ${
                i === activeIndex
                  ? 'bg-[var(--eye-text-primary)] scale-125'
                  : 'bg-[var(--eye-text-secondary)]/30'
              }`}
            />
          ))}
        </div>

        {/* Avatar carousel */}
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
            {AVATARS.map((avatar) => (
              <div key={avatar.id} className="pixel-avatar-slide">
                <PixelAvatarSVG avatar={avatar} scale={2.2} animated />
              </div>
            ))}
          </div>

          <div className="pixel-avatar-nav">
            <button
              type="button"
              aria-label="上一个形象"
              onClick={goPrev}
              className="pixel-avatar-nav-btn"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              aria-label="下一个形象"
              onClick={goNext}
              className="pixel-avatar-nav-btn"
            >
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

        {/* Feature tags */}
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

        {/* Download button */}
        <button
          onClick={handleDownload}
          className={`w-full mt-5 h-11 rounded-xl bg-gradient-to-r ${activeAvatar.accent} text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:opacity-90 shadow-md`}
        >
          <Download className="w-4 h-4" />
          下载像素头像
        </button>
      </div>
    </div>
  );
};
