/*
 * Argus checker. Runs inside a rendered page and returns measured findings.
 * Evaluate the compiled file's text in the page: `argus-skill check <url>` does
 * that for you, or use a browser tool's script call, Playwright's page.evaluate,
 * or the devtools console. It reads the page and changes nothing.
 *
 * Returns { url, viewport, summary, countsByRule, findings, notes }.
 * Severity: P0 broken, P1 excludes or confuses users, P2 visible roughness,
 * "tell" = a common generated-design default; judge whether it was chosen.
 *
 * This file has no imports or exports on purpose: it must compile to a single
 * expression whose value is the result.
 */
(function argusCheck() {
  type Severity = 'P0' | 'P1' | 'P2' | 'tell';
  type Rgba = [number, number, number, number];
  interface Finding {
    rule: string;
    severity: Severity;
    where: string;
    message: string;
  }

  const MAX_PER_RULE = 6;
  const findings: Finding[] = [];
  const counts: Record<string, number> = {};
  const severityCounts: Record<Severity, number> = { P0: 0, P1: 0, P2: 0, tell: 0 };
  const notes: string[] = [];
  // A phone browser widens its viewport to fit overflowing content, which would
  // hide the overflow. The screen's own width does not move.
  // Only trust the screen when it is phone-sized: on a desktop it says nothing about the window.
  const screenW = window.screen?.width ?? 0;
  const vw = screenW > 0 && screenW <= 480 && screenW < window.innerWidth ? screenW : window.innerWidth;
  const vh = window.innerHeight;

  const all = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] =>
    Array.from(root.querySelectorAll<T>(selector));
  const textOf = (el: Element): string => ((el as HTMLElement).innerText ?? el.textContent ?? '').trim();

  function describe(el: Element | null): string {
    if (!el || !el.tagName) return 'page';
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (typeof el.className === 'string' && el.className.trim()) {
      s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    }
    const t = (textOf(el) || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ');
    if (t) s += ' "' + t.slice(0, 40) + (t.length > 40 ? '...' : '') + '"';
    return s;
  }

  function add(rule: string, severity: Severity, el: Element | null, message: string): void {
    const n = (counts[rule] ?? 0) + 1;
    counts[rule] = n;
    severityCounts[severity]++; // every finding, shown or not
    if (n <= MAX_PER_RULE) findings.push({ rule, severity, where: describe(el), message });
  }

  function isVisible(el: Element): boolean {
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // ---- colour helpers -----------------------------------------------------
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map<string, Rgba>();

  function rgba(str: string): Rgba {
    const cached = colorCache.get(str);
    if (cached) return cached;
    let out: Rgba = [0, 0, 0, 0];
    if (ctx && str) {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = 'rgba(0,0,0,0)';
      ctx.fillStyle = str;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      out = [d[0] ?? 0, d[1] ?? 0, d[2] ?? 0, (d[3] ?? 0) / 255];
    }
    colorCache.set(str, out);
    return out;
  }

  function over(top: Rgba, bottom: Rgba): Rgba {
    const a = top[3];
    return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1];
  }

  function luminance(c: Rgba): number {
    const lin = (x: number): number => {
      const v = x / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  }

  function ratio(a: Rgba, b: Rgba): number {
    const la = luminance(a);
    const lb = luminance(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  /** Effective background behind an element, or null when an image or gradient makes it unknowable from styles alone. */
  function backgroundOf(el: Element): Rgba | null {
    const layers: Rgba[] = [];
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null;
      const c = rgba(cs.backgroundColor);
      if (c[3] > 0) {
        layers.push(c);
        if (c[3] >= 0.999) break;
      }
    }
    let base: Rgba = [255, 255, 255, 1];
    for (let i = layers.length - 1; i >= 0; i--) {
      const layer = layers[i];
      if (layer) base = over(layer, base);
    }
    return base;
  }

  /** Visually hidden helpers (skip links, screen-reader-only labels) are deliberately tiny; they are not layout problems. */
  function isScreenReaderOnly(el: Element): boolean {
    let n: Element | null = el;
    for (let i = 0; n && i < 3; n = n.parentElement, i++) {
      const r = n.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2) return true;
    }
    return false;
  }

  // ---- collect elements that directly hold text ----------------------------
  let svgText = 0;
  const textEls: HTMLElement[] = [];
  const seen = new Set<Element>();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.nodeValue || !node.nodeValue.trim()) continue;
    const p = node.parentElement;
    if (!p || seen.has(p)) continue;
    const tag = p.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'OPTION') continue;
    seen.add(p);
    // SVG text is painted with fill, not color, and scales with its drawing,
    // so the HTML text rules below would misreport it.
    if (p.namespaceURI === 'http://www.w3.org/2000/svg') {
      svgText++;
      continue;
    }
    if (isVisible(p) && !isScreenReaderOnly(p)) textEls.push(p);
  }
  if (svgText) notes.push(svgText + ' text elements are inside SVG drawings; check their size and contrast by eye.');

  // ---- contrast, small text, gradient text ---------------------------------
  let unknownBg = 0;
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const clip = cs.webkitBackgroundClip || cs.backgroundClip;
    if (clip === 'text') {
      add('gradient-text', 'tell', el, 'Text is filled with a background (gradient text).');
      continue;
    }
    if (size < 12) add('small-text', 'P2', el, 'Text is ' + size + 'px; below 12px is hard to read.');
    const fg = rgba(cs.color);
    if (fg[3] === 0) continue;
    const bg = backgroundOf(el);
    if (!bg) {
      unknownBg++;
      continue;
    }
    let eff: Rgba = fg[3] < 1 ? over(fg, bg) : fg;
    let opacity = 1;
    for (let n: Element | null = el; n; n = n.parentElement) opacity *= parseFloat(getComputedStyle(n).opacity);
    if (opacity < 1) eff = over([eff[0], eff[1], eff[2], opacity], bg);
    const r = ratio(eff, bg);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    if (r >= need) continue;
    if (el.closest('[disabled],[aria-disabled="true"]')) continue;
    // Text lifted out of normal flow may sit over something other than its
    // ancestors, so the measured background can be wrong. Report it for a
    // look instead of as a certain failure.
    let lifted = false;
    for (let a: Element | null = el; a && a !== document.body; a = a.parentElement) {
      const style = getComputedStyle(a);
      if (style.position === 'absolute' || style.position === 'fixed') {
        lifted = true;
        break;
      }
      if (rgba(style.backgroundColor)[3] >= 0.999) break;
    }
    if (lifted) {
      add('contrast-uncertain', 'P2', el, 'Contrast may be ' + r.toFixed(2) + ':1 against its container, but the text is positioned over other content; confirm by eye.');
      continue;
    }
    add('contrast', r < 3 ? 'P0' : 'P1', el, 'Contrast ' + r.toFixed(2) + ':1, needs ' + need + ':1 (' + Math.round(size) + 'px text).');
  }
  if (unknownBg) notes.push(unknownBg + ' text elements sit on an image or gradient; check their contrast by eye.');

  // ---- horizontal overflow --------------------------------------------------
  const docW = document.documentElement.scrollWidth;
  if (docW > vw + 1) {
    add('page-overflow', 'P0', null, 'Page is ' + docW + 'px wide in a ' + vw + 'px viewport; it scrolls sideways.');
    for (const el of all<Element>('*', document.body)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.right <= vw + 1) continue;
      let deeper = false;
      for (let kid = el.firstElementChild; kid; kid = kid.nextElementSibling) {
        if (kid.getBoundingClientRect().right > vw + 1) {
          deeper = true;
          break;
        }
      }
      if (!deeper && getComputedStyle(el).position !== 'fixed') {
        add('overflow-source', 'P0', el, 'Extends to ' + Math.round(rect.right) + 'px, past the ' + vw + 'px viewport.');
      }
    }
  }

  // ---- page length on phones -------------------------------------------------
  if (vw <= 430 && vh > 0) {
    const screens = document.documentElement.scrollHeight / vh;
    if (screens > 12) {
      add('page-length', 'P2', null, 'Page is about ' + Math.round(screens) + ' screens tall at this width (' + document.documentElement.scrollHeight +
        'px). Past about ten, use compact cards, collapse long sections or cut repeats.');
    }
  }

  // ---- clipped text ---------------------------------------------------------
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    if (cs.overflowX === 'hidden' && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') {
      add('clipped-text', 'P1', el, 'Text is cut off with no ellipsis (' + el.scrollWidth + 'px in ' + el.clientWidth + 'px).');
    }
  }

  // ---- collapsed columns ----------------------------------------------------
  // A block squeezed so narrow that its text breaks to a word or less per line
  // is a broken layout (typically a grid or flex item that lost its width).
  const collapsedSeen = new Set<Element>();
  for (const el of textEls) {
    let block: HTMLElement | null = el;
    while (block && block !== document.body && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement;
    if (!block || block === document.body || collapsedSeen.has(block)) continue;
    collapsedSeen.add(block);
    const text = textOf(block);
    if (text.length < 30 || !text.includes(' ')) continue;
    const cs = getComputedStyle(block);
    if (cs.writingMode && cs.writingMode !== 'horizontal-tb') continue;
    const w = block.clientWidth;
    if (w > 0 && w < parseFloat(cs.fontSize) * 5) {
      add('collapsed-column', 'P0', block, 'Text block is only ' + w + 'px wide, so its text breaks to about a word per line. The layout has collapsed.');
    }
  }

  // ---- forms that lead nowhere ----------------------------------------------
  let serverForms = 0;
  for (const form of all<HTMLFormElement>('form')) {
    const action = (form.getAttribute('action') ?? '').trim();
    if (/^mailto:/i.test(action)) {
      add('form-mailto', 'P1', form, 'Form submits to a mailto: address, which opens an email client and shows no confirmation.');
    } else if (action && action !== '#') {
      serverForms++;
    }
  }
  if (serverForms) notes.push(serverForms + ' form(s) submit to a server address; complete each one by hand to confirm it ends in a confirmation and not an error.');

  // ---- line length ----------------------------------------------------------
  for (const el of all('p, li, blockquote, dd')) {
    if (!isVisible(el)) continue;
    const text = textOf(el);
    if (text.length < 240) continue;
    const cs = getComputedStyle(el);
    const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4;
    const lines = Math.max(1, Math.round(el.getBoundingClientRect().height / lh));
    const perLine = text.length / lines;
    if (perLine > 90) add('line-length', 'P2', el, 'About ' + Math.round(perLine) + ' characters per line; aim for 45-75.');
  }

  // ---- touch targets --------------------------------------------------------
  const touch = vw <= 820 || matchMedia('(pointer: coarse)').matches;
  const interactive = all(
    'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="switch"]',
  );
  for (const el of interactive) {
    if (!isVisible(el) || isScreenReaderOnly(el)) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    // The standard exempts links inside a sentence. Navigation and footer links are not that.
    const inlineLink =
      el.tagName === 'A' &&
      cs.display === 'inline' &&
      !el.closest('nav, header, footer') &&
      !!el.closest('p, li, td, dd, blockquote, figcaption') &&
      !!el.parentElement &&
      textOf(el.parentElement).length > textOf(el).length + 20;
    if (inlineLink) continue;
    let w = r.width;
    let h = r.height;
    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      const label = el.labels?.[0];
      if (label) {
        const lr = label.getBoundingClientRect();
        w = Math.max(w, lr.width);
        h = Math.max(h, lr.height);
      }
    }
    w = Math.round(w);
    h = Math.round(h);
    // A lone text link (nav, footer) usually passes the standard through its
    // spacing exception, so report it as roughness, not a failure.
    const textLink = el.tagName === 'A' && !el.querySelector('img, svg') && cs.display.startsWith('inline');
    if (w < 24 || h < 24) {
      add('target-size', touch && !textLink ? 'P1' : 'P2', el, 'Target is ' + w + 'x' + h + 'px; the minimum is 24px and 44px is the goal on touch.');
    } else if (touch && (w < 44 || h < 44)) {
      add('target-size', 'P2', el, 'Target is ' + w + 'x' + h + 'px on a touch-sized viewport; aim for 44px.');
    }
  }

  // ---- names and labels -----------------------------------------------------
  function hasName(el: Element): boolean {
    if (textOf(el)) return true;
    if (el.getAttribute('aria-label') || el.getAttribute('title')) return true;
    const by = el.getAttribute('aria-labelledby');
    const firstId = by ? by.split(/\s+/)[0] : undefined;
    if (firstId && document.getElementById(firstId)) return true;
    return !!el.querySelector('img[alt]:not([alt=""]), svg[aria-label], svg title');
  }
  for (const el of all('button, a[href], [role="button"]')) {
    if (isVisible(el) && !hasName(el)) add('no-name', 'P1', el, 'Control has no accessible name (no text, aria-label or labelled image).');
  }
  for (const el of all<HTMLImageElement>('img')) {
    if (!el.hasAttribute('alt')) add('img-alt', 'P1', el, 'Image has no alt attribute (use alt="" if decorative).');
  }
  type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  for (const el of all<Field>('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')) {
    if (!isVisible(el)) continue;
    const visibleLabel = (el.labels?.length ?? 0) > 0 || !!el.getAttribute('aria-labelledby');
    const labelled = visibleLabel || !!el.getAttribute('aria-label') || !!el.getAttribute('title');
    if (!labelled) add('no-label', 'P1', el, 'Form field has no label (a placeholder is not a label).');
    else if (!visibleLabel && !['range', 'checkbox', 'radio', 'search'].includes(el.type)) {
      add('hidden-label', 'P2', el, 'Form field is named only for screen readers; sighted users lose the label once they type. Add a visible label.');
    }
  }
  // An iPhone zooms the whole page when a field with text under 16px is focused.
  if (vw <= 430) {
    for (const el of all<Field>('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea')) {
      if (!isVisible(el)) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 16) add('input-zoom', 'P2', el, 'Field text is ' + size + 'px; under 16px an iPhone zooms the page when the field is focused.');
    }
  }
  for (const el of all('a[href="#"], a[href=""]')) {
    if (isVisible(el)) add('dead-link', 'P2', el, 'Link goes nowhere (href="#").');
  }

  // ---- headings -------------------------------------------------------------
  const heads = all<HTMLHeadingElement>('h1,h2,h3,h4,h5,h6').filter(isVisible);
  const h1s = heads.filter((h) => h.tagName === 'H1').length;
  if (h1s !== 1) add('h1-count', 'P2', null, 'Page has ' + h1s + ' h1 elements; it should have one.');
  let prev = 0;
  for (const h of heads) {
    const lvl = parseInt(h.tagName.slice(1), 10);
    if (prev && lvl > prev + 1) add('heading-skip', 'P2', h, 'Heading jumps from h' + prev + ' to h' + lvl + '.');
    prev = lvl;
  }

  // ---- motion ---------------------------------------------------------------
  let hasMotion = false;
  let hasReduced = false;
  const scan = (list: CSSRuleList): void => {
    for (const rule of Array.from(list)) {
      if (rule instanceof CSSMediaRule && /prefers-reduced-motion/.test(rule.conditionText)) hasReduced = true;
      if (rule instanceof CSSKeyframesRule) hasMotion = true;
      // Transitions are feedback on interaction; only self-running animation needs a reduced-motion rule.
      if (rule instanceof CSSStyleRule && rule.style.animationName && rule.style.animationName !== 'none') hasMotion = true;
      if (rule instanceof CSSGroupingRule) scan(rule.cssRules);
    }
  };
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      scan(sheet.cssRules);
    } catch {
      /* a stylesheet from another origin cannot be read */
    }
  }
  const running = typeof document.getAnimations === 'function' ? document.getAnimations() : [];
  if (running.length) hasMotion = true;
  if (hasMotion && !hasReduced) add('reduced-motion', 'P1', null, 'The page animates but has no prefers-reduced-motion rule.');

  // Movement that never stops needs a way to pause it.
  let endless = 0;
  for (const anim of running) {
    const effect = anim.effect;
    if (!(effect instanceof KeyframeEffect)) continue;
    const target = effect.target;
    if (effect.getTiming().iterations === Infinity && target && isVisible(target) && target.getBoundingClientRect().width > 40) endless++;
  }
  if (endless) {
    const pauseControl = all('button, [role="button"]').some((b) =>
      /\b(pause|stop|play)\b/i.test(textOf(b) + ' ' + (b.getAttribute('aria-label') ?? '') + ' ' + (b.getAttribute('title') ?? '')),
    );
    if (!pauseControl) add('no-pause', 'P1', null, endless + ' animation(s) loop forever and no pause or stop control was found.');
  }
  if (vw > 330) notes.push('Sideways overflow is only measured at the current width (' + vw + 'px). Run again at 320.');
  if (!document.querySelector('meta[name="viewport"]')) add('viewport-meta', 'P0', null, 'No viewport meta tag; the page will not fit phone screens.');
  if (!document.documentElement.getAttribute('lang')) add('lang', 'P2', null, 'The html element has no lang attribute.');

  // ---- tells ----------------------------------------------------------------
  // Emoji_Presentation excludes text symbols such as the copyright sign.
  const emoji = /\p{Emoji_Presentation}/u;
  for (const el of all('h1,h2,h3,h4,button,a,li,th,label')) {
    if (!isVisible(el)) continue;
    const own = Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.nodeValue ?? '')
      .join('');
    if (emoji.test(own)) add('emoji-icon', 'tell', el, 'Emoji used in a heading, control or list item.');
  }
  for (const h of heads) {
    const before = h.previousElementSibling;
    if (!before || !isVisible(before)) continue;
    const cs = getComputedStyle(before);
    const t = textOf(before);
    if (t && t.length < 40 && parseFloat(cs.fontSize) <= 14 && (cs.textTransform === 'uppercase' || (t === t.toUpperCase() && /[A-Z]/.test(t)))) {
      add('eyebrow', 'tell', before, 'Small all-caps label above a heading.');
    }
  }
  const bodyText = document.body.innerText ?? '';
  const slop = ['elevate', 'seamless', 'seamlessly', 'unlock', 'supercharge', 'effortless', 'effortlessly', 'reimagine', 'revolutionize',
    'game-changing', 'cutting-edge', 'next-level', 'world-class', 'unleash', 'empower'];
  const found = slop.filter((w) => new RegExp('\\b' + w + '\\b', 'i').test(bodyText));
  if (found.length) add('filler-words', 'tell', null, 'Marketing filler found: ' + found.join(', ') + '.');
  if (/lorem ipsum/i.test(bodyText)) add('placeholder-text', 'P1', null, 'Lorem ipsum placeholder text is visible.');
  if (/\b(John|Jane) Doe\b|\bAcme\b/.test(bodyText)) add('stock-names', 'tell', null, 'Stock placeholder names (John Doe, Acme) are visible.');
  const fadeUps = document.querySelectorAll('[data-aos], [class*="fade-up"], [class*="fadeUp"], [class*="reveal"]').length;
  if (fadeUps > 4) add('scroll-reveals', 'tell', null, fadeUps + ' elements are set up to animate in on scroll.');

  // ---- countable design rules ------------------------------------------------
  // All-caps text needs letter-spacing to stay readable.
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    const t = textOf(el);
    if (cs.textTransform !== 'uppercase' || t.length < 4) continue;
    const size = parseFloat(cs.fontSize);
    if (size > 20) continue; // large display type is set tight on purpose
    const spacing = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing);
    if (size > 0 && spacing / size < 0.04) {
      add('caps-tracking', 'P2', el, 'All-caps text with no letter-spacing; add about 0.06em so the letters do not crowd.');
    }
  }

  // Too many text sizes reads as noise. Five to seven covers most screens.
  const sizes = new Set<number>();
  for (const el of textEls) sizes.add(Math.round(parseFloat(getComputedStyle(el).fontSize)));
  if (sizes.size > 12) {
    add('many-type-sizes', 'P2', null, sizes.size + ' different text sizes are in use (' + Array.from(sizes).sort((a, b) => a - b).join(', ') + 'px). Most screens need five to seven, plus one or two display sizes.');
  }

  // Several filled buttons in the same colour on one screen compete for the primary action.
  const pageBg = backgroundOf(document.body) ?? [255, 255, 255, 1];
  const filled = new Map<string, HTMLElement[]>();
  for (const el of all('button, a[href], input[type="submit"], [role="button"]')) {
    if (!isVisible(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.top >= vh || r.bottom <= 0 || r.width < 60 || r.height < 28) continue;
    if (el.closest('[class*="logo" i], [class*="brand" i], [class*="wordmark" i]')) continue; // a filled logo is not an action
    const bg = rgba(getComputedStyle(el).backgroundColor);
    if (bg[3] < 0.9 || ratio(bg, pageBg) < 1.6) continue;
    const key = bg.slice(0, 3).map((n) => Math.round(n)).join(',');
    const list = filled.get(key) ?? [];
    list.push(el);
    filled.set(key, list);
  }
  for (const list of filled.values()) {
    const first = list[0];
    if (list.length > 2 && first) {
      add('competing-actions', 'P2', first, list.length + ' filled buttons in the same colour are visible on the first screen; one primary action should stand out.');
    }
  }

  // ---- result ---------------------------------------------------------------
  let dropped = 0;
  for (const n of Object.values(counts)) if (n > MAX_PER_RULE) dropped += n - MAX_PER_RULE;
  if (dropped) notes.push(dropped + ' further findings were omitted (more than ' + MAX_PER_RULE + ' per rule); see countsByRule.');
  notes.push('Not checked: focus visibility, keyboard order, states, whether forms complete, overlapping or colliding labels, and anything about taste. Check those by hand.');

  return {
    url: location.href,
    viewport: vw + 'x' + vh,
    summary: severityCounts,
    countsByRule: counts,
    findings,
    notes,
  };
})();
