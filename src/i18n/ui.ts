/*
 * Interface strings for every locale. Chinese domain terms follow `src/i18n/zh-terms.md`.
 */

import type { Status } from '../lib/status';

export const LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** The `<html lang>` value; Pagefind builds one search index per value. */
export const HTML_LANG: Record<Locale, string> = { en: 'en-GB', zh: 'zh-Hans' };

/** Noto Serif SC for titles and Noto Sans SC for body text, loaded on zh pages only. */
export const CJK_FONTS =
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;600;700&family=Noto+Serif+SC:wght@500;600;700&display=swap';

export function toLocale(value: unknown): Locale {
  return value === 'zh' ? 'zh' : 'en';
}

export function otherLocale(locale: Locale): Locale {
  return locale === 'zh' ? 'en' : 'zh';
}

/** The `[...locale]` route param: undefined for English, so its URLs keep no prefix. */
export function localeParam(locale: Locale): string | undefined {
  return locale === DEFAULT_LOCALE ? undefined : locale;
}

/** `getStaticPaths` entries for a page under `src/pages/[...locale]/`, one per locale. */
export function localePaths() {
  return LOCALES.map((locale) => ({ params: { locale: localeParam(locale) }, props: { locale } }));
}

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
  conflict: 'Conflict: vision and sheet disagree',
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
    `Every open question and every conflict between sources, page by page: ${n} in all.`,
  openNone: 'No open questions yet.',
  openUnmarked: 'Not on a page',
  openUnmarkedSub: 'Open question issues that no page marks yet, by area.',
  noArea: 'No area',
  onGithub: (n: number) => `#${n} on GitHub`,
  onThePage: 'on the page',
  questionMissing: (n: number) =>
    `Question #${n} is not in the question cache. Run \`bun run pull\`.`,

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
  conflict: '冲突：愿景与参考表不一致',
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
  openSub: (n) => `逐页列出所有待定问题，以及各来源之间的所有冲突：共 ${n} 处。`,
  openNone: '尚无待定问题。',
  openUnmarked: '不在页面上',
  openUnmarkedSub: '尚无页面标出的待定问题，按领域列出。',
  noArea: '无领域',
  onGithub: (n) => `GitHub 上的 #${n}`,
  onThePage: '查看原处',
  questionMissing: (n) => `问题缓存中没有问题 #${n}。请运行 \`bun run pull\`。`,

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
