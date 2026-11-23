/*
 * Interface strings for every locale. Chinese domain terms follow `src/i18n/zh-terms.md`.
 */

import type { StarStatus } from '../astrolabe/chart';
import type { Role, ThreadKind } from '../lib/questions';
import type { Energy, Size } from '../lib/questions/constellation-format';
import type { Status } from '../lib/status';
import type { Locale } from './locale';

const en = {
  siteName: 'Oneiros Wiki',
  languageName: 'English',
  readIn: 'Read this page in English',
  noTranslation: 'No Chinese version of this page yet',
  skip: 'Skip to content',
  menu: 'Menu',
  search: 'Search',
  searchPlaceholder: 'Search the Dreamlands',
  searchResults: 'Search results',
  searchUnavailable: 'Search is available on the built site.',
  searchNone: 'No pages match.',
  theme: 'Theme',
  themeSystem: 'system',
  themeLight: 'light',
  themeDark: 'dark',
  themeAuto: 'Auto',
  themeLightLabel: 'Light',
  themeDarkLabel: 'Dark',
  mainPage: 'Main page',
  randomPage: 'Random page',
  glossaryIndex: 'Glossary index',
  vision: 'Vision',
  sheetTables: 'Sheet tables',
  areas: 'Areas',
  tools: 'Tools',
  whatLinksHere: 'What links here',
  noLinksHere: 'No pages link here yet.',
  openQuestions: 'Open questions',
  specialPage: 'Special page',
  article: 'Article',
  source: 'Source',
  history: 'History',
  contents: 'Contents',
  categories: 'Categories',
  colon: ': ',
  fromWiki: 'From the Oneiros Wiki',
  openQuestion: 'Open question',
  conflictBare: 'Conflict',
  conflictBetween: (names: string[]) =>
    `Conflict: ${names.slice(0, -1).join(', ')} and ${names.at(-1)} disagree`,
  /** Sources a conflict's Source row may name that are not wiki pages, by English name. */
  conflictSources: { vision: 'vision', sheet: 'sheet' } as Record<string, string>,
  englishOnly: 'English only',
  englishData: 'English data',
  englishDataNote: 'This table is not translated yet.',
  pairedWith: 'Paired with',
  featureClaims: 'Feature claims',
  aspect: 'Aspect',
  claim: 'Claim',
  how: 'How',
  asItDeepens: 'As it deepens',
  codeContinuous: 'Continuous: always there once the quality reaches this stage',
  codePervasive: 'Continuous and pervasive: spreads across a whole wing or the whole house',
  codeUnlock: 'Unlocked: appears only when its trigger happens',
  pageMissing: (name: string) => `${name} (page does not exist)`,
  lastEdited: (date: string) => `This page was last edited on ${date}.`,
  footer:
    'Oneiros is a just-for-fun game design project. Text drawn from the vision doc and Glossary.',
  infoboxLabel: (title: string) => `${title} summary`,
  area: 'Area',
  /** Display names of areas; URLs and frontmatter keep the English name. */
  areaNames: {} as Record<string, string>,
  status: 'Status',
  /** Display names of the page statuses; frontmatter keeps the English name. */
  statusNames: {
    Notion: 'Notion',
    Tenet: 'Tenet',
    Certainty: 'Certainty',
    Dogma: 'Dogma',
  } satisfies Record<Status, string>,
  all: 'All',
  pageCount: (n: number) => (n === 1 ? '1 page' : `${n} pages`),

  /* Main page */
  mainDescription: 'The Oneiros game design wiki: a systemic RPG set in the Dreamlands.',
  welcomeTitle: 'Welcome to the Oneiros Wiki',
  mainSub: (pages: number, _translated: number) =>
    `A just-for-fun game design project. ${pages} pages so far.`,
  welcome: `
Oneiros is a dream journal that becomes a game you can share. It is a systemic RPG in the spirit of Caves of Qud, set in [[Dreamlands|the Dreamlands]]: the dream of [[Dreamer|the Dreamer]], a vast, cosmic and unknowable being, shared by everyone who plays.

You write down your real dreams, and they become places in the world that you can explore, grow and share with other players. Around them is a full RPG of emotional magic, shifting rumours and a world that turns through sleep cycles.

Five pillars hold it together:

- **Dream world:** a living dream that keeps surfacing new regions
- **Emotion magic:** eight emotions, each a motion of the will; magic changes how things feel
- **Your dreams as Reveries:** the journal is the game's most distinctive feature, though optional
- **Grows itself:** an LLM fills gaps in the world, always within the engine's rules
- **Fair to play free:** paying buys novelty, never power
`,
  exploreHeading: 'Explore the Dreamlands',
  findYourWay: 'Find your way',
  glossaryCard: 'Every term of the domain language, A to Z, filterable by area.',
  tablesCard: (n: number) => `All ${n} tabs of the reference sheet.`,
  openCard: (n: number) => `${n} open questions and conflicts waiting to be settled.`,
  randomCard: 'Drift somewhere new.',

  /* Glossary index */
  glossaryDescription: 'Every Glossary term in the wiki, A to Z.',
  glossarySub: (n: number) => `Every Glossary term with a page, A to Z. ${n} terms so far.`,

  /* Categories */
  categoryTitle: (name: string) => `Category: ${name}`,
  categoryDescription: (name: string) => `Pages in the ${name} category.`,
  categorySub: (n: number) => `${n === 1 ? '1 page' : `${n} pages`} in this category.`,
  categoryEmpty: 'No pages in this category yet.',
  categoryOpen: 'Pages with open questions',
  categoryConflict: 'Pages with conflicts',

  /* Open questions */
  openDescription: 'Every open question and conflict across the wiki.',
  openSub: (n: number) =>
    `Every open question and every conflict between sources, by constellation: ${n} in all.`,
  openNone: 'No open questions yet.',
  openUngrouped: 'Not in a constellation',
  openUngroupedSub: 'Open questions that no constellation holds yet, page by page.',
  openUnmarked: 'Not on a page',
  openUnmarkedSub: 'Open question issues that no page marks yet, by area.',
  noArea: 'No area',
  onGithub: (n: number) => `#${n} on GitHub`,
  onThePage: 'on the page',
  constellationSize: 'Size',
  constellationEnergy: 'Energy',
  constellationSizes: { small: 'Small', medium: 'Medium', large: 'Large' } as Record<Size, string>,
  constellationEnergies: { low: 'Low', medium: 'Medium', high: 'High' } as Record<Energy, string>,
  constellationSettled: (settled: number, total: number) => `${settled} of ${total} settled`,
  constellationFact: (label: string, value: string) => `${label}: ${value}`,
  questionMissing: (n: number) =>
    `Question #${n} is not in the question cache. Run \`bun run pull\`.`,

  /* Astrolabe: the star map of every question. */
  astrolabe: {
    name: 'Astrolabe',
    description:
      'Every question on the wiki as a star: what is ready to ask, what waits, and what is settled.',
    sub: 'Every question on the wiki as a star, clustered by area or by constellation.',
    seeMap: 'See every question as a star map in the Astrolabe.',
    stats: (c: Record<string, number>) =>
      `${c.open} open: ${c.frontier} on the frontier, ${c.blocked} blocked. ${c.decided} decided, ${c['ruled-out']} ruled out, ${c.undermined} undermined.`,
    empty: 'No questions yet. Run `bun run pull` to fetch them from GitHub.',
    view: 'View',
    views: { sky: 'Night sky', tiers: 'Tiers', brass: 'Dial' },
    hint: 'Drag to pan; pinch, Ctrl and scroll, or the buttons to zoom. Select a star to read it.',
    tiersHint:
      'Settled ground on the left, the frontier next, then the questions further out. Select a star to read it.',
    brassHint:
      'Each mark is one constellation, in the sector of its main area and on the ring of the energy it needs. Select one to read it.',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    resetView: 'Reset the view',
    fullScreen: 'Full screen',
    showSettled: 'Show settled',
    exitFullScreen: 'Exit full screen',
    key: 'Key',
    named: (name: string) => `${name}.`,
    status: {
      frontier: 'Frontier',
      blocked: 'Blocked',
      decided: 'Decided',
      'ruled-out': 'Ruled out',
      undermined: 'Undermined',
    } satisfies Record<StarStatus, string>,
    statusHelp: {
      frontier: 'Open, and every blocker is settled. Ready to ask.',
      blocked: 'Open, but waiting on a question that is not settled.',
      decided: 'Closed as decided.',
      'ruled-out': 'Closed as not planned.',
      undermined: 'Decided, but a later question broke its premise.',
    } satisfies Record<StarStatus, string>,
    conflict: 'Conflict',
    withConflict: (status: string) => `${status}, conflict`,
    conflictHelp: 'Two sources disagree. Drawn in red.',
    roles: {
      central: 'Central',
      peripheral: 'Peripheral',
      independent: 'Independent',
    } satisfies Record<Role, string>,
    roleHelp: {
      central: (n: number) => `Open, and blocks ${n} or more open questions. A larger star.`,
      peripheral: () => 'On the frontier, and no open question waits on it. A small moon.',
      independent: () =>
        'Open, with no links to any question, not even a related one. A dotted orbit.',
    } satisfies Record<Role, (n: number) => string>,
    threads: {
      unsettled: 'Blocked by a question that is not settled: open or undermined.',
      settled: 'Blocked by a settled question: decided or ruled out.',
      undermines: 'Broke the premise of a decision.',
    } satisfies Record<ThreadKind, string>,
    areaGlow: 'Each soft glow is one of the wiki’s areas.',
    tiers: ['Settled ground', 'Frontier', 'One step out', 'Two steps out', 'Further out'],
    tierHelp: [
      'Closed questions',
      'Ready to ask now',
      'Waits on one question',
      'Waits on a chain of two',
      'Waits on a longer chain',
    ],
    areaOpen: (open: number, all: number) => `${open} open of ${all}`,
    starLabel: (n: number, title: string, status: string, area: string) =>
      `#${n}: ${title}${/[?.!]$/.test(title) ? '' : '.'} ${status}, ${area}.`,
    close: 'Close',
    question: 'Question',
    context: 'Context',
    answer: 'Answer',
    links: 'Links',
    blockedBy: 'Blocked by',
    blocks: 'Blocks',
    underminedBy: 'Undermined by',
    undermines: 'Undermines',
    onPage: 'See it on its wiki page',
    constellations: 'Constellations',
    clusterBy: 'Cluster by',
    clusters: { areas: 'Areas', constellations: 'Constellations' } as Record<string, string>,
    noConstellation: 'In no constellation',
    constellationsSub:
      'Groups of open questions, each sized to settle in one session. Keep lit the ones that fit the time and energy you have.',
    time: 'Time',
    any: 'Any',
    fit: (fit: number, all: number) =>
      all === 1 ? `${fit} of 1 constellation fits.` : `${fit} of ${all} constellations fit.`,
    noConstellations: 'No constellations yet.',
    constellation: 'Constellation',
    members: 'Its questions',
    constellationsOnPage: 'Each name leads to its questions on the Open questions page.',
    ungrouped: (n: number) => `Not in a constellation (${n})`,
    constellationKey: 'Lines join the questions of one constellation.',
    ungroupedKey: 'An open question in no constellation yet.',
    /* The constellations view: a brass dial. */
    dialCount: (n: number) => (n === 1 ? '1 constellation' : `${n} constellations`),
    dialUngrouped: (n: number) =>
      n === 1 ? '1 open question in none' : `${n} open questions in none`,
    dialEnergy: 'Energy rises outward',
    noEnergy: 'Not set',
    markLabel: (name: string, facts: string) => `${name}. ${facts}.`,
    milestone: 'Milestone on GitHub',
    areas: 'Areas',
    starInSky: 'Show it in the night sky',
    onItsPage: 'On its page',
    dialKey: [
      'Sectors are the areas; rings are energy, low near the hub and high at the rim.',
      'A constellation sits in the area holding most of its questions; a tie goes to the area first in the wiki.',
      'A larger mark is a larger constellation: small, medium or large.',
      'Each notch round a mark is one of its questions; a gold notch is settled.',
    ],
    inspiredBy: 'Inspired by',
    licence: '(MIT).',
  },

  /* Status */
  statusDescription: "How settled a page's design idea is.",
  statusIntro:
    "Status shows how settled the idea on a page is. It sits in the page's infobox, or beside the title when the page has no infobox. A page shows a Status only once it has been given one.",
  statusStagesLead: 'The four stages, from least to most settled:',
  /** The text before and after the link to the belief stages. */
  statusNote: [
    'Status uses the same ladder as the four ',
    ": it shows the wiki's own beliefs about how the game should play. It is not a game concept and has no Glossary term.",
  ] as readonly [string, string],
  statusBeliefStages: 'belief stages',
  statusIcon: 'Icon',
  statusStage: 'Stage',
  statusMeaning: 'Meaning',
  statusPagesHeading: 'Pages by status',
  statusNoPages: 'No pages at this stage yet.',
  /** What each stage means for a page, keyed by the English stage name. */
  statusMeanings: {
    Notion: 'Mentioned or sketched; the core is still open or in conflict.',
    Tenet: 'Premise accepted, to keep and refine; details still open.',
    Certainty: 'Agreed and audited, nothing open.',
    Dogma: 'Locked by the designer; it will not change.',
  } satisfies Record<Status, string>,
  statusRulesHeading: 'Rules',
  statusRules: [
    'Only the designer raises a status. Claude may propose a status for a new page, or propose lowering one.',
    'Certainty needs a passed canon audit and nothing open. Dogma also needs the designer to lock it, and its page changes only with their approval.',
    'The build fails if a Certainty or Dogma page holds an open question or a conflict.',
    'Tenet pages keep changing as the design is refined. Claude asks whether a Tenet status still holds only when a change, conflict or open question challenges the premise itself.',
    'Very little is set in stone yet.',
  ],

  /* Random page */
  randomFinding: 'Finding a page…',
  randomNoScript: (link: string) => `Random page needs JavaScript. Try the ${link}.`,
  randomFailed: 'No page could be picked. Try the Glossary index instead.',

  /* Sheet tables */
  tablesDescription: 'Every tab of the reference sheet.',
  tablesSub: 'Every tab of the reference sheet, as tables.',
  archive: 'Archive',
  archiveNote: 'Superseded ideas, kept for reference.',
  archiveSub: 'Archive: superseded ideas',
  tabDescription: (title: string) => `The ${title} tab of the reference sheet.`,

  /* 404 */
  notFoundTitle: 'Page not written yet',
  notFoundMsg: 'There is no page at this address yet.',
  notFoundNamed:
    'The page "{name}" has not been written yet. Its link shows red wherever it appears.',
  notFoundHelp: (glossary: string, open: string, main: string) =>
    `Red links point to pages that have not been written. Try the ${glossary}, the ${open} or the ${main}.`,
  notFoundOpen: 'open questions',
};

export type UI = typeof en;

const zh: UI = {
  siteName: 'Oneiros 维基',
  languageName: '中文',
  readIn: '阅读本页的中文版',
  noTranslation: '本页尚无英文版',
  skip: '跳到正文',
  menu: '菜单',
  search: '搜索',
  searchPlaceholder: '搜索梦境之地',
  searchResults: '搜索结果',
  searchUnavailable: '搜索仅在构建后的网站上可用。',
  searchNone: '没有匹配的页面。',
  theme: '主题',
  themeSystem: '跟随系统',
  themeLight: '浅色',
  themeDark: '深色',
  themeAuto: '自动',
  themeLightLabel: '浅色',
  themeDarkLabel: '深色',
  mainPage: '首页',
  randomPage: '随机页面',
  glossaryIndex: '术语索引',
  vision: '愿景',
  sheetTables: '参考表格',
  areas: '领域',
  tools: '工具',
  whatLinksHere: '链入页面',
  noLinksHere: '尚无页面链接到此处。',
  openQuestions: '待定问题',
  specialPage: '特殊页面',
  article: '条目',
  source: '源文件',
  history: '历史',
  contents: '目录',
  categories: '分类',
  colon: '：',
  fromWiki: '来自 Oneiros 维基',
  openQuestion: '待定问题',
  conflictBare: '冲突',
  conflictBetween: (names) => `冲突：${names.slice(0, -1).join('、')}与${names.at(-1)}不一致`,
  conflictSources: { vision: '愿景', sheet: '参考表' },
  englishOnly: '仅有英文版（English only）',
  englishData: '英文数据',
  englishDataNote: '此表尚未翻译，以下为英文原文。',
  pairedWith: '与之成对',
  featureClaims: '特征占据',
  aspect: '面向',
  claim: '占据',
  how: '方式',
  asItDeepens: '随其加深',
  codeContinuous: '连续：品质达到此阶段后始终存在',
  codePervasive: '连续且遍及：扩散到整个侧翼或整座宅邸',
  codeUnlock: '解锁：只在触发条件发生时出现',
  pageMissing: (name) => `${name}（页面不存在）`,
  lastEdited: (date) => `本页最后编辑于${date}。`,
  footer: 'Oneiros 是一个出于兴趣的游戏设计项目。文字取自愿景文档与术语表。',
  infoboxLabel: (title) => `${title}概要`,
  area: '领域',
  status: '状态',
  statusNames: {
    Notion: '念头',
    Tenet: '信条',
    Certainty: '确信',
    Dogma: '教条',
  },
  areaNames: {
    Beliefs: '信念',
    Body: '身体与形态',
    Character: '角色',
    Dreams: '你的梦',
    Economy: '经济',
    Emotion: '情感',
    Items: '物品',
    Library: '藏书室',
    Lore: '典故',
    Lucidity: '清明',
    Magic: '魔法',
    Memory: '记忆',
    Philosophy: '哲学',
    Rest: '休息',
    Temenos: '圣域',
    World: '世界',
  },
  all: '全部',
  pageCount: (n) => `${n} 个页面`,

  mainDescription: 'Oneiros 游戏设计维基：一款以梦境之地为舞台的系统驱动角色扮演游戏。',
  welcomeTitle: '欢迎来到 Oneiros 维基',
  mainSub: (pages, translated) =>
    `一个出于兴趣的游戏设计项目。目前共有 ${pages} 个页面，其中 ${translated} 个已有中文版。`,
  welcome: `
Oneiros 是一本可以变成游戏、并与他人分享的梦境日记。它是一款系统驱动的角色扮演游戏，玩法近似《Caves of Qud》，故事发生在[[Dreamlands|梦境之地]]：那是一个庞大、宇宙般、不可知的存在[[Dreamer|做梦者]]所做的梦，由所有玩家共享。

你写下自己真实的梦，它们会成为世界里的地方，你可以探索、扩展，并与其他玩家分享。围绕它们的，是一整套角色扮演系统：情感魔法、不断变化的谣言，以及按睡眠周期运转的世界。

五大支柱撑起整个游戏：

- **梦境世界**：一个活着的梦，不断浮现新的区域
- **情感魔法**：八种情感，每一种都是意志的一种运动；魔法改变的是事物的感受
- **你的梦成为遐梦**：梦境日记是游戏最独特的部分，但完全可选
- **自我生长**：大语言模型（LLM）填补世界的空白，始终在引擎的规则之内
- **免费也公平**：付费只买新鲜感，永远不买实力
`,
  exploreHeading: '探索梦境之地',
  findYourWay: '导航',
  glossaryCard: '领域术语全表，按字母排序，可按领域筛选。',
  tablesCard: (n) => `参考表格的全部 ${n} 个分页。`,
  openCard: (n) => `${n} 个待定问题与冲突，等待定夺。`,
  randomCard: '随意漂流到一个新地方。',

  glossaryDescription: '维基中的所有术语，按字母排序。',
  glossarySub: (n) => `所有已有页面的术语，按英文字母排序。目前共 ${n} 个。`,

  categoryTitle: (name) => `分类：${name}`,
  categoryDescription: (name) => `${name}分类中的页面。`,
  categorySub: (n) => `本分类共有 ${n} 个页面。`,
  categoryEmpty: '此分类尚无页面。',
  categoryOpen: '含待定问题的页面',
  categoryConflict: '含冲突的页面',

  openDescription: '整个维基中的所有待定问题与冲突。',
  openSub: (n) => `按星座列出所有待定问题，以及各来源之间的所有冲突：共 ${n} 处。`,
  openNone: '尚无待定问题。',
  openUngrouped: '不在星座中',
  openUngroupedSub: '尚未归入任何星座的待定问题，逐页列出。',
  openUnmarked: '不在页面上',
  openUnmarkedSub: '尚无页面标出的待定问题，按领域列出。',
  noArea: '无领域',
  onGithub: (n) => `GitHub 上的 #${n}`,
  onThePage: '查看原处',
  constellationSize: '规模',
  constellationEnergy: '精力',
  constellationSizes: { small: '小', medium: '中', large: '大' },
  constellationEnergies: { low: '低', medium: '中', high: '高' },
  constellationSettled: (settled, total) => `已定 ${settled} / ${total}`,
  constellationFact: (label, value) => `${label}：${value}`,
  questionMissing: (n) => `问题缓存中没有问题 #${n}。请运行 \`bun run pull\`。`,

  astrolabe: {
    name: '星盘',
    description: '维基上的每个问题都是一颗星：哪些可以先问，哪些在等待，哪些已经定下。',
    sub: '维基上的每个问题都是一颗星，按领域或星座聚集。',
    seeMap: '在星盘中把所有问题看作一幅星图。',
    stats: (c) =>
      `${c.open} 个待定：${c.frontier} 个前沿，${c.blocked} 个受阻。${c.decided} 个已定，${c['ruled-out']} 个不采纳，${c.undermined} 个前提动摇。`,
    empty: '尚无问题。请运行 `bun run pull` 从 GitHub 获取。',
    view: '视图',
    views: { sky: '夜空', tiers: '层级', brass: '表盘' },
    hint: '拖动平移；双指、Ctrl 加滚轮或按钮缩放。选择一颗星即可阅读。',
    tiersHint: '左边是已定之地，接着是前沿，再往右是更远的问题。选择一颗星即可阅读。',
    brassHint:
      '每枚标记是一个星座，位于其主要领域的扇区，落在它所需精力的圆环上。选择一枚即可阅读。',
    zoomIn: '放大',
    zoomOut: '缩小',
    resetView: '重置视图',
    fullScreen: '全屏',
    showSettled: '显示已定问题',
    exitFullScreen: '退出全屏',
    key: '图例',
    named: (name) => `${name}：`,
    status: {
      frontier: '前沿',
      blocked: '受阻',
      decided: '已定',
      'ruled-out': '不采纳',
      undermined: '前提动摇',
    },
    statusHelp: {
      frontier: '待定，且所有阻挡它的问题都已定下。可以先问。',
      blocked: '待定，但仍在等一个尚未定下的问题。',
      decided: '已定并关闭。',
      'ruled-out': '不采纳并关闭。',
      undermined: '已定，但后来的问题动摇了它的前提。',
    },
    conflict: '冲突',
    withConflict: (status) => `${status}，冲突`,
    conflictHelp: '两处来源互相矛盾。以红色绘出。',
    roles: {
      central: '核心',
      peripheral: '边缘',
      independent: '独立',
    },
    roleHelp: {
      central: (n) => `待定，且阻挡 ${n} 个或更多待定问题。星更大。`,
      peripheral: () => '处于前沿，且没有待定问题在等它。旁边有一颗小卫星。',
      independent: () => '待定，与任何问题都没有关联，连相关问题也没有。外绕虚线轨道。',
    },
    threads: {
      unsettled: '被一个尚未定下的问题阻挡：待定或前提动摇。',
      settled: '被一个已定下的问题阻挡：已定或不采纳。',
      undermines: '动摇了一项决定的前提。',
    },
    areaGlow: '每团柔光是维基的一个领域。',
    tiers: ['已定之地', '前沿', '一步之外', '两步之外', '更远处'],
    tierHelp: [
      '已关闭的问题',
      '现在就可以问',
      '在等一个问题',
      '在等一串两个问题',
      '在等更长的一串问题',
    ],
    areaOpen: (open, all) => `${all} 个中 ${open} 个待定`,
    starLabel: (n, title, status, area) =>
      `#${n}：${title}${/[？。！?.!]$/.test(title) ? '' : '。'}${status}，${area}。`,
    close: '关闭',
    question: '问题',
    context: '背景',
    answer: '答案',
    links: '关联',
    blockedBy: '阻挡它的',
    blocks: '它阻挡的',
    underminedBy: '动摇它的',
    undermines: '它动摇的',
    onPage: '在维基页面上查看',
    constellations: '星座',
    clusterBy: '聚集方式',
    clusters: { areas: '领域', constellations: '星座' },
    noConstellation: '不在任何星座中',
    constellationsSub:
      '一组组待定问题，每组的大小都适合一次定夺。只点亮符合你现有时间和精力的星座。',
    time: '时间',
    any: '不限',
    fit: (fit, all) => `${all} 个星座中有 ${fit} 个合适。`,
    noConstellations: '尚无星座。',
    constellation: '星座',
    members: '其中的问题',
    constellationsOnPage: '点击名称，可在待定问题页面查看其中的问题。',
    ungrouped: (n) => `不在星座中（${n}）`,
    constellationKey: '连线把同一星座的问题串在一起。',
    ungroupedKey: '尚不属于任何星座的待定问题。',
    dialCount: (n) => `${n} 个星座`,
    dialUngrouped: (n) => `${n} 个待定问题不在任何星座中`,
    dialEnergy: '精力由内向外递增',
    noEnergy: '未设',
    markLabel: (name, facts) => `${name}。${facts}。`,
    milestone: 'GitHub 上的里程碑',
    areas: '领域',
    starInSky: '在夜空中显示',
    onItsPage: '在其页面上',
    dialKey: [
      '扇区是领域；圆环是精力，低的靠近中心，高的靠近外缘。',
      '星座位于收纳其最多问题的领域；数量相同时，取维基中排在前面的领域。',
      '标记越大，星座规模越大：小、中或大。',
      '标记周围的每道刻痕是其中一个问题；金色刻痕表示已定。',
    ],
    inspiredBy: '灵感来自',
    licence: '（MIT）。',
  },

  statusDescription: '页面所述设计想法的确定程度。',
  statusIntro:
    '状态表示页面上的想法有多确定。页面有信息框时，状态显示在信息框中；没有信息框时，显示在标题旁。只有被赋予状态的页面才会显示它。',
  statusStagesLead: '四个阶段，从最不确定到最确定：',
  statusNote: [
    '状态沿用四个',
    '的同一阶梯：它表示维基自身对游戏应如何运作的信念。它不是游戏概念，也没有术语表词条。',
  ],
  statusBeliefStages: '信念阶段',
  statusIcon: '图标',
  statusStage: '阶段',
  statusMeaning: '含义',
  statusPagesHeading: '按状态列出的页面',
  statusNoPages: '此阶段尚无页面。',
  statusMeanings: {
    Notion: '只是提及或已有雏形；核心仍未确定或存在冲突。',
    Tenet: '前提已接受，予以保留并完善；细节仍未确定。',
    Certainty: '已约定并经过审核，没有未决问题。',
    Dogma: '由设计者锁定，不会再变。',
  },
  statusRulesHeading: '规则',
  statusRules: [
    '只有设计者能提升状态。Claude 可以为新页面提议状态，或提议降低状态。',
    '确信需要通过正典审核，且没有未决问题。教条还需设计者锁定，其页面只有经设计者同意才会改动。',
    '如果确信或教条页面含有未决问题或冲突，构建会失败。',
    '信条页面会随着设计的完善而不断改动。只有当改动、冲突或未决问题动摇其前提本身时，Claude 才会询问其信条状态是否仍然成立。',
    '目前定下来的东西还很少。',
  ],

  randomFinding: '正在寻找页面…',
  randomNoScript: (link) => `随机页面需要 JavaScript。请试试${link}。`,
  randomFailed: '无法选出页面。请改用术语索引。',

  tablesDescription: '参考表格的每个分页。',
  tablesSub: '参考表格的每个分页，以表格形式呈现。',
  archive: '存档',
  archiveNote: '已被取代的想法，留作参考。',
  archiveSub: '存档：已被取代的想法',
  tabDescription: (title) => `参考表格中的 ${title} 分页。`,

  notFoundTitle: '页面尚未撰写',
  notFoundMsg: '此地址尚无页面。',
  notFoundNamed: '页面“{name}”尚未撰写。指向它的链接在各处都显示为红色。',
  notFoundHelp: (glossary, open, main) =>
    `红色链接指向尚未撰写的页面。请试试${glossary}、${open}或${main}。`,
  notFoundOpen: '待定问题',
};

export const UI_STRINGS: Record<Locale, UI> = { en, zh };

export function useTranslations(locale: Locale): UI {
  return UI_STRINGS[locale];
}
