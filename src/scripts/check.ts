/*
 * Argus checker. Runs inside a rendered page and returns measured findings.
 * Evaluate the compiled file's text in the page: `argus-skill check <url>` does
 * that for you, or use a browser tool's script call, Playwright's page.evaluate,
 * or the devtools console. It reads the page and changes nothing that lasts: the
 * focus checks move keyboard focus for a moment (without scrolling), then restore
 * the focused element and the scroll position of the window and of any container.
 * Run it before, not during, an interaction driven by hand.
 *
 * App mode: for an app prototype (a phone app built as an HTML page, screens
 * switched by URL hash, modal sheets over a scrim), set
 * `window.__argusCheckOptions = { app: true }` before evaluating this file;
 * `shot.js --check --app` does that. It relaxes a few web-page rules (listed in
 * APP_RELAXED below) and adds `mode` and `relaxed` to the result. Without it,
 * nothing changes.
 *
 * Returns { url, viewport, summary, countsByRule, findings, notes }.
 * Severity: P0 broken, P1 excludes or confuses users, P2 visible roughness,
 * P3 minor polish or a prompt to confirm a choice,
 * "tell" = a common generated-design default; judge whether it was chosen.
 * The rule catalogue (`argus-skill rules`) lists every rule id used here.
 *
 * This file has no imports or exports on purpose: it must compile to a single
 * expression whose value is the result.
 */
(function argusCheck() {
  // Run directly under Node (`node check.js`, `--help`), there is no page: say how to run it, and exit 0.
  if (typeof document === 'undefined') {
    console.log('check.js runs inside a rendered page, not on its own: use `node shot.js <url-or-file> --check` or `argus-skill check <url-or-file>`, or evaluate its text in the page with a browser tool.');
    return null;
  }
  type Severity = 'P0' | 'P1' | 'P2' | 'P3' | 'tell';
  type Rgba = [number, number, number, number];
  type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  interface Finding {
    rule: string;
    severity: Severity;
    where: string;
    message: string;
  }
  interface Sample {
    /** The first solid background at the point, or null where a picture, drawing or gradient is in front. */
    colour: Rgba | null;
    el: Element | null;
  }

  const MAX_PER_RULE = 6;
  const findings: Finding[] = [];
  const counts: Record<string, number> = {};
  const severityCounts: Record<Severity, number> = { P0: 0, P1: 0, P2: 0, P3: 0, tell: 0 };
  const notes: string[] = [];
  // A phone browser widens window.innerWidth to fit overflowing content, which would hide the
  // overflow. The layout viewport (the root's clientWidth) and the visual viewport keep the width
  // the page was laid out for, so the smallest of the three is the viewport. screen.width is not
  // used: some browsers (Brave) report the window's size there instead of the emulated screen's.
  const vw = Math.min(...[window.innerWidth, document.documentElement.clientWidth, window.visualViewport?.width ?? 0].filter((w) => w > 0).map((w) => Math.round(w)));
  const vh = window.innerHeight;
  // Options set by the caller before this file runs (shot.js): app mode (--app) and the text of
  // stylesheets the page cannot read itself (a file:// or cross-origin sheet). Without them,
  // nothing changes.
  interface CheckOptions {
    app?: unknown;
    sheets?: Array<{ href: string; text: string }>;
    /** Set by shot.js while it steps down the page: return only what is on screen now (a View), run no rule. */
    snapshot?: boolean;
    /** What a visitor saw at stepped scroll positions, gathered by shot.js with snapshot; used by blank-band. */
    views?: View[];
    /** Canvases over a picture that shot.js captured as one flat colour there: [canvas index, what]. */
    blankCanvases?: Array<[number, string]>;
  }
  /**
   * One screen as a visitor saw it, scrolled to y: `top` is where the screen's content starts
   * (below a fixed or sticky header bar), and each box is [left, top, right, bottom, font size]
   * in viewport coordinates, clipped to the screen. `grounds` holds the colour of the ground at the
   * screen's left edge for each 8px strip from the top ('' where a picture or gradient is), and
   * `scenes` the [top, bottom] on screen of each block a sticky element travels in.
   */
  interface View { y: number; top: number; boxes: number[][]; grounds?: string[]; scenes?: number[][] }
  const options: CheckOptions = (window as unknown as { __argusCheckOptions?: CheckOptions }).__argusCheckOptions ?? {};
  // App mode is opt-in, set by the caller before this file runs (shot.js --app).
  const appMode = !!options.app;
  const snapshotMode = !!options.snapshot;
  const APP_RELAXED =
    'missing-anchor (hash-only links are screen routes), ' +
    'fixed-cover (open dialogs and their scrim wherever it sits, decorative aria-hidden bars, a translucent or floating bottom tab bar), ' +
    'page-basics (meta description and icon), timid-headline, first-screen-no-action and first-screen-nothing-large (not a landing page), ' +
    'small-text (11px allowed anywhere, 10px inside nav and tab bars), pure-black-white (system grounds are pure white and black), ' +
    'small-text, contrast and target-size (not measured inside decorative aria-hidden parts such as a drawn status bar or home indicator), ' +
    'section-length (a scrolling list of repeated items), focus-removed (a focus style on the parent or grandparent counts), ' +
    'image-oversized (judged for a 2x phone screen), focus-obscured (each control is scrolled into view before it is measured), ' +
    'target-size (the hit area includes ::before and ::after layers that extend it)';

  const all = <T extends Element = HTMLElement>(selector: string, root: ParentNode = document): T[] =>
    Array.from(root.querySelectorAll<T>(selector));
  const textOf = (el: Element): string => ((el as HTMLElement).innerText ?? el.textContent ?? '').trim();
  /** Text held directly by the element, not by its children. */
  const ownText = (el: Element): string =>
    Array.from(el.childNodes)
      .filter((n) => n.nodeType === Node.TEXT_NODE)
      .map((n) => n.nodeValue ?? '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();

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

  /** Run one rule. An error inside it becomes a note and never stops the others. */
  function rule(id: string, fn: () => void): void {
    if (snapshotMode) return;
    try {
      fn();
    } catch (err) {
      notes.push('rule ' + id + ' could not run: ' + (err instanceof Error ? err.message : String(err)));
    }
  }

  function isVisible(el: Element): boolean {
    if (typeof el.checkVisibility === 'function' && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /**
   * App mode only: inside a purely decorative aria-hidden part, such as a drawn status bar or
   * home indicator (aria-hidden="true" and nothing in it can take focus). Always false otherwise.
   */
  const decorMemo = new Map<Element, boolean>();
  function isDecorative(el: Element): boolean {
    if (!appMode) return false;
    const hidden = el.closest('[aria-hidden="true"]');
    if (!hidden) return false;
    let v = decorMemo.get(hidden);
    if (v === undefined) {
      v = !hidden.querySelector('a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]') &&
        !hidden.matches('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])');
      decorMemo.set(hidden, v);
    }
    return v;
  }

  /**
   * The rule lists of every stylesheet. A sheet the page cannot read (an external file opened
   * from file://, or another origin) is read from the text the caller passed in, when it did.
   */
  let sheetsMemo: CSSRuleList[] | null = null;
  function ruleLists(): CSSRuleList[] {
    if (sheetsMemo) return sheetsMemo;
    const out: CSSRuleList[] = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        out.push(sheet.cssRules);
      } catch {
        // A stylesheet from another origin cannot be read here; use its text if the caller fetched it.
        const given = sheet.href ? options.sheets?.find((s) => s.href === sheet.href) : undefined;
        if (!given) continue;
        try {
          const copy = new CSSStyleSheet();
          copy.replaceSync(given.text);
          out.push(copy.cssRules);
        } catch {
          /* unreadable text: leave it out */
        }
      }
    }
    return (sheetsMemo = out);
  }

  const onFirstScreen = (r: DOMRect): boolean => r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw;

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

  /** Hue in degrees, saturation and lightness from 0 to 1. */
  function hsl(c: Rgba): [number, number, number] {
    const r = c[0] / 255;
    const g = c[1] / 255;
    const b = c[2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
    return [h, s, l];
  }

  const keyOf = (c: Rgba): string => c.slice(0, 3).map((n) => Math.round(n)).join(',');

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

  /** Every element in the body except the insides of SVG drawings, capped so a huge page stays quick. */
  let poolMemo: Element[] | null = null;
  const pool = (): Element[] => (poolMemo ??= all<Element>('body *').filter((el) => !(el instanceof SVGElement && el.ownerSVGElement)).slice(0, 4000));

  /**
   * Screens people work in are judged by different rules from pages that persuade.
   * Product UI: a table, many fields, an application, grid or tab list, a step
   * indicator or progress element, a form holding most of the page's controls
   * with four or more fields, or an app-like screen about one screen tall at phone width.
   */
  let productMemo: boolean | null = null;
  function isProductUI(): boolean {
    if (productMemo === null) {
      const FIELDS = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea';
      const CONTROLS = 'a[href], button, input:not([type="hidden"]), select, textarea, [role="button"]';
      const controls = all('input:not([type="hidden"]), select, textarea').filter(isVisible).length;
      const pageControls = all(CONTROLS).filter(isVisible).length;
      const formLed = all('form').some((f) => {
        if (!isVisible(f)) return false;
        const fields = all(FIELDS, f).filter(isVisible).length;
        return fields >= 4 && all(CONTROLS, f).filter(isVisible).length > pageControls / 2;
      });
      const docH = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
      const oneScreenPhone = vw <= 480 && docH <= vh * 1.1;
      productMemo =
        all('table').some(isVisible) ||
        controls > 12 ||
        !!document.querySelector('[role="application"], [role="grid"], [role="tablist"], [role="progressbar"], progress, [aria-current="step"]') ||
        formLed ||
        oneScreenPhone;
    }
    return productMemo;
  }

  /**
   * The first screen's ground, sampled on a 12 by 8 grid: at each point, the
   * first solid background from the top of the stack.
   */
  let samplesMemo: Sample[] | null = null;
  function groundSamples(): Sample[] {
    if (samplesMemo) return samplesMemo;
    const htmlBg = rgba(getComputedStyle(document.documentElement).backgroundColor);
    const bodyBg = rgba(getComputedStyle(document.body).backgroundColor);
    const canvasBg: Rgba = htmlBg[3] > 0 ? over(htmlBg, [255, 255, 255, 1]) : bodyBg[3] > 0 ? over(bodyBg, [255, 255, 255, 1]) : [255, 255, 255, 1];
    const out: Sample[] = [];
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 12; i++) {
        const x = ((i + 0.5) * vw) / 12;
        const y = ((j + 0.5) * vh) / 8;
        let colour: Rgba | null = null;
        let hit: Element | null = null;
        let media = false;
        for (const el of document.elementsFromPoint(x, y)) {
          const tag = el.tagName.toUpperCase();
          if (tag === 'IMG' || tag === 'VIDEO' || tag === 'CANVAS' || tag === 'PICTURE' || tag === 'IFRAME' || el instanceof SVGElement) {
            media = true;
            hit = el;
            break;
          }
          const cs = getComputedStyle(el);
          if (cs.backgroundImage && cs.backgroundImage !== 'none') {
            media = true;
            hit = el;
            break;
          }
          const c = rgba(cs.backgroundColor);
          if (c[3] >= 0.5) {
            colour = c[3] < 1 ? over(c, [255, 255, 255, 1]) : c;
            hit = el;
            break;
          }
        }
        if (!media && !colour) colour = canvasBg;
        out.push({ colour, el: hit });
      }
    }
    samplesMemo = out;
    return out;
  }

  /** The ground colour covering the most sample points, with its share of all points. */
  function dominantGround(): { colour: Rgba; share: number; el: Element | null } | null {
    const samples = groundSamples();
    const tally = new Map<string, { colour: Rgba; n: number; el: Element | null }>();
    for (const s of samples) {
      if (!s.colour) continue;
      const k = keyOf(s.colour);
      const entry = tally.get(k) ?? { colour: s.colour, n: 0, el: s.el };
      entry.n++;
      tally.set(k, entry);
    }
    let best: { colour: Rgba; n: number; el: Element | null } | null = null;
    for (const e of tally.values()) if (!best || e.n > best.n) best = e;
    return best && samples.length ? { colour: best.colour, share: best.n / samples.length, el: best.el } : null;
  }

  /** Words that name a form field: its label, accessible name and placeholder. */
  function labelText(el: Field): string {
    const parts: string[] = [];
    for (const l of Array.from(el.labels ?? [])) parts.push(textOf(l));
    parts.push(el.getAttribute('aria-label') ?? '');
    const by = el.getAttribute('aria-labelledby');
    if (by) for (const id of by.split(/\s+/)) parts.push(textOf(document.getElementById(id) ?? document.createElement('i')));
    parts.push(el.getAttribute('placeholder') ?? '');
    return parts.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
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

  const heads = all<HTMLHeadingElement>('h1,h2,h3,h4,h5,h6').filter(isVisible);
  const running = typeof document.getAnimations === 'function' ? document.getAnimations() : [];
  // Finite animations and transitions still running mean the page is mid-change. One tied to scroll
  // (animation-timeline) stands where the scroll puts it, and is not counted.
  const onClock = (a: Animation): boolean => !a.timeline || typeof DocumentTimeline !== 'function' || a.timeline instanceof DocumentTimeline;
  const settling = running.filter((a) => a.playState === 'running' && onClock(a) && a.effect?.getComputedTiming().endTime !== Infinity).length;
  if (settling) {
    notes.push(settling + ' animation(s) or transition(s) were still running when the check started, so contrast and layout findings may be measured mid-change. Run the check again once the page has settled.');
  }

  // ---- contrast, small text, gradient text ---------------------------------
  rule('contrast', () => {
    let unknownBg = 0;
    let blended = 0;
    for (const el of textEls) {
      if (isDecorative(el)) continue;
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      const clip = cs.webkitBackgroundClip || cs.backgroundClip;
      if (clip === 'text') {
        add('gradient-text', 'tell', el, 'Text is filled with a background (gradient text).');
        continue;
      }
      // In app mode, 11px is the platform's smallest text anywhere, and 10px tab and navigation bar labels are its standard.
      const appSize = appMode && (size >= 11 || (size >= 10 && !!el.closest('nav, [role="tablist"], [role="navigation"]')));
      if (size < 12 && !appSize) add('small-text', 'P2', el, 'Text is ' + size + 'px; below 12px is hard to read.');
      const fg = rgba(cs.color);
      if (fg[3] === 0) continue;
      // Under a blend mode (a headline that flips its ink over the picture) the colour on screen
      // is computed from what lies beneath, so the colour pair cannot be measured.
      let blend = false;
      for (let a: Element | null = el; a && a !== document.documentElement; a = a.parentElement) {
        if (getComputedStyle(a).mixBlendMode !== 'normal') {
          blend = true;
          break;
        }
      }
      if (blend) {
        blended++;
        continue;
      }
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
    if (blended) notes.push(blended + ' text element' + (blended === 1 ? ' uses' : 's use') + ' a blend mode (mix-blend-mode), so contrast cannot be measured; check by eye on the capture at every width.');
  });

  // ---- horizontal overflow --------------------------------------------------
  rule('page-overflow', () => {
    const docW = document.documentElement.scrollWidth;
    if (docW <= vw + 1) return;
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
  });

  // ---- page length on phones -------------------------------------------------
  rule('page-length', () => {
    if (vw > 430 || vh <= 0) return;
    // The limit (craft.md): a long page is fine when each screen carries one message. Flag past
    // fourteen screens at 390, and past sixteen at 320 measured with a 700px-tall screen.
    const narrow = vw <= 340;
    const screen = narrow ? 700 : vh;
    const screens = document.documentElement.scrollHeight / screen;
    const limit = narrow ? 16 : 14;
    if (screens > limit) {
      add('page-length', 'P2', null, 'Page is about ' + screens.toFixed(1) + ' screens tall at this width (' + document.documentElement.scrollHeight +
        'px, screens of ' + Math.round(screen) + 'px); the limit is ' + limit + '. Give each screen one message: cut words and merge or drop sections; keep each section\'s picture.');
    }
  });

  // One section that runs on for several phone screens is a dense section, whatever the page's length.
  rule('section-length', () => {
    if (vw > 430 || vw <= 340 || vh <= 0 || isProductUI()) return;
    if (all('article').some((a) => textOf(a).length > 1500)) return; // long reading is meant to be long
    let root: Element = document.querySelector('main') ?? document.body;
    // Step through wrappers that hold the whole page.
    for (let i = 0; i < 4; i++) {
      const kids = Array.from(root.children).filter(isVisible);
      const only = kids.length === 1 ? kids[0] : undefined;
      if (!only || only.tagName === 'SECTION') break;
      root = only;
    }
    const limit = 2.5 * vh;
    const sections = Array.from(root.children).filter((el) => isVisible(el) && !/^(HEADER|FOOTER|NAV|SCRIPT|STYLE|DIALOG)$/.test(el.tagName));
    /**
     * App mode: a scrolling list of like items (picture cards, rows) is one message however long:
     * the section, or a block up to two levels inside it, holds four or more visible children that
     * mostly share a tag and class, and they make up most of the section's height.
     */
    const isRepeatedList = (section: Element): boolean => {
      const h = section.getBoundingClientRect().height;
      const lists: Element[] = [section];
      for (const kid of Array.from(section.children)) {
        lists.push(kid);
        for (const grandkid of Array.from(kid.children)) lists.push(grandkid);
      }
      return lists.some((list) => {
        const items = Array.from(list.children).filter(isVisible);
        if (items.length < 4) return false;
        const sig = (n: Element): string => n.tagName + '.' + (typeof n.className === 'string' ? n.className.trim().split(/\s+/).sort().join('.') : '');
        const tally = new Map<string, Element[]>();
        for (const n of items) tally.set(sig(n), [...(tally.get(sig(n)) ?? []), n]);
        let like: Element[] = [];
        for (const group of tally.values()) if (group.length > like.length) like = group;
        if (like.length < 4 || like.length < items.length * 0.75) return false;
        const covered = like.reduce((sum, n) => sum + n.getBoundingClientRect().height, 0);
        return covered >= h * 0.6;
      });
    };
    for (const el of sections) {
      const h = el.getBoundingClientRect().height;
      if (h > limit && !(appMode && isRepeatedList(el))) {
        add('section-length', 'P2', el, 'This section is about ' + (h / vh).toFixed(1) + ' screens tall at this width (' + Math.round(h) +
          'px); more than about 2.5 means it carries several messages. Split it, or cut it to one message and one picture.');
      }
    }
  });

  // ---- clipped text ---------------------------------------------------------
  rule('clipped-text', () => {
    for (const el of textEls) {
      const cs = getComputedStyle(el);
      if (cs.overflowX === 'hidden' && el.scrollWidth > el.clientWidth + 1 && cs.textOverflow !== 'ellipsis') {
        add('clipped-text', 'P1', el, 'Text is cut off with no ellipsis (' + el.scrollWidth + 'px in ' + el.clientWidth + 'px).');
      }
    }
  });

  // Text cut off with an ellipsis needs its full text somewhere a person can reach it.
  rule('truncated-no-title', () => {
    for (const el of textEls) {
      const cs = getComputedStyle(el);
      const ellipsis = cs.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
      const clamp = /^\d+$/.test(cs.getPropertyValue('-webkit-line-clamp').trim()) && el.scrollHeight > el.clientHeight + 1;
      if (!ellipsis && !clamp) continue;
      let named = false;
      for (let n: Element | null = el, i = 0; n && i < 4; n = n.parentElement, i++) {
        if (n.getAttribute('title') || n.getAttribute('aria-label')) {
          named = true;
          break;
        }
      }
      if (!named) add('truncated-no-title', 'P3', el, 'Text is cut off with an ellipsis and its full text is not available (no title or aria-label).');
    }
  });

  // ---- collapsed columns ----------------------------------------------------
  // A block squeezed so narrow that its text breaks to a word or less per line
  // is a broken layout (typically a grid or flex item that lost its width). Judged from the
  // lines the text really breaks into: a run of four words or more set on three lines or more
  // at about a word a line. A short display label (two words at a large size, a figure) that
  // wraps once is not a collapse, nor is small text that still fits two or three words a line.
  const wordsPerLine = (block: Element): { words: number; lines: number } | null => {
    const range = document.createRange();
    let worst: { words: number; lines: number } | null = null;
    const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const words = (node.nodeValue ?? '').trim().split(/\s+/).filter((w) => /\w/.test(w)).length;
      if (words < 4) continue;
      range.selectNode(node);
      const tops: number[] = [];
      for (const r of Array.from(range.getClientRects())) {
        if (r.width < 1) continue;
        if (!tops.some((t) => Math.abs(t - r.top) < Math.max(3, r.height * 0.3))) tops.push(r.top);
      }
      const v = { words, lines: tops.length };
      if (v.lines >= 3 && (!worst || v.words / v.lines < worst.words / worst.lines)) worst = v;
    }
    return worst;
  };
  rule('collapsed-column', () => {
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
      if (!(w > 0 && w < parseFloat(cs.fontSize) * 5)) continue;
      const run = wordsPerLine(block);
      if (run && run.words / run.lines <= 1.5) {
        add('collapsed-column', 'P0', block, 'Text block is only ' + w + 'px wide, so its text breaks to about a word per line (' + run.words + ' words on ' + run.lines + ' lines). The layout has collapsed.');
      }
    }
  });

  // ---- forms that lead nowhere ----------------------------------------------
  rule('form-mailto', () => {
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
  });

  // ---- reading text -----------------------------------------------------------
  rule('line-length', () => {
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
  });

  rule('body-line-height', () => {
    for (const el of all('p, li, dd, blockquote')) {
      if (!isVisible(el) || textOf(el).length < 200) continue;
      const cs = getComputedStyle(el);
      const size = parseFloat(cs.fontSize);
      if (!size) continue;
      const normal = cs.lineHeight === 'normal';
      const r = normal ? 1.2 : parseFloat(cs.lineHeight) / size;
      if (!r || (r >= 1.3 && r <= 2)) continue;
      add('body-line-height', 'P3', el, (normal ? 'Line height is "normal" (about 1.2 in most fonts)' : 'Line height is ' + r.toFixed(2) + ' times the text size') +
        ' on a long paragraph; about 1.5 reads best (craft.md).');
    }
  });

  rule('justified-text', () => {
    const blocks = new Set<Element>();
    for (const el of textEls) {
      let block: HTMLElement | null = el;
      while (block && block !== document.body && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement;
      if (!block || block === document.body || blocks.has(block)) continue;
      blocks.add(block);
      const cs = getComputedStyle(block);
      if (cs.textAlign !== 'justify' || cs.direction === 'rtl' || textOf(block).length < 200) continue;
      add('justified-text', 'P3', block, 'Justified text: on screen it opens uneven gaps between words. Set it ragged unless justification was chosen and the text is hyphenated.');
    }
  });

  // ---- touch targets --------------------------------------------------------
  /**
   * App mode: the size a control can be tapped at, not only drawn at. A ::before or ::after layer
   * positioned out past the control's edges (a 36px pill with a 44px hit area) extends it. The layer's
   * box is read from its computed insets; where that falls short (a layer centred with a transform),
   * points 22px either side of the control's centre are probed to see whether the control still gets the tap.
   */
  function hitArea(el: Element, r: DOMRect, cs: CSSStyleDeclaration, w: number, h: number): [number, number] {
    let x0 = r.left, x1 = r.right, y0 = r.top, y1 = r.bottom;
    if (cs.position !== 'static' && cs.overflow === 'visible') {
      const bl = parseFloat(cs.borderLeftWidth) || 0, br = parseFloat(cs.borderRightWidth) || 0;
      const bt = parseFloat(cs.borderTopWidth) || 0, bb = parseFloat(cs.borderBottomWidth) || 0;
      for (const pseudo of ['::before', '::after']) {
        const ps = getComputedStyle(el, pseudo);
        if (ps.content === 'none' || ps.content === 'normal' || ps.display === 'none' || ps.pointerEvents === 'none') continue;
        if (ps.position !== 'absolute' || (ps.transform && ps.transform !== 'none')) continue;
        const [top, right, bottom, left] = [ps.top, ps.right, ps.bottom, ps.left].map((v) => (v.endsWith('px') ? parseFloat(v) : NaN));
        if ([top, right, bottom, left].some((v) => Number.isNaN(v))) continue;
        x0 = Math.min(x0, r.left + bl + (left as number));
        x1 = Math.max(x1, r.right - br - (right as number));
        y0 = Math.min(y0, r.top + bt + (top as number));
        y1 = Math.max(y1, r.bottom - bb - (bottom as number));
      }
    }
    w = Math.max(w, x1 - x0);
    h = Math.max(h, y1 - y0);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const hits = (x: number, y: number): boolean => {
      if (x < 0 || y < 0 || x >= window.innerWidth || y >= window.innerHeight) return false;
      const at = document.elementFromPoint(x, y);
      return !!at && (at === el || el.contains(at));
    };
    if (w < 44 && hits(cx - 21.5, cy) && hits(cx + 21.5, cy)) w = 44;
    if (h < 44 && hits(cx, cy - 21.5) && hits(cx, cy + 21.5)) h = 44;
    return [w, h];
  }

  rule('target-size', () => {
    const touch = vw <= 820 || matchMedia('(pointer: coarse)').matches;
    const interactive = all(
      'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="switch"]',
    );
    for (const el of interactive) {
      if (!isVisible(el) || isScreenReaderOnly(el) || isDecorative(el)) continue;
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
      if (appMode && (w < 44 || h < 44)) [w, h] = hitArea(el, r, cs, w, h);
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
  });

  // ---- names and labels -----------------------------------------------------
  rule('no-name', () => {
    const hasName = (el: Element): boolean => {
      if (textOf(el)) return true;
      if (el.getAttribute('aria-label') || el.getAttribute('title')) return true;
      const by = el.getAttribute('aria-labelledby');
      const firstId = by ? by.split(/\s+/)[0] : undefined;
      if (firstId && document.getElementById(firstId)) return true;
      return !!el.querySelector('img[alt]:not([alt=""]), svg[aria-label], svg title');
    };
    for (const el of all('button, a[href], [role="button"]')) {
      if (isVisible(el) && !hasName(el)) add('no-name', 'P1', el, 'Control has no accessible name (no text, aria-label or labelled image).');
    }
  });

  rule('link-text-generic', () => {
    const generic = new Set(['click here', 'here', 'read more', 'learn more', 'more', 'link']);
    for (const el of all('a[href], button, [role="button"], [role="link"]')) {
      if (!isVisible(el) || el.hasAttribute('aria-labelledby')) continue;
      const name = (el.getAttribute('aria-label') || textOf(el)).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
      if (generic.has(name)) add('link-text-generic', 'P3', el, 'Link or button text is only "' + name + '"; name where it goes or what it does.');
    }
  });

  // A link in running text needs more than colour to stand out from the words around it.
  rule('link-colour-only', () => {
    for (const a of all('p a[href], li a[href], dd a[href], td a[href], blockquote a[href], figcaption a[href]')) {
      if (!isVisible(a) || a.closest('nav, header, footer')) continue;
      const cs = getComputedStyle(a);
      if (cs.display !== 'inline') continue;
      const parent = a.parentElement;
      if (!parent || textOf(parent).length <= textOf(a).length + 20) continue;
      if (cs.textDecorationLine.includes('underline')) continue;
      const kid = a.firstElementChild;
      if (kid && getComputedStyle(kid).textDecorationLine.includes('underline')) continue;
      if ((parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none') || cs.backgroundImage !== 'none' || cs.boxShadow !== 'none') continue;
      const ps = getComputedStyle(parent);
      if (Math.abs((parseInt(cs.fontWeight, 10) || 400) - (parseInt(ps.fontWeight, 10) || 400)) >= 300 || cs.fontStyle !== ps.fontStyle) continue;
      const bg = backgroundOf(a);
      if (!bg) continue;
      const fg = rgba(cs.color);
      const pf = rgba(ps.color);
      if (fg[3] === 0 || pf[3] === 0) continue;
      const r = ratio(over(fg, bg), over(pf, bg));
      if (r < 3) {
        add('link-colour-only', 'P3', a, 'Link in running text is told apart only by colour, at ' + r.toFixed(2) + ':1 against the text around it; underline it or reach 3:1.');
      }
    }
  });

  rule('img-alt', () => {
    for (const el of all<HTMLImageElement>('img')) {
      if (!el.hasAttribute('alt')) {
        add('img-alt', 'P1', el, 'Image has no alt attribute (use alt="" if decorative).');
        continue;
      }
      const alt = (el.getAttribute('alt') ?? '').trim();
      if (!alt || !isVisible(el)) continue;
      if (/^[\w.-]+\.(png|jpe?g|gif|webp|avif|svg)$/i.test(alt) || /^(image|photo|picture|img|graphic)$/i.test(alt)) {
        add('img-alt', 'P3', el, 'Alt text "' + alt + '" is a file name or a generic word; describe what the image shows, or use alt="" if it is decorative.');
      }
    }
  });

  rule('image-no-size', () => {
    for (const el of all<HTMLImageElement>('img')) {
      if (el.hasAttribute('width') && el.hasAttribute('height')) continue;
      if (!isVisible(el) || !el.naturalWidth || !el.naturalHeight) continue;
      const cs = getComputedStyle(el);
      if (cs.aspectRatio && cs.aspectRatio !== 'auto') continue;
      if (cs.position === 'absolute' || cs.position === 'fixed' || cs.objectFit !== 'fill') continue;
      const parent = el.parentElement;
      if (parent && getComputedStyle(parent).aspectRatio !== 'auto') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 48 || r.height < 48) continue;
      // A height that does not follow the picture's own shape was set by CSS, so the space is reserved.
      if (Math.abs((r.width * el.naturalHeight) / el.naturalWidth - r.height) > 2) continue;
      add('image-no-size', 'P3', el, 'Image has no width and height attributes and no CSS aspect-ratio, so the page jumps when it loads.');
    }
  });

  rule('image-oversized', () => {
    // An app prototype is seen on phones, all of them 2x or denser, even when captured at 1x.
    const dpr = appMode ? Math.max(2, window.devicePixelRatio || 1) : window.devicePixelRatio || 1;
    for (const el of all<HTMLImageElement>('img')) {
      if (!isVisible(el) || !el.naturalWidth) continue;
      const src = el.currentSrc || el.src;
      if (/\.svg(\?|#|$)|^data:image\/svg/i.test(src)) continue;
      const w = el.getBoundingClientRect().width;
      if (w <= 100 || el.naturalWidth <= 2.5 * w * dpr) continue;
      add('image-oversized', 'P3', el, 'Image file is ' + el.naturalWidth + 'px wide but shown at ' + Math.round(w) + 'px (' + dpr +
        'x screen); serve a smaller size, for example with srcset.');
    }
  });

  rule('chart-unnamed', () => {
    const hinted = (start: Element): boolean => {
      for (let n: Element | null = start, i = 0; n && i < 4; n = n.parentElement, i++) {
        if (/chart|graph|plot|sparkline/i.test(n.id + ' ' + (n.getAttribute('class') ?? ''))) return true;
      }
      return false;
    };
    for (const el of all<Element>('svg, canvas')) {
      if (el.parentElement?.closest('svg') || !isVisible(el) || el.getAttribute('aria-hidden') === 'true') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 200 || r.height < 120) continue;
      let chartish: boolean;
      if (el.tagName.toUpperCase() === 'CANVAS') chartish = hinted(el);
      else {
        const shapes = el.querySelectorAll('rect, path, circle, line, polyline').length;
        const labels = el.querySelectorAll('text').length;
        chartish = (labels >= 3 && shapes >= 6) || (hinted(el) && shapes >= 3);
      }
      if (!chartish) continue;
      const figure = el.closest('figure');
      const named =
        !!el.getAttribute('aria-label') ||
        !!el.getAttribute('aria-labelledby') ||
        !!el.querySelector(':scope > title')?.textContent?.trim() ||
        !!(figure && figure.querySelector('figcaption')) ||
        !!el.parentElement?.closest('[role="img"][aria-label], [role="img"][aria-labelledby], [role="figure"][aria-label], [role="figure"][aria-labelledby]');
      if (!named) add('chart-unnamed', 'P3', el, 'Chart has no accessible name; add an aria-label, a title, or a figure caption that says what it shows.');
    }
  });

  // Something that looks pressable but is not a control cannot be reached by keyboard or announced.
  rule('clickable-not-control', () => {
    const controls = 'a[href], button, input, select, textarea, label, summary, [contenteditable="true"], [tabindex]:not([tabindex="-1"]), ' +
      '[role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="switch"], [role="radio"], [role="treeitem"], [role="gridcell"], [role="row"]';
    const tags = new Set(['DIV', 'SPAN', 'LI', 'IMG', 'SVG']);
    for (const el of pool()) {
      if (!tags.has(el.tagName.toUpperCase())) continue;
      const onclick = el.hasAttribute('onclick');
      const cs = getComputedStyle(el);
      if (!onclick && cs.cursor !== 'pointer') continue;
      // An inherited pointer cursor belongs to the ancestor that set it.
      if (!onclick && el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer') continue;
      if (el.hasAttribute('role') || el.hasAttribute('tabindex')) continue;
      if (el.parentElement?.closest(controls) || el.querySelector(controls)) continue;
      if (!isVisible(el)) continue;
      add('clickable-not-control', 'P2', el, 'Looks clickable (pointer cursor or onclick) but is not a button or link, so keyboard and screen-reader users cannot use it.');
    }
  });

  rule('no-label', () => {
    for (const el of all<Field>('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')) {
      if (!isVisible(el)) continue;
      const visibleLabel = (el.labels?.length ?? 0) > 0 || !!el.getAttribute('aria-labelledby');
      const labelled = visibleLabel || !!el.getAttribute('aria-label') || !!el.getAttribute('title');
      if (!labelled) add('no-label', 'P1', el, 'Form field has no label (a placeholder is not a label).');
      else if (!visibleLabel && !['range', 'checkbox', 'radio', 'search'].includes(el.type)) {
        add('hidden-label', 'P2', el, 'Form field is named only for screen readers; sighted users lose the label once they type. Add a visible label.');
      }
    }
  });

  // An iPhone zooms the whole page when a field with text under 16px is focused.
  rule('input-zoom', () => {
    if (vw > 430) return;
    for (const el of all<Field>('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), select, textarea')) {
      if (!isVisible(el)) continue;
      const size = parseFloat(getComputedStyle(el).fontSize);
      if (size < 16) add('input-zoom', 'P2', el, 'Field text is ' + size + 'px; under 16px an iPhone zooms the page when the field is focused.');
    }
  });

  // ---- forms: filling in ---------------------------------------------------------
  const textFields = (): HTMLInputElement[] =>
    all<HTMLInputElement>('input').filter((el) => {
      if (el.disabled || el.readOnly || !isVisible(el)) return false;
      return !['hidden', 'submit', 'button', 'reset', 'checkbox', 'radio', 'file', 'range', 'color', 'image', 'search',
        'date', 'time', 'datetime-local', 'month', 'week'].includes(el.type);
    });

  rule('autocomplete-missing', () => {
    for (const el of textFields()) {
      if (el.hasAttribute('autocomplete') || el.form?.getAttribute('autocomplete') === 'off') continue;
      const name = el.name.toLowerCase();
      const id = el.id.toLowerCase();
      const ids = name + ' ' + id;
      const label = labelText(el);
      let kind = '';
      if (el.type === 'email' || /e-?mail/.test(ids) || /\be-?mail\b/.test(label)) kind = 'email';
      else if (el.type === 'password' || /password/.test(ids)) kind = 'password';
      else if (el.type === 'tel' || /phone|mobile|\btel\b/.test(ids) || /\b(phone|mobile|telephone)\b/.test(label)) kind = 'phone';
      else if (/card.?num|cc.?num/.test(ids) || /\bcard number\b/.test(label)) kind = 'card number';
      else if (/post.?code|postal|\bzip\b/.test(ids + ' ' + label)) kind = 'postcode';
      else if ([name, id].some((s) => /street|address.?line|^address\d?$/.test(s)) || /^(street|address\b|address line|home address|postal address|billing address|shipping address|delivery address)/.test(label)) kind = 'street address';
      else if ([name, id].some((s) => /^(full.?name|first.?name|last.?name|fname|lname|given.?name|family.?name|surname|name)$/.test(s)) ||
        /^(full name|your name|name|first name|last name|surname|given name|family name)\b/.test(label)) kind = 'name';
      if (kind) add('autocomplete-missing', 'P3', el, 'A ' + kind + ' field has no autocomplete attribute; add one so browsers and password managers can fill it.');
    }
  });

  rule('input-type', () => {
    for (const el of textFields()) {
      if (el.type !== 'text' || el.hasAttribute('inputmode')) continue;
      const ids = (el.name + ' ' + el.id).toLowerCase();
      const label = labelText(el);
      if (/user ?name|\bor\b/.test(label)) continue;
      let kind = '';
      let type = '';
      if (/e-?mail/.test(ids) || /\be-?mail\b/.test(label)) [kind, type] = ['an email address', 'email'];
      else if (/phone|mobile|\btel\b/.test(ids) || /\b(phone|mobile|telephone)\b/.test(label)) [kind, type] = ['a phone number', 'tel'];
      else if (/\burl\b|website/.test(ids) || /\b(url|website|web site|homepage)\b/.test(label)) [kind, type] = ['a web address', 'url'];
      if (kind) add('input-type', 'P3', el, 'A field for ' + kind + ' uses type="text"; type="' + type + '" brings the right phone keyboard.');
    }
  });

  rule('error-not-linked', () => {
    const fieldSel = 'input:not([type="hidden"]), select, textarea';
    const reported = new Set<Element>();
    for (const el of all('[aria-invalid="true"]')) {
      if (!el.matches(fieldSel) || !isVisible(el)) continue;
      if (el.hasAttribute('aria-describedby') || el.hasAttribute('aria-errormessage')) continue;
      reported.add(el);
      add('error-not-linked', 'P2', el, 'Field is marked invalid but no error message is linked to it (aria-describedby or aria-errormessage).');
    }
    for (const err of all('[role="alert"], [class*="error" i]')) {
      if (err.matches(fieldSel) || err.querySelector(fieldSel) || !isVisible(err)) continue;
      const text = textOf(err);
      if (!text || text.length > 200) continue;
      const prev = err.previousElementSibling;
      let field: Element | null = null;
      if (prev?.matches(fieldSel)) field = prev;
      else if (prev) {
        const inner = prev.querySelectorAll(fieldSel);
        if (inner.length === 1) field = inner[0] ?? null;
      }
      if (!field || reported.has(field) || !isVisible(field)) continue;
      if (field.hasAttribute('aria-describedby') || field.hasAttribute('aria-errormessage')) continue;
      reported.add(field);
      add('error-not-linked', 'P2', err, 'Error message follows a field but is not linked to it (aria-describedby), so screen readers do not read it with the field.');
    }
  });

  rule('required-unmarked', () => {
    const marked = (el: Element): boolean => {
      const content = ['::before', '::after'].map((p) => getComputedStyle(el, p).content).join(' ');
      return /\*|required/i.test(textOf(el) + ' ' + content);
    };
    for (const form of all<HTMLFormElement>('form')) {
      const fields = all<Field>('input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]), select, textarea', form)
        .filter(isVisible);
      if (fields.length < 2) continue;
      const formText = textOf(form);
      if (/optional|all fields are required/i.test(formText)) continue; // optional fields are marked instead
      for (const el of fields) {
        if (!el.required && el.getAttribute('aria-required') !== 'true') continue;
        const label = el.labels?.[0];
        if (!label) continue; // no-label covers it
        const last = label.lastElementChild;
        if (marked(label) || (last && marked(last))) continue;
        add('required-unmarked', 'P3', el, 'Required field with no visible marker in its label; mark required fields, or mark the optional ones instead.');
      }
    }
  });

  rule('dead-link', () => {
    for (const el of all('a[href="#"], a[href=""]')) {
      if (isVisible(el)) add('dead-link', 'P2', el, 'Link goes nowhere (href="#").');
    }
  });

  // A same-page link whose target does not exist goes nowhere, like href="#": a header link
  // to "#menu" with no section of that id. Skipped where false alarms are likely: "#top"
  // (the browser scrolls to the top by standard), script routes ("#/..." and "#!..."),
  // text fragments, and links that act as tabs or toggles (a role or aria-controls).
  rule('missing-anchor', () => {
    for (const el of all<HTMLAnchorElement>('a[href^="#"]')) {
      const href = el.getAttribute('href') ?? '';
      const frag = href.slice(1);
      if (!frag || /^top$/i.test(frag) || /^[/!]/.test(frag) || frag.startsWith(':~:')) continue;
      // In an app prototype a hash-only link switches screens (index.html#order), so it has no target id.
      if (appMode) continue;
      if (el.hasAttribute('role') || el.hasAttribute('aria-controls') || !isVisible(el)) continue;
      let id = frag;
      try {
        id = decodeURIComponent(frag);
      } catch {
        /* keep it as written */
      }
      if (document.getElementById(id) || document.getElementsByName(id).length > 0) continue;
      add('missing-anchor', 'P2', el, 'Link to "' + href + '" but nothing on the page has that id, so it goes nowhere; point it at a real section or remove it.');
    }
  });

  // ---- headings -------------------------------------------------------------
  rule('h1-count', () => {
    const h1s = heads.filter((h) => h.tagName === 'H1').length;
    if (h1s !== 1) add('h1-count', 'P2', null, 'Page has ' + h1s + ' h1 elements; it should have one.');
    let prev = 0;
    for (const h of heads) {
      const lvl = parseInt(h.tagName.slice(1), 10);
      if (prev && lvl > prev + 1) add('heading-skip', 'P2', h, 'Heading jumps from h' + prev + ' to h' + lvl + '.');
      prev = lvl;
    }
  });

  // ---- motion ---------------------------------------------------------------
  rule('reduced-motion', () => {
    let hasMotion = false;
    let hasReduced = false;
    const scan = (list: CSSRuleList): void => {
      for (const r of Array.from(list)) {
        if (r instanceof CSSMediaRule && /prefers-reduced-motion/.test(r.conditionText)) hasReduced = true;
        if (r instanceof CSSKeyframesRule) hasMotion = true;
        // Transitions are feedback on interaction; only self-running animation needs a reduced-motion rule.
        if (r instanceof CSSStyleRule && r.style.animationName && r.style.animationName !== 'none') hasMotion = true;
        if (r instanceof CSSGroupingRule) scan(r.cssRules);
      }
    };
    for (const list of ruleLists()) scan(list);
    if (running.length) hasMotion = true;
    if (hasMotion && !hasReduced) add('reduced-motion', 'P1', null, 'The page animates but has no prefers-reduced-motion rule.');
  });

  // A page where nothing moves outside prefers-reduced-motion: no animation, no scroll-driven effect,
  // no transition beyond a colour change. Exempt when the owner chose still (data-argus-motion="still").
  rule('motionless-page', () => {
    if (appMode) return;
    if ([document.documentElement, document.body].some((n) => n?.getAttribute('data-argus-motion') === 'still')) return;
    const COLOUR = /^(color|background-color|background|border-color|border-(top|right|bottom|left)-color|outline-color|outline|text-decoration-color|text-decoration|fill|stroke|caret-color|accent-color|box-shadow|text-shadow|none)$/;
    const MOVING = /\b(transform|translate|scale|rotate|opacity|clip-path|filter|inset|top|left|height|width|max-height|grid-template-rows|background-position|letter-spacing)\s*:/;
    const STATE = /:hover|:focus|:active|:checked|:target|\.is-|\.in-view|\.visible|\.shown|\.revealed|\.open|\[data-|\[aria-/;
    let moves = running.length > 0 || !!document.querySelector('video[autoplay], animate, animateTransform, animateMotion');
    const w = window as unknown as Record<string, unknown>;
    if (['gsap', 'anime', 'Motion', 'lottie', 'Lenis', 'ScrollTrigger'].some((k) => w[k])) moves = true;
    let anyAll = false;
    let stateMoves = false;
    const scan = (list: CSSRuleList): void => {
      for (const r of Array.from(list)) {
        if (moves) return;
        if (r instanceof CSSMediaRule && /prefers-reduced-motion\s*:\s*reduce/.test(r.conditionText)) continue;
        if (r instanceof CSSKeyframesRule) moves = true;
        else if (r instanceof CSSStyleRule) {
          const st = r.style;
          if (st.animationName && st.animationName !== 'none') moves = true;
          if (['animation-timeline', 'view-timeline-name', 'scroll-timeline-name'].some((p) => (st.getPropertyValue(p) || '').trim() && st.getPropertyValue(p).trim() !== 'auto')) moves = true;
          for (const p of (st.transitionProperty || '').split(',').map((x) => x.trim()).filter(Boolean)) {
            if (p === 'all') anyAll = true;
            else if (!COLOUR.test(p)) moves = true;
          }
          if (STATE.test(r.selectorText) && MOVING.test(st.cssText)) stateMoves = true;
        }
        if (r instanceof CSSGroupingRule) scan(r.cssRules);
      }
    };
    for (const list of ruleLists()) scan(list);
    if (!moves && anyAll && stateMoves) moves = true;
    if (!moves) add('motionless-page', 'P2', null, 'Nothing on the page moves outside prefers-reduced-motion: no arrival, no reveals, no transition beyond a colour change. ' +
      'Every page gets the baseline unless the owner chose still (motion.md, "How much"): an arrival for the first screen, reveals as sections enter, hover, focus and press states that show something, and one choreographed moment. ' +
      'If the owner asked for no motion, set data-argus-motion="still" on <html>.');
  });

  // Movement that never stops needs a way to pause it.
  rule('no-pause', () => {
    let endless = 0;
    for (const anim of running) {
      const effect = anim.effect;
      if (!(effect instanceof KeyframeEffect)) continue;
      const target = effect.target;
      if (effect.getTiming().iterations === Infinity && target && isVisible(target) && target.getBoundingClientRect().width > 40) endless++;
    }
    if (!endless) return;
    const pauseControl = all('button, [role="button"]').some((b) =>
      /\b(pause|stop|play)\b/i.test(textOf(b) + ' ' + (b.getAttribute('aria-label') ?? '') + ' ' + (b.getAttribute('title') ?? '')),
    );
    if (!pauseControl) add('no-pause', 'P1', null, endless + ' animation(s) loop forever and no pause or stop control was found.');
  });

  // ---- video openings (pictures.md) ------------------------------------------------------------
  // A large video that plays by itself: muted (phones refuse to autoplay sound, and sound is never
  // wanted), playsinline (else iPhones open it full screen), a poster (the first paint until it can
  // play) and a visible pause control (WCAG 2.2.2, for motion over five seconds). shot.js pauses
  // videos before capturing and marks the ones that were playing with data-argus-playing.
  const pauseControlOnPage = (): boolean => all('button, [role="button"]').some((b) =>
    /\b(pause|stop|play)\b/i.test(textOf(b) + ' ' + (b.getAttribute('aria-label') ?? '') + ' ' + (b.getAttribute('title') ?? '')));
  rule('hero-video', () => {
    let shown = 0;
    for (const v of all<HTMLVideoElement>('video')) {
      if (!isVisible(v)) continue;
      const r = v.getBoundingClientRect();
      if (!(r.width >= vw * 0.5 || r.width * r.height >= vw * vh * 0.25)) continue;
      const plays = v.autoplay || v.hasAttribute('autoplay') || v.dataset['argusPlaying'] === '1' || (!v.paused && !v.ended);
      if (!plays || shown >= 3) continue;
      shown++;
      const missing: string[] = [];
      if (!v.muted && !v.hasAttribute('muted')) add('hero-video', 'P1', v, 'This video plays by itself with sound on: add muted (phones will not autoplay it otherwise, and a page opening never needs sound).');
      if (!v.hasAttribute('playsinline')) missing.push('playsinline (without it an iPhone may open the video full screen)');
      if (!v.getAttribute('poster')) missing.push('poster (the first paint, and what shows under reduced motion or before it can play)');
      if (missing.length) add('hero-video', 'P2', v, 'A video that plays by itself has no ' + missing.join(' and no ') + ' (pictures.md).');
      const long = v.loop || v.hasAttribute('loop') || !isFinite(v.duration) || v.duration > 5;
      if (long && !v.controls && !pauseControlOnPage()) add('hero-video', 'P1', v, 'A video moves by itself for more than five seconds with no pause control: add a visible pause button (WCAG 2.2.2; pictures.md).');
    }
  });

  // A video file past about 4 MB is slow on a phone; measured where the browser reports the bytes it fetched.
  rule('video-heavy', () => {
    const LIMIT = 4 * 1024 * 1024;
    const sizes = new Map<string, number>();
    for (const e of performance.getEntriesByType('resource') as PerformanceResourceTiming[]) {
      const n = Math.max(e.encodedBodySize || 0, e.transferSize || 0, e.decodedBodySize || 0);
      if (n) sizes.set(e.name, Math.max(sizes.get(e.name) ?? 0, n));
    }
    for (const v of all<HTMLVideoElement>('video')) {
      const src = v.currentSrc || v.src;
      const n = src ? sizes.get(src) ?? 0 : 0;
      if (n > LIMIT) add('video-heavy', 'P3', v, 'The video file is ' + (n / 1048576).toFixed(1) + ' MB; aim for about 2-4 MB at 1080p and a smaller file for phones (photos.js loop; pictures.md).');
    }
  });

  rule('slow-transition', () => {
    const longest = (s: string): number =>
      Math.max(0, ...s.split(',').map((p) => (/ms\s*$/.test(p) ? parseFloat(p) : parseFloat(p) * 1000)).filter((n) => !isNaN(n)));
    let allCount = 0;
    let allExample: Element | null = null;
    for (const el of all('button, a[href], input:not([type="hidden"]), select, textarea, [role="button"]')) {
      if (!isVisible(el)) continue;
      const cs = getComputedStyle(el);
      const d = longest(cs.transitionDuration);
      if (d > 600) add('slow-transition', 'P3', el, 'A ' + Math.round(d) + 'ms transition on a control; feedback should land within about 100-300ms (craft.md).');
      if (d > 0 && cs.transitionProperty.split(',').some((p) => p.trim() === 'all')) {
        allCount++;
        allExample ??= el;
      }
    }
    if (allCount > 3) add('slow-transition', 'P3', allExample, allCount + ' controls transition "all" properties, which animates layout too; name the properties.');
  });

  // ---- page basics ------------------------------------------------------------
  if (vw > 330) notes.push('Sideways overflow is only measured at the current width (' + vw + 'px). Run again at 320.');
  rule('viewport-meta', () => {
    if (!document.querySelector('meta[name="viewport"]')) add('viewport-meta', 'P0', null, 'No viewport meta tag; the page will not fit phone screens.');
  });
  rule('zoom-blocked', () => {
    const content = (document.querySelector('meta[name="viewport"]')?.getAttribute('content') ?? '').toLowerCase();
    if (!content) return;
    const max = /maximum-scale\s*=\s*([0-9.]+)/.exec(content);
    const maxScale = max ? parseFloat(max[1] ?? '') : NaN;
    if (/user-scalable\s*=\s*(no|0)\b/.test(content)) add('zoom-blocked', 'P1', null, 'The viewport tag sets user-scalable=no, so people cannot zoom.');
    else if (!isNaN(maxScale) && maxScale < 2) add('zoom-blocked', 'P1', null, 'The viewport tag sets maximum-scale=' + maxScale + '; people must be able to zoom to at least 200%.');
  });
  rule('lang', () => {
    if (!document.documentElement.getAttribute('lang')) add('lang', 'P2', null, 'The html element has no lang attribute.');
  });
  rule('page-basics', () => {
    if (!document.title.trim()) add('page-basics', 'P2', null, 'The page has no title, so its tab and bookmarks are unnamed.');
    if (!document.querySelector('main, [role="main"]')) add('page-basics', 'P2', null, 'The page has no main landmark, so screen-reader users cannot jump to the content.');
    // An app prototype is not found by search or shown in a browser tab, so these two are web-page concerns only.
    if (appMode) return;
    if (!document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim()) add('page-basics', 'P3', null, 'The page has no meta description.');
    if (!document.querySelector('link[rel~="icon"]')) add('page-basics', 'P3', null, 'The page links no icon, so its tab shows a blank or default one.');
    if (!document.querySelector('meta[property="og:image"], meta[name="og:image"], meta[name="twitter:image"]')?.getAttribute('content')?.trim()) add('page-basics', 'P3', null, 'The page has no og:image, so a shared link shows no picture (finish.md, 2).');
  });

  // ---- content ------------------------------------------------------------------
  // Emoji_Presentation excludes text symbols such as the copyright sign.
  rule('emoji-icon', () => {
    const emoji = /\p{Emoji_Presentation}/u;
    for (const el of all('h1,h2,h3,h4,button,a,li,th,label')) {
      if (isVisible(el) && emoji.test(ownText(el))) add('emoji-icon', 'tell', el, 'Emoji used in a heading, control or list item.');
    }
  });
  rule('eyebrow', () => {
    // One of a set of real markings (sizes along a tape, lane or bay numbers) is information, not an eyebrow:
    // the label sits among three or more siblings of its own kind, or is a short code with a digit in it.
    const inMarkingSet = (el: Element): boolean => {
      const parent = el.parentElement;
      if (!parent) return false;
      const kind = (n: Element): string => n.tagName + '.' + Array.from(n.classList).sort().join('.');
      const k = kind(el);
      const sameKind = Array.from(parent.children).filter((c) => kind(c) === k).length;
      return sameKind >= 3;
    };
    for (const h of heads) {
      const before = h.previousElementSibling;
      if (!before || !isVisible(before)) continue;
      const cs = getComputedStyle(before);
      const t = textOf(before);
      if (t && t.length < 40 && parseFloat(cs.fontSize) <= 14 && (cs.textTransform === 'uppercase' || (t === t.toUpperCase() && /[A-Z]/.test(t)))) {
        if (inMarkingSet(before) || (t.length <= 5 && /\d/.test(t))) continue;
        add('eyebrow', 'tell', before, 'Small all-caps label above a heading.');
      }
    }
  });
  // The same habit judged for the whole page: a small label (all caps, letter-spaced or monospace)
  // directly above most section headings. Reported once, at P3.
  rule('eyebrow', () => {
    if (appMode) return;
    const sectionHeads = heads.filter((h) => h.tagName === 'H2');
    if (sectionHeads.length < 3) return;
    const labelled: Element[] = [];
    for (const h of sectionHeads) {
      const before = h.previousElementSibling;
      if (!before || !isVisible(before) || before.matches('h1,h2,h3,h4,h5,h6,img,picture,svg,figure,video,ul,ol,table')) continue;
      const t = textOf(before);
      if (!t || t.length > 48 || /\n/.test(t)) continue;
      const cs = getComputedStyle(before);
      const size = parseFloat(cs.fontSize);
      const caps = cs.textTransform === 'uppercase' || (t === t.toUpperCase() && /[A-Z]/.test(t));
      const spaced = parseFloat(cs.letterSpacing) / size >= 0.06;
      const mono = /mono|courier|consolas|menlo|monaco|\bcode\b/i.test(cs.fontFamily.split(',')[0] ?? '');
      if (size <= 15 && (caps || spaced || mono)) labelled.push(before);
    }
    if (labelled.length >= 3 && labelled.length / sectionHeads.length >= 0.5) {
      add('eyebrow', 'P3', labelled[0]!, labelled.length + ' of ' + sectionHeads.length + ' section headings have a small label directly above them (all caps, letter-spaced or monospace). ' +
        'Drop them unless a label carries information the heading does not (a date, a code, a step the reader needs): a label over every heading is part of the familiar default set (faults.md).');
    }
  });
  // Equal cards numbered 01, 02, 03... in a row or grid: numbers that only count the cards.
  rule('numbered-grid', () => {
    if (appMode) return;
    const lead = (card: Element): number | null => {
      const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const v = (n.nodeValue ?? '').trim();
        if (!v || (n.parentElement && !isVisible(n.parentElement))) continue;
        const m = /^(?:no\.?\s*)?0?(\d{1,2})(?:[.)])?(?:\s*[—–/|:·-].*)?$/i.exec(v);
        return m ? Number(m[1]) : null;
      }
      return null;
    };
    let reported = 0;
    for (const parent of all('ol, ul, div, section, article, main')) {
      const kids = Array.from(parent.children).filter(isVisible);
      if (kids.length < 3 || kids.length > 12) continue;
      const nums = kids.map(lead);
      if (nums.some((x) => x === null) || nums[0]! > 1 || !nums.every((x, i) => x === nums[0]! + i)) continue;
      const rects = kids.map((k) => k.getBoundingClientRect());
      const widths = rects.map((r) => r.width);
      if (Math.min(...widths) < 120 || Math.max(...widths) / Math.min(...widths) > 1.15 || rects.some((r) => r.height < 60)) continue;
      if (!rects.some((r, i) => i > 0 && Math.abs(r.top - rects[0]!.top) < 4)) continue;
      add('numbered-grid', 'P3', parent, kids.length + ' equal cards numbered ' + nums.map((x) => String(x).padStart(2, '0')).slice(0, 4).join(', ') + (kids.length > 4 ? '...' : '') +
        ' sit side by side. Numbers that only count the cards say nothing: drop them, or, if the order matters, show it as a sequence the visitor follows. The numbered grid is part of the familiar default set (faults.md).');
      if (++reported >= 2) break;
    }
  });
  rule('filler-words', () => {
    const bodyText = document.body.innerText ?? '';
    const slop = ['elevate', 'seamless', 'seamlessly', 'unlock', 'supercharge', 'effortless', 'effortlessly', 'reimagine', 'revolutionize',
      'game-changing', 'cutting-edge', 'next-level', 'world-class', 'unleash', 'empower'];
    const found = slop.filter((w) => new RegExp('\\b' + w + '\\b', 'i').test(bodyText));
    if (found.length) add('filler-words', 'tell', null, 'Marketing filler found: ' + found.join(', ') + '.');
    if (/lorem ipsum/i.test(bodyText)) add('placeholder-text', 'P1', null, 'Lorem ipsum placeholder text is visible.');
    if (/\b(John|Jane) Doe\b|\bAcme\b/.test(bodyText)) add('stock-names', 'tell', null, 'Stock placeholder names (John Doe, Acme) are visible.');
    // Scroll reveals are part of the motion layer (craft.md). The tell is the same reveal on everything with no stagger.
    // Judged per element from what the browser computes: the delays, the animated properties, durations and easing,
    // and the hidden state (transform, clip, opacity). A stagger written as a custom property (style="--i: 2" used in
    // transition-delay) may only take effect once the element is revealed, so differing per-element custom
    // properties count as a stagger too.
    const reveals = all('[data-aos], [class*="fade-up"], [class*="fadeUp"], [class*="reveal"]');
    if (reveals.length > 6) {
      const STAGGER_VARS = ['--i', '--index', '--n', '--order', '--delay', '--stagger', '--d'];
      const kinds = new Set<string>();
      const delays = new Set<string>();
      const stagger = new Set<string>();
      for (const el of reveals) {
        const cs = getComputedStyle(el);
        kinds.add([cs.transitionProperty, cs.transitionDuration, cs.transitionTimingFunction, cs.animationName, cs.animationDuration,
          cs.animationTimingFunction, cs.transform, cs.clipPath, cs.opacity, el.getAttribute('data-aos') ?? ''].join('|'));
        delays.add(cs.transitionDelay + '|' + cs.animationDelay + '|' + (el.getAttribute('data-aos-delay') ?? ''));
        const own: string[] = [];
        const inline = (el as HTMLElement).style;
        for (let i = 0; inline && i < inline.length; i++) {
          const prop = inline.item(i);
          if (prop.startsWith('--')) own.push(prop + ':' + inline.getPropertyValue(prop).trim());
        }
        for (const v of STAGGER_VARS) {
          const val = cs.getPropertyValue(v).trim();
          if (val) own.push(v + ':' + val);
        }
        stagger.add(own.sort().join(';'));
      }
      if (kinds.size === 1 && delays.size === 1 && stagger.size === 1) {
        add('scroll-reveals', 'tell', null, reveals.length + ' elements animate in on scroll with the same reveal and no stagger; vary them by section and stagger children (craft.md).');
      }
    }
  });

  // A broken value reaching the screen: undefined, NaN, null, [object Object].
  rule('raw-values', () => {
    for (const el of textEls) {
      if (el.closest('code, pre, kbd, samp, textarea')) continue;
      const t = ownText(el);
      const raw =
        /\[object Object\]/.test(t) ||
        t === 'null' ||
        t === 'undefined' ||
        /\bNaN\b/.test(t) ||
        /[$€£:]\s*undefined\b|\bundefined\s*(%|px|[$€£])|\d\s*undefined\b|\bundefined\s*\d|\bundefined undefined\b/.test(t);
      if (raw) add('raw-values', 'P1', el, 'A raw value is on screen ("' + t.slice(0, 40) + '"); a missing or broken value is reaching the page.');
    }
  });

  // ---- type -----------------------------------------------------------------------
  // All-caps text needs letter-spacing to stay readable.
  rule('caps-tracking', () => {
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
  });

  // At most two type families on a page (craft.md). Code samples and a logo set in its own face do not count.
  rule('font-families', () => {
    const generic = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|-apple-system|blinkmacsystemfont|emoji|math|inherit|initial)$/;
    const iconFont = /icon|awesome|material symbols|glyph|fontello|feather|remix/;
    const families = new Map<string, { els: number; chars: number }>();
    for (const el of textEls) {
      if (el.closest('code, pre, kbd, samp, [class*="logo" i], [class*="wordmark" i], [aria-hidden="true"]')) continue;
      const first = (getComputedStyle(el).fontFamily.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '').toLowerCase();
      if (!first || generic.test(first) || iconFont.test(first)) continue;
      const entry = families.get(first) ?? { els: 0, chars: 0 };
      entry.els++;
      entry.chars += ownText(el).length;
      families.set(first, entry);
    }
    const used = Array.from(families).filter(([, f]) => (f.els >= 2 && f.chars >= 12) || f.chars >= 24).map(([name]) => name);
    if (used.length > 2) add('font-families', 'P3', null, used.length + ' font families carry text (' + used.join(', ') + '); at most two on a page (craft.md).');
  });

  rule('thin-body-text', () => {
    let total = 0;
    let thin = 0;
    let example: HTMLElement | null = null;
    for (const el of textEls) {
      const len = ownText(el).length;
      const cs = getComputedStyle(el);
      total += len;
      if (parseFloat(cs.fontSize) < 20 && (parseInt(cs.fontWeight, 10) || 400) <= 300) {
        thin += len;
        example ??= el;
      }
    }
    if (thin >= 200 && total > 0 && thin / total > 0.2) {
      add('thin-body-text', 'P2', example, 'About ' + Math.round((thin / total) * 100) + '% of the text is body-sized at weight 300 or lighter; thin strokes at reading sizes are hard to read.');
    }
  });

  rule('timid-headline', () => {
    if (vw < 1280 || appMode || isProductUI()) return;
    const bySize = new Map<number, number>();
    let largest = 0;
    let largestEl: HTMLElement | null = null;
    for (const el of textEls) {
      const size = Math.round(parseFloat(getComputedStyle(el).fontSize));
      bySize.set(size, (bySize.get(size) ?? 0) + ownText(el).length);
      if (onFirstScreen(el.getBoundingClientRect()) && size > largest) {
        largest = size;
        largestEl = el;
      }
    }
    let body = 0;
    let most = 0;
    for (const [size, n] of bySize) {
      if (n > most) {
        most = n;
        body = size;
      }
    }
    if (body && largest && largest < body * 2.2) {
      add('timid-headline', 'P2', largestEl, 'The largest text on the first screen is ' + largest + 'px, only ' + (largest / body).toFixed(1) + ' times the ' + body +
        'px body text; a first-screen headline usually needs at least about 2.2 times (craft.md).');
    }
    const h1 = heads.find((h) => h.tagName === 'H1');
    const h2Size = Math.max(0, ...heads.filter((h) => h.tagName === 'H2').map((h) => parseFloat(getComputedStyle(h).fontSize)));
    if (h1 && h2Size) {
      const h1Size = parseFloat(getComputedStyle(h1).fontSize);
      // A display h1 (four times the body or more) with display type repeated lower down as h2s is
      // display type used as structure, not a timid h1.
      if (h1Size <= h2Size && !(body && h1Size >= body * 4)) add('timid-headline', 'P2', h1, 'The h1 is ' + h1Size + 'px, no larger than an h2 (' + h2Size + 'px).');
    }
  });

  // ---- colour: prompts to confirm a choice, not failures ---------------------------
  rule('colour-flood', () => {
    const samples = groundSamples();
    const tally = new Map<string, { n: number; colour: Rgba; el: Element | null }>();
    for (const s of samples) {
      if (!s.colour) continue;
      const [, sat, l] = hsl(s.colour);
      if (sat <= 0.55 || l < 0.25 || l > 0.85) continue;
      const k = keyOf(s.colour);
      const e = tally.get(k) ?? { n: 0, colour: s.colour, el: s.el };
      e.n++;
      tally.set(k, e);
    }
    for (const e of tally.values()) {
      const share = e.n / samples.length;
      if (share > 0.55) {
        add('colour-flood', 'P3', e.el, 'One saturated colour (rgb(' + keyOf(e.colour) + ')) is the background of about ' + Math.round(share * 100) +
          '% of the first screen. A prompt, not a failure: confirm the flood was chosen and that the main action still stands out.');
      }
    }
  });

  rule('many-hues', () => {
    const families = new Map<number, number>();
    const skip = 'figure, svg, canvas, video, picture, [class*="chart" i], [class*="graph" i]';
    for (const el of pool()) {
      const tag = el.tagName.toUpperCase();
      if (tag === 'IMG' || el instanceof SVGElement || el.closest(skip)) continue;
      const cs = getComputedStyle(el);
      const colours: Rgba[] = [rgba(cs.backgroundColor)];
      if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') colours.push(rgba(cs.borderTopColor));
      else if (parseFloat(cs.borderLeftWidth) > 0 && cs.borderLeftStyle !== 'none') colours.push(rgba(cs.borderLeftColor));
      else if (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== 'none') colours.push(rgba(cs.borderBottomColor));
      if (seen.has(el)) colours.push(rgba(cs.color));
      const buckets = new Set<number>();
      for (const c of colours) {
        if (c[3] < 0.5) continue;
        const [h, s, l] = hsl(c);
        if (s <= 0.45 || l < 0.15 || l > 0.92) continue;
        buckets.add(Math.floor(h / 30) % 12);
      }
      if (!buckets.size || !isVisible(el)) continue;
      for (const b of buckets) families.set(b, (families.get(b) ?? 0) + 1);
    }
    const used = Array.from(families).filter(([, n]) => n >= 5).map(([b]) => b * 30 + '-' + (b * 30 + 30) + ' degrees');
    if (used.length > 3) {
      add('many-hues', 'P3', null, used.length + ' saturated hue families are in use (' + used.join(', ') +
        '). A prompt, not a failure: two neutrals and one accent is the default, so confirm each extra hue has a job such as status or data.');
    }
  });

  rule('pure-black-white', () => {
    // An app's system grounds are pure white and pure black by design.
    if (appMode) return;
    const byColour = new Map<string, number>();
    for (const el of textEls) {
      const c = rgba(getComputedStyle(el).color);
      if (c[3] < 1) continue;
      const k = keyOf(c);
      byColour.set(k, (byColour.get(k) ?? 0) + ownText(el).length);
    }
    let text = '';
    let most = 0;
    for (const [k, n] of byColour) {
      if (n > most) {
        most = n;
        text = k;
      }
    }
    const ground = dominantGround();
    if (!ground || !text) return;
    const g = keyOf(ground.colour);
    if ((text === '0,0,0' && g === '255,255,255') || (text === '255,255,255' && g === '0,0,0')) {
      add('pure-black-white', 'P3', null, 'The main text is pure ' + (text === '0,0,0' ? 'black on pure white' : 'white on pure black') +
        '. A prompt, not a failure: a slightly tinted ink and ground are usually easier on the eye (craft.md).');
    }
  });

  // ---- first screen -------------------------------------------------------------------
  rule('competing-actions', () => {
    // Several different filled actions in the same colour on one screen compete for the primary action.
    // Repeats of one action (a Book button on every row) are one kind of action and count once:
    // the same accessible name, or the same destination. A set of app-store badges is one action.
    // Skip links and visually hidden links are not on the screen and do not count. Digits are ignored in the name, so
    // times and dates on a programme ("18:30", "Book 20:45") read as one action.
    const pageBg = backgroundOf(document.body) ?? [255, 255, 255, 1];
    const filled = new Map<string, HTMLElement[]>();
    const seenName = new Map<string, Set<string>>();
    const seenHref = new Map<string, Set<string>>();
    const nameOf = (el: HTMLElement): string =>
      (el.getAttribute('aria-label') || textOf(el) || (el as HTMLInputElement).value || '')
        .toLowerCase()
        .replace(/\d+/g, '#')
        .replace(/\s+/g, ' ')
        .trim();
    // App-store badges (App Store, Google Play, and the like) are one action, "get the app", however many stores.
    const STORE_HREF = /^https?:\/\/(apps\.apple\.com|itunes\.apple\.com|play\.google\.com|(www\.)?microsoft\.com\/store|apps\.microsoft\.com|(www\.)?amazon\.[a-z.]+\/.*appstore|appgallery\.huawei\.com|f-droid\.org)/i;
    const STORE_NAME = /\b(app store|google play|play store|microsoft store|appgallery|f-droid)\b/i;
    const isStore = (el: HTMLElement): boolean =>
      (el instanceof HTMLAnchorElement && STORE_HREF.test(el.href)) || STORE_NAME.test(el.getAttribute('aria-label') || textOf(el));
    const hrefOf = (el: HTMLElement): string => {
      if (!(el instanceof HTMLAnchorElement)) return '';
      const h = el.getAttribute('href') ?? '';
      if (!h || h === '#') return '';
      if (isStore(el)) return 'store:';
      return el.href.replace(/\/$/, '');
    };
    // A skip link, or anything visually hidden until it is focused, is not on the first screen.
    const isSkipLink = (el: HTMLElement): boolean =>
      el instanceof HTMLAnchorElement && /^#./.test(el.getAttribute('href') ?? '') && /^(skip|jump)\b/i.test(textOf(el) || el.getAttribute('aria-label') || '');
    const visuallyHidden = (el: HTMLElement): boolean => {
      for (let n: HTMLElement | null = el; n && n !== document.body; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.position === 'absolute' && /^rect\(\s*0(px)?[,\s]+0(px)?[,\s]+0(px)?[,\s]+0(px)?\s*\)$/.test(cs.clip)) return true;
        if (/inset\(50%\)|inset\(100%\)/.test(cs.clipPath)) return true;
        const nr = n.getBoundingClientRect();
        if (nr.width <= 2 && nr.height <= 2 && cs.overflow === 'hidden') return true;
      }
      return false;
    };
    for (const el of all('button, a[href], input[type="submit"], [role="button"]')) {
      if (!isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (!onFirstScreen(r) || r.width < 60 || r.height < 28) continue;
      if (isSkipLink(el) || visuallyHidden(el)) continue;
      if (el.closest('[class*="logo" i], [class*="brand" i], [class*="wordmark" i]')) continue; // a filled logo is not an action
      const bg = rgba(getComputedStyle(el).backgroundColor);
      if (bg[3] < 0.9 || ratio(bg, pageBg) < 1.6) continue;
      const key = keyOf(bg);
      const names = seenName.get(key) ?? new Set<string>();
      const hrefs = seenHref.get(key) ?? new Set<string>();
      seenName.set(key, names);
      seenHref.set(key, hrefs);
      const store = isStore(el);
      const name = store ? 'store:' : nameOf(el);
      const href = hrefOf(el);
      const repeat = (name !== '' && names.has(name)) || (href !== '' && hrefs.has(href));
      if (name) names.add(name);
      if (href) hrefs.add(href);
      if (repeat) continue;
      const list = filled.get(key) ?? [];
      list.push(el);
      filled.set(key, list);
    }
    for (const list of filled.values()) {
      const first = list[0];
      if (list.length > 2 && first) {
        add('competing-actions', 'P2', first, list.length + ' different filled actions in the same colour are visible on the first screen; one primary action should stand out. (Repeats of one action, such as a Book button on each row, links to the same place, or a set of app-store badges, count once.)');
      }
    }
  });

  rule('first-screen-no-action', () => {
    // Product UI and reading pages (a long article) need no action on the first screen.
    if (appMode || isProductUI() || all('article').some((a) => textOf(a).length > 1500)) return;
    const found = all('button, input[type="submit"], input[type="button"], [role="button"], a[href]').some((el) => {
      if (el.hasAttribute('aria-expanded') || !isVisible(el)) return false;
      const r = el.getBoundingClientRect();
      if (!onFirstScreen(r) || r.width < 60 || r.height < 28) return false;
      const name = textOf(el) || el.getAttribute('aria-label') || (el as HTMLInputElement).value || '';
      if (name.trim().length < 2) return false;
      if (el.tagName !== 'A') return true;
      const cs = getComputedStyle(el);
      const bg = rgba(cs.backgroundColor);
      const behind = el.parentElement ? backgroundOf(el.parentElement) : null;
      if (bg[3] >= 0.5 && (!behind || ratio(over(bg, behind), behind) >= 1.1)) return true; // a filled link
      return parseFloat(cs.borderTopWidth) >= 1 && cs.borderTopStyle !== 'none' && parseFloat(cs.paddingLeft) >= 8; // an outlined link
    });
    if (!found) add('first-screen-no-action', 'P2', null, 'No button or button-styled link is visible on the first screen at ' + vw + 'px; the main action should be reachable without scrolling.');
  });

  rule('first-screen-nothing-large', () => {
    if (vw < 1280 || appMode || isProductUI()) return;
    const area = vw * vh;
    const big = (r: DOMRect): boolean => {
      const w = Math.min(r.right, vw) - Math.max(r.left, 0);
      const h = Math.min(r.bottom, vh) - Math.max(r.top, 0);
      return w > 0 && h > 0 && w * h >= area * 0.15;
    };
    if (textEls.some((el) => parseFloat(getComputedStyle(el).fontSize) >= 44 && onFirstScreen(el.getBoundingClientRect()))) return;
    for (const el of all<Element>('img, svg, canvas, video, picture, iframe')) {
      if (!el.parentElement?.closest('svg') && isVisible(el) && big(el.getBoundingClientRect())) return;
    }
    for (const s of groundSamples()) if (!s.colour && s.el && big(s.el.getBoundingClientRect())) return; // a background picture
    add('first-screen-nothing-large', 'P3', null, 'The first screen has no picture covering at least 15% of it and no text of 44px or more, so nothing leads the eye (faults.md).');
  });

  // ---- buttons: one style and one size for the primary action (craft.md, Space) -------------
  // A filled button is a button-sized control with an opaque fill that stands out from what is
  // behind it. Buttons that share a fill share a role; they should share a height and a corner.
  // Product UI is exempt: it has danger, toolbar and dense controls on purpose.
  interface ButtonGroup {
    colour: Rgba;
    els: HTMLElement[];
    heights: number[];
    corners: Set<string>;
  }
  let buttonMemo: ButtonGroup[] | null = null;
  function filledButtonGroups(): ButtonGroup[] {
    if (buttonMemo) return buttonMemo;
    const groups = new Map<string, ButtonGroup>();
    const skip = '[class*="logo" i], [class*="brand" i], [class*="wordmark" i], [role="tablist"], [role="toolbar"], [role="radiogroup"], [aria-hidden="true"]';
    for (const el of all('button, a[href], input[type="submit"], input[type="button"], [role="button"]')) {
      if (!isVisible(el) || isScreenReaderOnly(el) || el.closest(skip)) continue;
      if (el.hasAttribute('aria-pressed') || el.hasAttribute('aria-expanded') || el.hasAttribute('aria-haspopup') || el.hasAttribute('disabled')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 60 || r.height < 28 || r.height > 80 || r.width > 480) continue; // not a dot, not a card
      const name = (textOf(el) || el.getAttribute('aria-label') || (el as HTMLInputElement).value || '').trim();
      if (name.length < 2 || name.length > 40) continue;
      const cs = getComputedStyle(el);
      const bg = rgba(cs.backgroundColor);
      if (bg[3] < 0.9) continue;
      const behind = el.parentElement ? backgroundOf(el.parentElement) : null;
      if (behind && ratio(bg, behind) < 1.3) continue; // the fill does not stand out, so it is not a filled style
      const h = Math.round(r.height);
      const raw = cs.borderTopLeftRadius;
      const radius = raw.endsWith('%') ? (parseFloat(raw) / 100) * Math.min(r.width, r.height) : parseFloat(raw) || 0;
      const corner = radius >= h / 2 - 1 ? 'fully round' : radius < 2 ? 'square' : radius < 8 ? 'slightly rounded' : radius < 16 ? 'rounded' : 'very rounded';
      const key = keyOf(bg);
      const g = groups.get(key) ?? { colour: bg, els: [], heights: [], corners: new Set<string>() };
      g.els.push(el);
      g.heights.push(h);
      g.corners.add(corner);
      groups.set(key, g);
    }
    buttonMemo = Array.from(groups.values());
    return buttonMemo;
  }
  const saturatedFill = (c: Rgba): boolean => {
    const [, s, l] = hsl(c);
    return s > 0.35 && l > 0.2 && l < 0.85;
  };

  rule('button-styles', () => {
    if (isProductUI()) return;
    const groups = filledButtonGroups();
    for (const g of groups) {
      if (g.els.length < 2) continue;
      const lo = Math.min(...g.heights);
      const hi = Math.max(...g.heights);
      const problems: string[] = [];
      if (hi - lo > 8) problems.push('heights from ' + lo + ' to ' + hi + 'px');
      if (g.corners.size > 1) problems.push('corners ' + Array.from(g.corners).join(' and '));
      if (problems.length) {
        add('button-styles', 'P3', g.els[0] ?? null, g.els.length + ' filled buttons in rgb(' + keyOf(g.colour) + ') differ: ' + problems.join(', ') +
          '. One button style and one size for the primary action across the page (craft.md); confirm any difference was meant.');
      }
    }
    const accents = groups.filter((g) => saturatedFill(g.colour));
    if (accents.length > 1) {
      add('button-styles', 'P3', accents[1]?.els[0] ?? null, accents.length + ' filled button styles in different strong colours (' +
        accents.map((g) => 'rgb(' + keyOf(g.colour) + ')').join(', ') + '); one primary style and one quieter style for the rest (craft.md).');
    }
  });

  rule('primary-button-height', () => {
    if (vw < 1024 || isProductUI()) return;
    const groups = filledButtonGroups();
    const strong = groups.filter((g) => saturatedFill(g.colour));
    const primary = (strong.length ? strong : groups).slice().sort((a, b) => b.els.length - a.els.length)[0];
    if (!primary) return;
    const sorted = primary.heights.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0;
    if (median && (median < 32 || median > 64)) {
      add('primary-button-height', 'P3', primary.els[0] ?? null, 'The primary button is about ' + median + 'px tall at ' + vw +
        'px; about 40-48px is the guidance on desktop (craft.md), so confirm the size was meant.');
    }
  });

  // ---- pictures: one picture style per page (pictures.md) ------------------------------------
  // A heuristic, so only a prompt: a photograph (a JPEG, WebP or AVIF image, a video, or a photo
  // background) and a large drawn scene (an SVG image, or an inline SVG of many shapes with
  // little text) on the same page. Charts, diagrams, maps, logos and icons carry information
  // and are allowed in any register.
  rule('mixed-pictures', () => {
    if (isProductUI()) return;
    const photoFile = /\.(jpe?g|webp|avif|heic)(\?|#|$)/i;
    const drawnFile = /\.svg(\?|#|$)|^data:image\/svg/i;
    const big = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      return r.width >= 240 && r.height >= 160;
    };
    const informational = (el: Element): boolean => {
      for (let n: Element | null = el, i = 0; n && i < 4; n = n.parentElement, i++) {
        const words = n.id + ' ' + (n.getAttribute('class') ?? '') + ' ' + (n.getAttribute('aria-label') ?? '') + ' ' + (n.getAttribute('alt') ?? '');
        if (/chart|graph|plot|diagram|map|route|logo|icon|flag|schema|figure-data/i.test(words)) return true;
      }
      return false;
    };
    let photo: Element | null = null;
    let drawing: Element | null = null;
    for (const el of all<HTMLImageElement>('img')) {
      if (!isVisible(el) || !big(el)) continue;
      const src = el.currentSrc || el.src;
      if (photoFile.test(src)) photo ??= el;
      else if (drawnFile.test(src) && !informational(el)) drawing ??= el;
    }
    if (!photo) photo = all('video').find((el) => isVisible(el) && big(el)) ?? null;
    if (!photo) {
      for (const el of pool()) {
        const bi = getComputedStyle(el).backgroundImage;
        if (!bi || bi === 'none' || !bi.includes('url(')) continue;
        const urls = Array.from(bi.matchAll(/url\(\s*["']?([^"')]+)/g)).map((m) => m[1] ?? '');
        if (urls.some((u) => photoFile.test(u)) && isVisible(el) && big(el)) {
          photo = el;
          break;
        }
      }
    }
    if (!photo) return;
    if (!drawing) {
      for (const svg of all<SVGSVGElement>('svg')) {
        if (svg.parentElement?.closest('svg') || !isVisible(svg) || !big(svg) || informational(svg)) continue;
        const shapes = svg.querySelectorAll('path, rect, circle, ellipse, polygon, polyline, line').length;
        const labels = svg.querySelectorAll('text').length;
        if (shapes >= 12 && labels < 3) {
          drawing = svg;
          break;
        }
      }
    }
    if (drawing) {
      const photoName = photo instanceof HTMLImageElement ? (photo.currentSrc || photo.src).split(/[?#]/)[0]?.split('/').pop() ?? '' : '';
      add('mixed-pictures', 'P3', drawing, 'A large drawn illustration shares the page with photographs (' + (photoName || describe(photo)) +
        '). A prompt, not a failure: one picture style per page unless the user asked for both; a diagram or map that carries information is fine (pictures.md).');
    }
  });

  // ---- layout -------------------------------------------------------------------------
  // A desktop page whose content all sits in a narrow centred column looks small.
  // Measured from the edges of visible text and media, so full-bleed backgrounds
  // with nothing on their edges do not count as content.
  rule('narrow-content', () => {
    if (vw < 1280) return;
    const root: Element = document.querySelector('main') ?? document.body;
    const rootText = textOf(root).replace(/\s+/g, ' ');
    if (rootText.length < 200) return;
    let left = Infinity;
    let right = -Infinity;
    const extend = (r: DOMRect): void => {
      if (r.width < 2 || r.height < 2) return;
      left = Math.min(left, Math.max(0, r.left));
      right = Math.max(right, Math.min(vw, r.right));
    };
    const range = document.createRange();
    for (const el of textEls) {
      if (!root.contains(el) || getComputedStyle(el).position === 'fixed') continue;
      range.selectNodeContents(el);
      extend(range.getBoundingClientRect());
    }
    for (const el of all<Element>('img, svg, canvas, video, input:not([type="hidden"]), select, textarea, button, table', root)) {
      if (el.parentElement?.closest('svg') || !isVisible(el) || getComputedStyle(el).position === 'fixed') continue;
      extend(el.getBoundingClientRect());
    }
    const used = Math.round(right - left);
    if (used > 0 && used < vw * 0.62) {
      add('narrow-content', 'P3', null, 'Content is ' + used + 'px wide in a ' + vw +
        'px viewport: content sits in a narrow column. Fine for a page meant for reading or one whose pictures give the screen its shape; otherwise widen the layout container or let sections use the width (craft.md).');
    }
  });

  rule('fixed-cover', () => {
    if (vw > 480) return;
    const spans: Array<[number, number]> = [];
    let example: Element | null = null;
    // In app mode an open modal sheet and the scrim directly behind it are a state of the screen, not a bar.
    const DIALOG = 'dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]';
    const dialogs = appMode ? all<Element>(DIALOG).filter(isVisible) : [];
    const isModalLayer = (el: Element): boolean => {
      if (el.closest(DIALOG) || dialogs.some((d) => el.contains(d))) return true;
      // A scrim: a fixed layer over most of the screen, right next to an open dialog (or next to the wrapper it sits in).
      const r = el.getBoundingClientRect();
      if (r.width < vw * 0.9 || r.height < vh * 0.9) return false;
      const besideDialog = dialogs.some((d) => {
        for (let n: Element | null = d; n && n !== document.body; n = n.parentElement) {
          if (n.previousElementSibling === el || n.nextElementSibling === el) return true;
        }
        return false;
      });
      if (besideDialog) return true;
      // A shared scrim kept elsewhere in the page: while a dialog is open, a fixed layer over the whole
      // screen with no text and no controls of its own, behind the dialog, is its backdrop.
      if (getComputedStyle(el).position !== 'fixed' || textOf(el) || el.querySelector('a[href], button, input, select, textarea, [role="button"]')) return false;
      const z = (n: Element): number => {
        for (let a: Element | null = n; a && a !== document.body; a = a.parentElement) {
          const v = parseInt(getComputedStyle(a).zIndex, 10);
          if (!Number.isNaN(v)) return v;
        }
        return 0;
      };
      return dialogs.some((d) => {
        const dr = d.getBoundingClientRect();
        const hit = document.elementFromPoint(dr.left + dr.width / 2, dr.top + Math.min(dr.height / 2, 20));
        return (!!hit && (d.contains(hit) || hit.contains(d))) || z(d) >= z(el);
      });
    };
    // App mode: a bottom tab bar that floats or lets the content show through is part of the screen, not a cover.
    const isFloatingTabBar = (el: Element, cs: CSSStyleDeclaration, r: DOMRect): boolean => {
      if (!el.matches('nav, [role="tablist"], [role="navigation"]') && !el.querySelector(':scope > nav, :scope > [role="tablist"]')) return false;
      if (r.bottom < vh - 48 || r.top < vh * 0.6) return false;
      const translucent = rgba(cs.backgroundColor)[3] < 0.999 || parseFloat(cs.opacity) < 1 ||
        (cs.backdropFilter && cs.backdropFilter !== 'none') || ((cs as unknown as { webkitBackdropFilter?: string }).webkitBackdropFilter ?? 'none') !== 'none';
      const floating = vh - r.bottom >= 4 || (r.left >= 4 && r.right <= vw - 4);
      return translucent || floating;
    };
    for (const el of pool()) {
      const cs = getComputedStyle(el);
      if (cs.position !== 'fixed' && cs.position !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      if (r.width < vw * 0.5 || r.right <= 0 || r.left >= vw) continue;
      if (dialogs.length && isModalLayer(el)) continue;
      if (appMode && (isDecorative(el) || isFloatingTabBar(el, cs, r))) continue;
      // A sticky element covers only once it is stuck at its offset.
      if (cs.position === 'sticky') {
        const stuckTop = cs.top !== 'auto' && Math.abs(r.top - parseFloat(cs.top)) < 1;
        const stuckBottom = cs.bottom !== 'auto' && Math.abs(vh - r.bottom - parseFloat(cs.bottom)) < 1;
        if (!stuckTop && !stuckBottom) continue;
      }
      const top = Math.max(0, r.top);
      const bottom = Math.min(vh, r.bottom);
      if (bottom - top <= 0 || !isVisible(el)) continue;
      spans.push([top, bottom]);
      example ??= el;
    }
    spans.sort((a, b) => a[0] - b[0]);
    let covered = 0;
    let end = -Infinity;
    for (const [top, bottom] of spans) {
      const start = Math.max(top, end);
      if (bottom > start) covered += bottom - start;
      end = Math.max(end, bottom);
    }
    if (vh > 0 && covered > vh * 0.25) {
      add('fixed-cover', 'P2', example, 'Fixed and sticky bars cover ' + Math.round((covered / vh) * 100) + '% of the screen height at this width; keep them well under a quarter.');
    }
  });

  rule('near-miss-alignment', () => {
    const root: Element = document.querySelector('main') ?? document.body;
    const blocks: Element[] = [];
    for (const section of Array.from(root.children)) {
      blocks.push(section);
      for (const kid of Array.from(section.children)) blocks.push(kid);
    }
    const edges: Array<{ el: Element; left: number }> = [];
    for (const el of blocks) {
      if (!isVisible(el)) continue;
      const cs = getComputedStyle(el);
      if (cs.position === 'absolute' || cs.position === 'fixed' || cs.transform !== 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 40 || r.height < 8 || (r.left <= 1 && r.right >= vw - 1)) continue;
      edges.push({ el, left: r.left });
    }
    const tally = new Map<number, number>();
    for (const e of edges) tally.set(Math.round(e.left), (tally.get(Math.round(e.left)) ?? 0) + 1);
    let common = 0;
    let most = 0;
    for (const [left, n] of tally) {
      if (n > most) {
        most = n;
        common = left;
      }
    }
    if (most < 4) return;
    let reported = 0;
    for (const e of edges) {
      const off = Math.abs(e.left - common);
      if (off < 1.5 || off > 6 || reported >= 3) continue;
      reported++;
      add('near-miss-alignment', 'P3', e.el, 'Left edge is at ' + Math.round(e.left) + 'px, ' + Math.round(off) + 'px off the common edge at ' + common +
        'px. A prompt, not a failure: confirm the offset is meant.');
    }
  });

  // ---- flow: how the page reads below the first screen (flow.md) -------------------------
  // Measured at 1024px and wider only, and not in app mode. Positions are page coordinates.
  interface Box { l: number; t: number; r: number; b: number; el: Element; font: number }
  const flowOn = vw >= 1024 && !appMode;
  const sy = window.scrollY;
  const sx = window.scrollX;
  const pageH = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight ?? 0);
  /** The site header: a header, banner or nav at the top of the page, or a fixed or sticky bar. */
  const inHeader = (el: Element): boolean => {
    const h = el.closest('header, [role="banner"], nav');
    if (h && !h.closest('main, article, section')) return true;
    // A fixed or sticky bar across the top; a sticky column beside content is content.
    for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) {
      const p = getComputedStyle(n).position;
      if (p !== 'fixed' && p !== 'sticky') continue;
      const r = n.getBoundingClientRect();
      if (r.width >= vw * 0.6 && r.height < vh * 0.3) return true;
    }
    return false;
  };
  const isMedia = (el: Element): boolean => /^(IMG|VIDEO|CANVAS|PICTURE|IFRAME)$/.test(el.tagName) || (el instanceof SVGSVGElement && !el.parentElement?.closest('svg'));
  const hasPictureBackground = (cs: CSSStyleDeclaration): boolean => /url\(/.test(cs.backgroundImage);
  /**
   * What is drawn on the page: lines of text, pictures, video, canvas and SVG, form controls, and
   * boxes with a visible border all round, a shadow, or a background that differs from what is behind them.
   * A ground (a band or section background as wide as the screen) is not content; a picture
   * background is. Each box is in page coordinates.
   */
  let boxesMemo: Box[] | null = null;
  function contentBoxes(): Box[] {
    if (boxesMemo) return boxesMemo;
    const out: Box[] = [];
    // Content inside a box that hides its overflow (an odometer's reel of digits, a clipped strip)
    // counts only as far as that box shows it.
    const clipMemo = new Map<Element, number[] | null>();
    const clipOf = (el: Element | null): number[] | null => {
      if (!el || el === document.body || el === document.documentElement) return null;
      if (clipMemo.has(el)) return clipMemo.get(el) ?? null;
      let out = clipOf(el.parentElement);
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed') out = null;
      if (/hidden|clip|auto|scroll/.test(cs.overflowX + ' ' + cs.overflowY)) {
        const q = el.getBoundingClientRect();
        const mine = [q.left + sx, q.top + sy, q.right + sx, q.bottom + sy];
        out = out ? [Math.max(out[0]!, mine[0]!), Math.max(out[1]!, mine[1]!), Math.min(out[2]!, mine[2]!), Math.min(out[3]!, mine[3]!)] : mine;
      }
      clipMemo.set(el, out);
      return out;
    };
    const push = (r: DOMRect, el: Element, font = 0, clipFrom: Element | null = el.parentElement): void => {
      let [l, t, rr, b] = [r.left + sx, r.top + sy, r.right + sx, r.bottom + sy];
      const c = clipOf(clipFrom);
      if (c) [l, t, rr, b] = [Math.max(l, c[0]!), Math.max(t, c[1]!), Math.min(rr, c[2]!), Math.min(b, c[3]!)];
      if (rr - l < 2 || b - t < 2) return;
      out.push({ l, t, r: rr, b, el, font });
    };
    const range = document.createRange();
    for (const el of textEls) {
      if (inHeader(el)) continue;
      const font = parseFloat(getComputedStyle(el).fontSize) || 0;
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType !== Node.TEXT_NODE || !node.nodeValue?.trim()) continue;
        range.selectNode(node);
        for (const r of Array.from(range.getClientRects())) push(r, el, font, el);
      }
    }
    for (const el of pool()) {
      if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) continue;
      const media = isMedia(el) || /^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(el.tagName);
      const cs = getComputedStyle(el);
      let box = media;
      if (!box) {
        const bg = rgba(cs.backgroundColor);
        const borders = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].every((w) => parseFloat(w) >= 1) &&
          cs.borderTopStyle !== 'none' && rgba(cs.borderTopColor)[3] > 0.1;
        const picture = hasPictureBackground(cs);
        let differs = false;
        if (bg[3] > 0.05 && el.parentElement) {
          const behind = backgroundOf(el.parentElement);
          const mine = over(bg, behind ?? [255, 255, 255, 1]);
          differs = !behind || Math.abs(luminance(mine) - luminance(behind)) > 0.004 || keyOf(mine) !== keyOf(behind) && Math.max(...[0, 1, 2].map((i) => Math.abs((mine[i] ?? 0) - (behind[i] ?? 0)))) > 6;
        }
        const gradient = /gradient\(/.test(cs.backgroundImage);
        // A card lifted off the ground by a shadow alone is still a card.
        const shadow = cs.boxShadow !== 'none' && !/inset/.test(cs.boxShadow) && el.getBoundingClientRect().height >= 40;
        box = picture || borders || differs || gradient || shadow;
        if (box && !picture && !shadow && !borders && !(parseFloat(cs.borderTopLeftRadius) > 0)) {
          // A ground: a plain band as wide as the screen is the page or the section, not a thing on it.
          const r = el.getBoundingClientRect();
          if (r.width >= vw * 0.9) box = false;
        }
      }
      if (!box || !isVisible(el) || inHeader(el)) continue;
      if (cs.position === 'fixed') continue;
      push(el.getBoundingClientRect(), el);
    }
    return (boxesMemo = out);
  }
  /** The left and right edges of the main text column: where the page's text lines start and end. */
  function textColumn(): [number, number] | null {
    const lefts: number[] = [];
    const rights: number[] = [];
    for (const b of contentBoxes()) {
      if (!b.font) continue;
      lefts.push(Math.max(0, b.l));
      rights.push(Math.min(vw, b.r));
    }
    if (lefts.length < 5) return null;
    lefts.sort((a, b) => a - b);
    rights.sort((a, b) => a - b);
    // Ignore the odd outlier, such as a caption on a full-bleed picture.
    const l = lefts[Math.floor(lefts.length * 0.03)] ?? 0;
    const r = rights[Math.ceil(rights.length * 0.97) - 1] ?? vw;
    return r - l > 200 ? [l, r] : null;
  }
  const headingText = (h: Element | null | undefined): string => (h ? '"' + textOf(h).replace(/\s+/g, ' ').slice(0, 50) + '"' : 'no heading');
  /** The page's sections: the blocks of main (stepping through wrappers that hold all of it), header and footer left out. */
  function flowSections(): Element[] {
    let root: Element = document.querySelector('main') ?? document.body;
    for (let i = 0; i < 4; i++) {
      const kids = Array.from(root.children).filter(isVisible);
      const only = kids.length === 1 ? kids[0] : undefined;
      if (!only || only.tagName === 'SECTION') break;
      root = only;
    }
    return Array.from(root.children).filter((el) => isVisible(el) && !/^(HEADER|FOOTER|NAV|SCRIPT|STYLE|DIALOG|TEMPLATE)$/.test(el.tagName) && !inHeader(el));
  }
  /** Step down through wrappers with a single visible child: where a section's layout happens. */
  function layoutBox(el: Element): Element {
    let n = el;
    for (let i = 0; i < 5; i++) {
      const kids = Array.from(n.children).filter(isVisible);
      const only = kids.length === 1 ? kids[0] : undefined;
      if (!only || /^H[1-6]$/.test(only.tagName)) break;
      n = only;
    }
    return n;
  }
  const innerBox = (el: Element): [number, number] => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return [r.left + sx + (parseFloat(cs.paddingLeft) || 0), r.right + sx - (parseFloat(cs.paddingRight) || 0)];
  };

  /**
   * Coverage of a region, strip by strip: for each STRIP-tall strip from y0 to y1, the share of
   * the width from x0 to x1 that content covers. Boxes may be limited to those inside one element.
   */
  const STRIP = 8;
  function coverage(boxes: Array<{ l: number; t: number; r: number; b: number }>, x0: number, x1: number, y0: number, y1: number): number[] {
    const n = Math.max(0, Math.floor((y1 - y0) / STRIP));
    const w = x1 - x0;
    const spans: Array<Array<[number, number]>> = Array.from({ length: n }, () => []);
    for (const b of boxes) {
      const l = Math.max(x0, b.l);
      const r = Math.min(x1, b.r);
      if (r <= l || b.b <= y0 || b.t >= y1) continue;
      const i0 = Math.max(0, Math.floor((b.t - y0) / STRIP));
      const i1 = Math.min(n - 1, Math.floor((b.b - 0.01 - y0) / STRIP));
      for (let i = i0; i <= i1; i++) spans[i]?.push([l, r]);
    }
    return spans.map((list) => {
      list.sort((p, q) => p[0] - q[0]);
      let sum = 0;
      let to = -Infinity;
      for (const [l, r] of list) {
        const from = Math.max(l, to);
        if (r > from) sum += r - from;
        to = Math.max(to, r);
      }
      return w > 0 ? sum / w : 0;
    });
  }
  const mean = (list: number[]): number => (list.length ? list.reduce((x, y) => x + y, 0) / list.length : 0);
  /** The nearest heading to a stretch of page: the last one above its middle, else the next one below. */
  const nearestHeading = (top: number, bottom: number): Element | null => {
    const at = heads.filter((h) => !inHeader(h)).map((h) => ({ h, y: h.getBoundingClientRect().top + sy }));
    return (at.filter((x) => x.y <= (top + bottom) / 2).pop() ?? at.find((x) => x.y > top))?.h ?? null;
  };
  /** Where the page's content starts: below a header at the top of the page. */
  const contentStart = (): number => {
    let start = 0;
    for (const el of all<Element>('header, [role="banner"]')) {
      if (!isVisible(el) || el.closest('main, article, section')) continue;
      const r = el.getBoundingClientRect();
      if (r.top + sy < vh * 0.5) start = Math.max(start, r.bottom + sy);
    }
    return start;
  };

  /**
   * The element's nearest sticky ancestor (itself included), short of `stop`. A sticky header bar
   * is the header, not content, and is not looked for here (inHeader leaves it out).
   */
  const stickyMemo = new Map<Element, Element | null>();
  const stickyOf = (el: Element, stop: Element | null = null): Element | null => {
    for (let n: Element | null = el; n && n !== stop && n !== document.body; n = n.parentElement) {
      let hit = stickyMemo.get(n);
      if (hit === undefined) {
        hit = getComputedStyle(n).position === 'sticky' ? n : null;
        stickyMemo.set(n, hit);
      }
      if (hit) return hit;
    }
    return null;
  };
  /**
   * How far a sticky element travels as the page scrolls: from where it sits now to the far end
   * of its containing block (its parent's content box), down for one that sticks to the top, up
   * for one that sticks to the bottom. [up, down] in pixels.
   */
  const travelMemo = new Map<Element, [number, number]>();
  const stickyTravel = (s: Element): [number, number] => {
    const known = travelMemo.get(s);
    if (known) return known;
    let travel: [number, number] = [0, 0];
    const p = s.parentElement;
    if (p) {
      const pr = p.getBoundingClientRect();
      const pcs = getComputedStyle(p);
      const cs = getComputedStyle(s);
      const sr = s.getBoundingClientRect();
      const floor = pr.bottom - (parseFloat(pcs.paddingBottom) || 0) - (parseFloat(pcs.borderBottomWidth) || 0) - (parseFloat(cs.marginBottom) || 0);
      const ceiling = pr.top + (parseFloat(pcs.paddingTop) || 0) + (parseFloat(pcs.borderTopWidth) || 0) + (parseFloat(cs.marginTop) || 0);
      if (cs.top !== 'auto') travel = [0, Math.max(0, floor - sr.bottom)];
      else if (cs.bottom !== 'auto') travel = [Math.max(0, sr.top - ceiling), 0];
    }
    travelMemo.set(s, travel);
    return travel;
  };
  /**
   * A content box stretched over every part of the page it is seen beside: content inside a sticky
   * element covers the whole range the element travels through within its containing block.
   */
  const reach = <T extends { t: number; b: number; el: Element }>(b: T, stop: Element | null = null): T => {
    const s = stickyOf(b.el, stop);
    if (!s) return b;
    const [up, down] = stickyTravel(s);
    return up || down ? { ...b, t: b.t - up, b: b.b + down } : b;
  };

  /**
   * Snapshot mode (shot.js stepping down the page): what is on this screen now. Content in a
   * small fixed element (a cursor follower, a floating badge) goes with the visitor everywhere and
   * fills nothing, so it is left out; a large fixed layer is kept.
   */
  function viewSnapshot(): View {
    let top = 0;
    const floatingMemo = new Map<Element, boolean>();
    const scenes: number[][] = [];
    // Pictures out of flow that contentBoxes leaves out: a large fixed picture or picture background
    // (a photograph held behind a hero), and a picture background drawn by ::before or ::after (the
    // hero's photograph set as an absolutely placed layer). Each counts where it shows on this screen:
    // its box, cut by any ancestor that clips it (clip-path, or a hiding overflow that applies to it).
    // Small ones are decoration or a floating badge and fill nothing. Viewport rows, page columns.
    const fillers: Array<{ host: Element; l: number; t: number; r: number; b: number }> = [];
    {
      const cut = (el: Element, rect: number[], fixed: boolean): number[] => {
        let [l = 0, t = 0, r = 0, b = 0] = rect;
        for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
          const cs = getComputedStyle(n);
          const hides = /hidden|clip|auto|scroll/.test(cs.overflowX + ' ' + cs.overflowY);
          const holdsFixed = cs.transform !== 'none' || cs.filter !== 'none' || /paint|strict|content/.test(cs.contain);
          if (cs.clipPath !== 'none' || hides && (!fixed || holdsFixed)) {
            const q = n.getBoundingClientRect();
            [l, t, r, b] = [Math.max(l, q.left), Math.max(t, q.top), Math.min(r, q.right), Math.min(b, q.bottom)];
          }
        }
        return [l, t, r, b];
      };
      const big = (w: number, h: number): boolean => w >= vw * 0.25 && h >= vh * 0.25;
      for (const el of pool()) {
        if (inHeader(el) || !isVisible(el)) continue;
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' && (isMedia(el) || hasPictureBackground(cs))) {
          const q = el.getBoundingClientRect();
          if (big(q.width, q.height)) {
            const [l = 0, t = 0, r = 0, b = 0] = cut(el, [q.left, q.top, q.right, q.bottom], true);
            fillers.push({ host: el, l, t, r, b });
          }
        }
        for (const which of ['::before', '::after']) {
          const ps = getComputedStyle(el, which);
          if (ps.content === 'none' || ps.content === 'normal' || ps.display === 'none' || ps.visibility === 'hidden' || (parseFloat(ps.opacity) || 0) < 0.1) continue;
          if (!hasPictureBackground(ps) || (ps.position !== 'absolute' && ps.position !== 'fixed')) continue;
          const w = parseFloat(ps.width);
          const h = parseFloat(ps.height);
          if (!(w > 0 && h > 0) || !big(w, h)) continue;
          let x = parseFloat(ps.left);
          let y = parseFloat(ps.top);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          if (ps.position === 'absolute') {
            // Placed against the nearest positioned ancestor's padding box (the element itself, usually).
            let cb: Element | null = el;
            while (cb && cb !== document.body && getComputedStyle(cb).position === 'static') cb = cb.parentElement;
            const q = (cb ?? document.documentElement).getBoundingClientRect();
            const ccs = getComputedStyle(cb ?? document.documentElement);
            x += q.left + (parseFloat(ccs.borderLeftWidth) || 0);
            y += q.top + (parseFloat(ccs.borderTopWidth) || 0);
          }
          const [l = 0, t = 0, r = 0, b = 0] = cut(el, [x, y, x + w, y + h], ps.position === 'fixed');
          // An absolute layer is also cut by its own element when that hides its overflow.
          const own = /hidden|clip/.test(cs.overflowX + ' ' + cs.overflowY) || cs.clipPath !== 'none' ? el.getBoundingClientRect() : null;
          fillers.push(own ? { host: el, l: Math.max(l, own.left), t: Math.max(t, own.top), r: Math.min(r, own.right), b: Math.min(b, own.bottom) } : { host: el, l, t, r, b });
        }
      }
    }
    // A sticky element is holding the screen when it is stuck where its top (or bottom) puts it, not
    // yet pushed off by the end of its scene, and what it holds is a third of the screen tall or more:
    // the scroll space beside it, between steps set well apart, is not blank, for the visitor is
    // looking at it. Its own transform (a centring translate) is taken off before comparing.
    const heldNow = (el: Element, r: DOMRect): boolean => {
      const cs = getComputedStyle(el);
      let ty = 0;
      if (cs.transform && cs.transform !== 'none') {
        try { ty += new DOMMatrixReadOnly(cs.transform).m42; } catch { /* not a matrix */ }
      }
      const tr = (cs.translate || '').split(/\s+/)[1];
      if (tr) ty += /%$/.test(tr) ? (parseFloat(tr) / 100) * (el as HTMLElement).offsetHeight : parseFloat(tr) || 0;
      const lt = r.top - ty;
      const lb = r.bottom - ty;
      const stuck = cs.top !== 'auto' ? Math.abs(lt - parseFloat(cs.top)) <= 2 : cs.bottom !== 'auto' ? Math.abs(vh - lb - parseFloat(cs.bottom)) <= 2 : false;
      if (!stuck || r.bottom <= 0 || r.top >= vh) return false;
      let t0 = Infinity;
      let b0 = -Infinity;
      for (const b of contentBoxes()) {
        if (!el.contains(b.el)) continue;
        t0 = Math.min(t0, Math.max(0, b.t - sy));
        b0 = Math.max(b0, Math.min(vh, b.b - sy));
      }
      for (const f of fillers) {
        if (!el.contains(f.host) || f.b <= f.t) continue;
        t0 = Math.min(t0, Math.max(0, f.t));
        b0 = Math.max(b0, Math.min(vh, f.b));
      }
      return b0 - t0 >= vh / 3;
    };
    for (const el of pool()) {
      const p = getComputedStyle(el).position;
      if (p !== 'fixed' && p !== 'sticky') continue;
      const r = el.getBoundingClientRect();
      if (p === 'fixed') floatingMemo.set(el, r.width < vw * 0.4 || r.height < vh * 0.4);
      const bar = r.width >= vw * 0.6 && r.height < vh * 0.3;
      if (r.top <= 1 && r.bottom > 0 && bar && isVisible(el)) top = Math.max(top, r.bottom);
      const pr = el.parentElement?.getBoundingClientRect();
      if (p === 'sticky' && !bar && pr && pr.bottom > 0 && pr.top < vh) scenes.push([Math.round(Math.max(0, pr.top)), Math.round(Math.min(vh, pr.bottom)), heldNow(el, r) ? 1 : 0]);
    }
    const floating = (el: Element): boolean => {
      for (let n: Element | null = el; n && n !== document.body; n = n.parentElement) if (floatingMemo.get(n)) return true;
      return false;
    };
    const boxes: number[][] = [];
    for (const b of contentBoxes()) {
      const t = b.t - sy;
      const bottom = b.b - sy;
      if (bottom <= top || t >= vh || b.r - sx <= 0 || b.l - sx >= vw || floating(b.el)) continue;
      boxes.push([Math.round(b.l), Math.round(Math.max(top, t)), Math.round(b.r), Math.round(Math.min(vh, bottom)), Math.round(b.font)]);
    }
    for (const f of fillers) {
      const t = Math.max(top, f.t);
      const bottom = Math.min(vh, f.b);
      const l = Math.max(0, f.l);
      const r = Math.min(vw, f.r);
      if (bottom - t < 2 || r - l < 2) continue;
      boxes.push([Math.round(l + sx), Math.round(t), Math.round(r + sx), Math.round(bottom), 0]);
    }
    // The ground down the screen's left edge, so an empty stretch that crosses from one section's
    // ground to another's can be told from one on a single unbroken ground.
    const grounds: string[] = [];
    for (let y = 0; y < vh; y += STRIP) {
      const at = document.elementFromPoint(2, y + STRIP / 2);
      const c = at ? backgroundOf(at) : null;
      grounds.push(c ? keyOf(c) : '');
    }
    return { y: Math.round(sy), top: Math.round(top), boxes, grounds, scenes };
  }
  if (snapshotMode) return viewSnapshot();

  // A tall stretch of page with almost nothing on it reads as the page running out.
  // Measured as a visitor sees it: shot.js steps down the page a third of a screen at a time and
  // records what is on each screen (sticky and pinned content where it is stuck, a sideways
  // gallery where it has slid to, nothing hidden under the header bar). Each screen is cut into
  // 8px strips; a strip's coverage is the share of the text column that content covers. Any
  // stretch half a screen tall whose average coverage is under 12% is reported, as is a stretch
  // of a third of a screen with nothing at all on it: the empty end of a pinned scene. A stretch
  // that holds a type line of 96px or more is a deliberate statement and is left alone, and the
  // last 200px of the page are left out. Run without shot.js, the page is measured as it lies,
  // and content in a sticky element counts over the whole range it travels.
  // Separately, three or more empty gaps of 240px or more between blocks (section padding stacked
  // on section padding) are reported once, as a prompt.
  rule('blank-band', () => {
    // A page of about one screen has no flow to break; the first-screen rules judge it.
    if (!flowOn || vh <= 0 || pageH < vh * 1.5) return;
    const column = textColumn();
    if (!column) return;
    const [cl, cr] = column;
    const cw = cr - cl;
    const THRESHOLD = 0.12;
    const span = Math.ceil((vh * 0.5) / STRIP);
    const VOID = 240;
    const sceneEnds: Array<[number, number]> = [];
    // Stretches that hold a statement line; seen from another scroll position the same stretch may
    // have the line just off screen, and it is still the statement's room.
    const statements: Array<[number, number]> = [];
    const found: Array<{ top: number; bottom: number; lowest: number; scene: boolean }> = [];
    const gapsFound: Array<[number, number]> = [];
    type Flat = { l: number; t: number; r: number; b: number; font: number };
    /** Look through one run of strips that starts at y0 (and lies at `shift` down the page). */
    const scan = (boxes: Flat[], y0: number, y1: number, shift: number, clipped: boolean, grounds: string[] | null = null, scenes: number[][] = []): void => {
      const cover = coverage(boxes, cl, cr, y0, y1);
      const n = cover.length;
      // Beside a sticky element that is holding the screen (stuck, with a third of a screen of content),
      // the screen is not blank, however far apart the steps beside it are set.
      for (const [t = 0, e = 0, held = 0] of scenes) {
        if (!held) continue;
        for (let i = Math.max(0, Math.floor((t - y0) / STRIP)); i < n && y0 + i * STRIP < e; i++) cover[i] = Math.max(cover[i] ?? 0, 1);
      }
      const prefix = [0];
      for (const c of cover) prefix.push((prefix[prefix.length - 1] ?? 0) + c);
      const avg = (i: number, j: number): number => ((prefix[j] ?? 0) - (prefix[i] ?? 0)) / Math.max(1, j - i);
      const marked = new Array<boolean>(n).fill(false);
      for (let i = 0; i + span <= n; i++) {
        if (avg(i, i + span) < THRESHOLD) for (let k = i; k < i + span; k++) marked[k] = true;
      }
      // Nothing at all on one unbroken ground, 240px or more where a sticky scene runs (the stretch it
      // leaves behind when it ends) or 40% of the screen anywhere: on a visitor's screen that reads as
      // the page running out. The same gap across a change of ground is a break between sections,
      // left to the prompt below. Only known from the screens shot.js saw.
      if (grounds) {
        const first = Math.round(y0 / STRIP);
        const same = (a: string | undefined, b: string | undefined): boolean => {
          if (a === b) return true;
          const p = (a ?? '').split(',').map(Number);
          const q = (b ?? '').split(',').map(Number);
          return p.length === 3 && q.length === 3 && p.every((v, k) => Math.abs(v - (q[k] ?? 0)) <= 6);
        };
        for (let i = 0; i < n; i++) {
          if ((cover[i] ?? 0) > 0.005) continue;
          let j = i;
          while (j + 1 < n && (cover[j + 1] ?? 0) <= 0.005) j++;
          let one = true;
          for (let k = i + 1; k <= j && one; k++) one = same(grounds[first + k], grounds[first + i]);
          const a = y0 + i * STRIP;
          const b = y0 + (j + 1) * STRIP;
          const inScene = scenes.some(([t = 0, e = 0]) => t < b && e > a);
          if (one && ((j + 1 - i) * STRIP >= VOID && inScene || (j + 1 - i) * STRIP >= vh * 0.4)) {
            for (let k = i; k <= j; k++) marked[k] = true;
            if (inScene) sceneEnds.push([a + shift, b + shift]);
          }
          i = j;
        }
      }
      const inBand = new Array<boolean>(n).fill(false);
      for (let i = 0; i < n; i++) {
        if (!marked[i]) continue;
        let j = i;
        while (j + 1 < n && marked[j + 1]) j++;
        const top = y0 + i * STRIP;
        const bottom = y0 + (j + 1) * STRIP;
        // A large type line set on its own is a statement, not an empty stretch.
        if (boxes.some((b) => b.font >= 96 && b.t < bottom && b.b > top && b.r - b.l >= cw * 0.3)) statements.push([top + shift, bottom + shift]);
        else {
          for (let k = i; k <= j; k++) inBand[k] = true;
          let lowest = avg(i, j + 1);
          for (let k = i; k + span <= j + 1; k++) lowest = Math.min(lowest, avg(k, k + span));
          found.push({ top: top + shift, bottom: bottom + shift, lowest, scene: sceneEnds.some(([a, b]) => a < bottom + shift && b > top + shift) });
        }
        i = j;
      }
      // Empty gaps between blocks: strips with nothing at all on them, 240px or more in a row.
      for (let i = 0; i < n; i++) {
        if ((cover[i] ?? 0) > 0.005 || inBand[i]) continue;
        let j = i;
        while (j + 1 < n && (cover[j + 1] ?? 0) <= 0.005 && !inBand[j + 1]) j++;
        // A gap cut off by the screen's edge may run on past it: only whole gaps count.
        if ((j + 1 - i) * STRIP >= 240 && !(clipped && (i === 0 || j === n - 1))) gapsFound.push([y0 + i * STRIP + shift, y0 + (j + 1) * STRIP + shift]);
        i = j;
      }
    };
    const views = (options.views ?? []).filter((v) => v && Array.isArray(v.boxes));
    if (views.length) {
      for (const v of views) {
        const boxes = v.boxes.map(([l = 0, t = 0, r = 0, b = 0, font = 0]) => ({ l, t, r, b, font }));
        scan(boxes, Math.max(0, v.top), Math.min(vh, pageH - 200 - v.y), v.y, true, Array.isArray(v.grounds) ? v.grounds : null, Array.isArray(v.scenes) ? v.scenes : []);
      }
    } else {
      const start = contentStart();
      scan(contentBoxes().map((b) => reach(b)), start, pageH - 200, 0, false);
    }
    // The same stretch seen from several scroll positions is one stretch.
    const merge = <T extends { top: number; bottom: number }>(list: T[], join: (a: T, b: T) => void): T[] => {
      const out: T[] = [];
      for (const x of list.slice().sort((a, b) => a.top - b.top)) {
        const last = out[out.length - 1];
        if (last && x.top <= last.bottom + STRIP) join(last, x);
        else out.push({ ...x });
      }
      return out;
    };
    const bands = merge(found, (a, b) => { a.bottom = Math.max(a.bottom, b.bottom); a.lowest = Math.min(a.lowest, b.lowest); a.scene ||= b.scene; })
      .filter((band) => !statements.some(([t, b]) => t < band.bottom && b > band.top));
    for (const { top, bottom, lowest, scene } of bands) {
      const near = nearestHeading(top, bottom);
      const what = scene && lowest < 0.005 ? 'nothing at all is on screen where the sticky scene beside it ends'
        : 'content covers ' + (lowest < 0.01 ? 'almost none' : 'about ' + Math.floor(lowest * 100) + '%') + ' of the column (under 12% is reported)';
      add('blank-band', 'P3', near, 'From ' + Math.round(top) + ' to ' + Math.round(bottom) + 'px down the page (' + ((bottom - top) / vh).toFixed(1) +
        ' screens), ' + what + ', near the heading ' + headingText(near) +
        '. Look at it: fine when it is a deliberate panel whose one strong thing has room; otherwise fill it with the section\'s picture or proof, tighten the spacing, or join it to its neighbour (flow.md).');
    }
    // A sticky element that fills only the top of the screen leaves its own column empty under it
    // for as long as it stays stuck: a tag or card pinned at the top with the rest of its column bare.
    // Reported when it travels a fifth of a screen or more, the empty part under it is half the
    // screen or more, and nothing else in its containing block fills its column under it.
    const placed = contentBoxes();
    const stickies = new Set<Element>();
    for (const b of placed) { const st = stickyOf(b.el); if (st) stickies.add(st); }
    for (const st of stickies) {
      const [, down] = stickyTravel(st);
      const stuck = parseFloat(getComputedStyle(st).top);

      if (down < vh * 0.2 || !Number.isFinite(stuck)) continue;
      const own = placed.filter((b) => st.contains(b.el));
      if (!own.length) continue;
      const sTop = st.getBoundingClientRect().top + sy;
      const l = Math.min(...own.map((b) => b.l));
      const r = Math.max(...own.map((b) => b.r));
      const filled = Math.max(...own.map((b) => b.b)) - sTop;
      const under = vh - (stuck + filled);
      if (under < vh * 0.5 || r - l < cw * 0.15) continue;
      // What else its containing block holds under it, in its column.
      const from = sTop + filled;
      const to = from + down;
      const others = placed.filter((b) => !st.contains(b.el) && b.r > l + 8 && b.l < r - 8 && b.b > from && b.t < to);
      if (mean(coverage(others, l, r, from, to)) > 0.05) continue;
      const near = nearestHeading(sTop, sTop + down);
      add('blank-band', 'P3', st, 'This sticky block stays on screen for ' + Math.round(down) + 'px of scrolling but fills only the top ' + Math.round(stuck + filled) +
        'px of the screen: under it, its column is empty for the rest of the screen (' + Math.round(under) + 'px, ' + Math.round((under / vh) * 100) +
        '%) the whole way, near the heading ' + headingText(near) + '. Let it fill the screen\'s height, or stack the next thing under it (flow.md).');
    }
    const gaps = merge(gapsFound.map(([top, bottom]) => ({ top, bottom })), (a, b) => { a.bottom = Math.max(a.bottom, b.bottom); })
      .filter((g) => !bands.some((b) => g.top < b.bottom && g.bottom > b.top));
    if (gaps.length >= 3) {
      const sizes = gaps.map((g) => Math.round(g.bottom - g.top)).sort((x, y) => x - y);
      add('blank-band', 'P3', null, gaps.length + ' empty gaps of 240px or more separate the blocks of this page (' + sizes[0] + ' to ' + sizes[sizes.length - 1] +
        'px, at ' + gaps.slice(0, 6).map((g) => Math.round(g.top)).join(', ') + 'px...). Padding stacked on padding makes each section a separate island; ' +
        'tighten the spacing, or let a picture, rule or overlap carry the eye from one section into the next (flow.md).');
    }
  });

  // A section, or a tall block in one, with one side left empty. The block's width is split into
  // a left and a right zone of 45% each. A zone is empty when nothing is in it for 75% or more of
  // the block's content height (and the other side is three times fuller), when content covers
  // under 5% of its area, or under 12% while the other side is five times fuller (a row of big
  // names with small notes beside them). Reported when one zone is empty and the other, at least
  // 15% covered, is not. The first screen and centred columns are left alone, and so is a block
  // with a sticky column, filled over its whole scroll range while the other side scrolls past it.
  // A column with another column beside it is judged as part of its row (so a list beside a sticky
  // side column is not judged alone), and content capped by a max-width container centred in a
  // wider block is judged within that container's width.
  rule('lopsided-section', () => {
    if (!flowOn) return;
    const boxes = contentBoxes();
    const reported = new Set<Element>();
    const candidates: Element[] = [];
    for (const section of flowSections()) {
      candidates.push(section);
      for (const kid of Array.from(layoutBox(section).children)) if (isVisible(kid)) candidates.push(kid);
    }
    const sections = new Set(flowSections());
    // A column with another column beside it is judged with that column, as part of its row (the
    // section): a list that keeps to the left of its own column is not a lopsided section when the
    // column beside it, sticky or filled, fills the other side.
    const besideAnother = (el: Element): boolean => {
      const p = el.parentElement;
      if (!p || sections.has(el)) return false;
      const r = el.getBoundingClientRect();
      return Array.from(p.children).some((sib) => {
        if (sib === el || !isVisible(sib)) return false;
        const q = sib.getBoundingClientRect();
        return q.width > 40 && q.top < r.bottom - 4 && q.bottom > r.top + 4 && (q.left >= r.right - 4 || q.right <= r.left + 4) && boxes.some((b) => sib.contains(b.el));
      });
    };
    for (const el of candidates) {
      if (Array.from(reported).some((p) => p.contains(el))) continue;
      if (besideAnother(el)) continue;
      const box = layoutBox(el);
      // A track wider than the screen (a sideways gallery) shows only part of itself: not a column layout.
      if (box.getBoundingClientRect().width > vw * 1.02) continue;
      let [cl, cr] = innerBox(box);
      if (cr - cl < vw * 0.5) continue;
      // Content capped by a max-width container centred in a wider block (the blocks in it share one
      // centred measure): judge the sides of that measure, not the empty margins either side of it.
      const kids = Array.from(box.children).filter(isVisible).map((k) => k.getBoundingClientRect());
      if (kids.length) {
        const minL = Math.max(cl, Math.min(...kids.map((k) => k.left + sx)));
        const maxR = Math.min(cr, Math.max(...kids.map((k) => k.right + sx)));
        const lm = minL - cl;
        const rm = cr - maxR;
        if (lm > (cr - cl) * 0.04 && rm > (cr - cl) * 0.04 && Math.abs(lm - rm) < (cr - cl) * 0.04) [cl, cr] = [minL, maxR];
      }
      const cw = cr - cl;
      if (cw < vw * 0.5) continue;
      const inside = boxes.filter((b) => el.contains(b.el) && b.r > cl && b.l < cr);
      if (inside.length < 2) continue;
      const top = Math.min(...inside.map((b) => b.t));
      const bottom = Math.max(...inside.map((b) => b.b));
      if (bottom - top < 300 || top < vh || bottom > pageH - 200) continue;
      // A picture or panel behind the whole block fills it; a sticky column travels down beside the
      // rest, filled over its whole scroll range, and the other side scrolls past it by design.
      if (inside.some((b) => b.r - b.l >= cw * 0.9 && b.b - b.t >= (bottom - top) * 0.5)) continue;
      if (inside.some((b) => stickyOf(b.el, el))) continue;
      const zone = cw * 0.45;
      const judge = (x0: number, x1: number): { empty: number; area: number } => {
        const c = coverage(inside, x0, x1, top, bottom);
        return { empty: c.filter((v) => v < 0.02).length / Math.max(1, c.length), area: mean(c) };
      };
      const L = judge(cl, cl + zone);
      const R = judge(cr - zone, cr);
      // Empty beside full: nothing for 70% of the height, or little covered while the other side is five times fuller.
      const isEmpty = (z: { empty: number; area: number }, other: { empty: number; area: number }): boolean =>
        other.area >= 0.15 && ((z.empty >= 0.75 && other.area >= z.area * 3) || z.area < 0.05 || (z.area < 0.12 && other.area >= z.area * 5));
      let side = '';
      let z = R;
      if (isEmpty(R, L) && !isEmpty(L, R)) side = 'right';
      else if (isEmpty(L, R) && !isEmpty(R, L)) { side = 'left'; z = L; }
      if (!side) continue;
      reported.add(el);
      const h = el.querySelector('h1, h2, h3, h4') ?? el.closest('section')?.querySelector('h1, h2, h3, h4') ?? nearestHeading(top, bottom);
      const how = z.empty >= 0.75 ? 'has nothing in it for ' + Math.round(z.empty * 100) + '% of the block\'s ' + Math.round(bottom - top) + 'px height'
        : 'is only about ' + Math.round(z.area * 100) + '% covered over the block\'s ' + Math.round(bottom - top) + 'px height';
      add('lopsided-section', 'P3', el, 'In the block under the heading ' + headingText(h) + ', the ' + side + ' side ' + how +
        ', while the content keeps to the ' + (side === 'right' ? 'left' : 'right') + '. Look at it: fine when the empty side is a deliberate margin for a short column; otherwise put the picture, proof or a second column there, or let the content take the width (flow.md).');
    }
  });

  // Sections that all use one layout read as a template filled in again and again. The layout of a
  // section is the row its heading sits in: how many columns, which one holds the heading, which
  // hold a picture, and their widths (within 8 points of each other). For a heading on top, the
  // widest row of blocks under it and whether it holds a picture. Reported for three or more
  // sections in a row with one layout, or for one layout used by four or more sections that are
  // at least 40% of the page's sections. The first screen's section is left out.
  rule('repeated-layout', () => {
    if (!flowOn) return;
    interface Sig { cols: number; head: string; media: string; widths: number[]; below?: number }
    const signature = (section: Element): Sig | null => {
      const h = section.querySelector('h1, h2, h3');
      if (!h || !isVisible(h)) return null;
      const sr = section.getBoundingClientRect();
      if (sr.height < 200 || sr.top + sy < vh * 0.5) return null;
      // Climb from the heading to the first block that has a neighbour beside it.
      let item: Element = h;
      let row: Element[] = [];
      for (let n: Element = h; n !== section && n.parentElement; n = n.parentElement) {
        const nr = n.getBoundingClientRect();
        const beside = Array.from(n.parentElement.children).filter((s) => {
          if (s === n || !isVisible(s)) return false;
          const q = s.getBoundingClientRect();
          return q.top < nr.bottom - 4 && q.bottom > nr.top + 4 && (q.left >= nr.right - 4 || q.right <= nr.left + 4) && q.width > 40;
        });
        if (beside.length) {
          item = n;
          row = [n, ...beside].sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
          break;
        }
      }
      if (!row.length) {
        // Heading on top: what sits under it is the layout. The widest row of side-by-side blocks, 1 to 4 or more.
        let below = 1;
        for (const parent of all<Element>('*', section).slice(0, 400)) {
          const kids = Array.from(parent.children).filter((k) => {
            if (!isVisible(k) || k.contains(h)) return false;
            const q = k.getBoundingClientRect();
            return q.width >= 160 && q.height >= 60;
          });
          if (kids.length < 2) continue;
          const firstTop = kids[0]?.getBoundingClientRect().top ?? 0;
          const inRow = kids.filter((k) => Math.abs(k.getBoundingClientRect().top - firstTop) < 8).length;
          below = Math.max(below, Math.min(4, inRow));
        }
        const pictured = all<Element>('img, video, picture, canvas', section).some((m) => {
          const q = m.getBoundingClientRect();
          return isVisible(m) && q.width >= 160 && q.height >= 120;
        });
        // A centred heading is a different layout from one set on the left.
        const range = document.createRange();
        range.selectNodeContents(h);
        const hr = range.getBoundingClientRect();
        const [il, ir] = innerBox(layoutBox(section));
        const centred = hr.left + sx - il > (ir - il) * 0.15 && Math.abs((hr.left + hr.right) / 2 + sx - (il + ir) / 2) < (ir - il) * 0.1;
        return { cols: 1, head: centred ? 'centre' : 'top', media: pictured ? 'below' : 'none', widths: [1], below };
      }
      const total = row.reduce((s, n) => s + n.getBoundingClientRect().width, 0);
      const at = row.indexOf(item);
      const head = at === 0 ? 'left' : at === row.length - 1 ? 'right' : 'middle';
      const media = row.map((n, i) => {
        const big = all<Element>('img, video, picture, canvas, svg', n).concat([n]).some((m) => {
          if (!(isMedia(m) || hasPictureBackground(getComputedStyle(m)))) return false;
          const q = m.getBoundingClientRect();
          return q.width >= 160 && q.height >= 120;
        });
        return big ? String(i) : '';
      }).filter(Boolean).join(',') || 'none';
      return { cols: row.length, head, media, widths: row.map((n) => n.getBoundingClientRect().width / total) };
    };
    const same = (a: Sig, b: Sig): boolean => a.cols === b.cols && a.head === b.head && a.media === b.media && a.below === b.below &&
      a.widths.every((w, i) => Math.abs(w - (b.widths[i] ?? 0)) <= 0.08);
    const describeSig = (s: Sig): string => s.cols === 1 ? (s.head === 'centre' ? 'centred heading on top' : 'heading on top') + ((s.below ?? 1) > 1 ? ' over ' + (s.below === 4 ? '4 or more' : s.below) + ' blocks side by side' : ' over one column') +
      (s.media === 'none' ? ', no picture' : ', with a picture') :
      s.cols + ' columns (' + s.widths.map((w) => Math.round(w * 100) + '%').join(' / ') + '), heading ' + (s.head === 'middle' ? 'in the middle' : 'on the ' + s.head) +
      (s.media === 'none' ? ', no picture beside it' : ', picture in column ' + s.media.split(',').map((i) => Number(i) + 1).join(' and '));
    const list = flowSections().map((el) => ({ el, sig: signature(el) }));
    let i = 0;
    while (i < list.length) {
      const first = list[i];
      if (!first?.sig) { i++; continue; }
      let j = i + 1;
      while (j < list.length) {
        const next = list[j]?.sig;
        if (!next || !same(first.sig, next)) break;
        j++;
      }
      if (j - i >= 3) {
        const names = list.slice(i, j).map((x) => headingText(x.el.querySelector('h1, h2, h3'))).join(', ');
        add('repeated-layout', 'P3', first.el, (j - i) + ' sections in a row share one layout, ' + describeSig(first.sig) + ': ' + names +
          '. Look at it: fine when the page is a run of consistent ruled sections by design; otherwise vary the layout by what each section has to say (flow.md).');
        for (let k = i; k < j; k++) { const x = list[k]; if (x) x.sig = null; }
      }
      i = j;
    }
    // One layout used again and again across the page, with other sections between.
    const signed = list.filter((x): x is { el: Element; sig: Sig } => !!x.sig);
    const total = flowSections().filter((el) => el.getBoundingClientRect().top + sy >= vh * 0.5 && el.querySelector('h1, h2, h3')).length;
    const used = new Set<Element>();
    for (const x of signed) {
      if (used.has(x.el)) continue;
      const group = signed.filter((y) => !used.has(y.el) && same(x.sig, y.sig));
      if (group.length < 4 || group.length < total * 0.4) continue;
      for (const y of group) used.add(y.el);
      add('repeated-layout', 'P3', x.el, group.length + ' of the page\'s ' + total + ' sections use one layout, ' + describeSig(x.sig) + ': ' +
        group.map((y) => headingText(y.el.querySelector('h1, h2, h3'))).join(', ') + '. Look at it: fine when the page is a run of consistent ruled sections by design; otherwise vary the layout by what each section has to say (flow.md).');
    }
  });

  // ---- design: faults of finish -------------------------------------------------------------
  // A few measurable faults of finish: sizes and radii from no system, small running text, two
  // faces that look alike, a crowded first screen. None prescribes a style; each states what it
  // measured. None runs in app mode; most leave product UI alone.
  const debug = (window as unknown as { __argusCheckDebug?: boolean }).__argusCheckDebug === true;
  const dbg = (s: string): void => {
    if (debug) notes.push('debug: ' + s);
  };
  /** Text inside a product mock-up, a table or a drawn picture belongs to that thing, not the page. */
  const MOCK = '[data-mock], [role="img"], table';
  const fontPx = (el: Element): number => parseFloat(getComputedStyle(el).fontSize) || 0;
  /** The size carrying the most characters: the body size. */
  const bodySize = ((): number => {
    const bySize = new Map<number, number>();
    for (const el of textEls) {
      if (el.closest(MOCK) || inHeader(el)) continue;
      const s = Math.round(fontPx(el));
      bySize.set(s, (bySize.get(s) ?? 0) + ownText(el).length);
    }
    let body = 0;
    let most = 0;
    for (const [s, n] of bySize) if (n > most) [most, body] = [n, s];
    return body;
  })();
  /** Group sizes that differ by 8% or less (a fluid size and its neighbour are one size). */
  const clusterSizes = (sizes: number[]): number[][] => {
    const sorted = Array.from(new Set(sizes)).sort((a, b) => a - b);
    const out: number[][] = [];
    for (const s of sorted) {
      const last = out[out.length - 1];
      const prev = last?.[last.length - 1];
      if (last && prev && s / prev <= 1.08) last.push(s);
      else out.push([s]);
    }
    return out;
  };
  const sizeList = (groups: number[][]): string => groups.map((g) => (g.length > 1 ? g[0] + '-' + g[g.length - 1] : String(g[0]))).join(', ');
  /** The first family in a font-family list, unquoted and lower case. */
  const firstFamily = (stack: string): string => (stack.split(',')[0] ?? '').trim().replace(/^["']|["']$/g, '').toLowerCase();
  /** The largest text on the first screen, outside the header: its elements, size and family. */
  const display = ((): { els: HTMLElement[]; size: number; family: string; stack: string } | null => {
    let size = 0;
    for (const el of textEls) {
      if (el.closest(MOCK) || inHeader(el) || !onFirstScreen(el.getBoundingClientRect())) continue;
      size = Math.max(size, fontPx(el));
    }
    if (!size) return null;
    const els = textEls.filter((el) => !el.closest(MOCK) && !inHeader(el) && onFirstScreen(el.getBoundingClientRect()) && fontPx(el) >= size * 0.98);
    const stack = els[0] ? getComputedStyle(els[0]).fontFamily : '';
    return { els, size, family: firstFamily(stack), stack };
  })();
  // Judged at 1024px and wider, on a page that persuades: not app mode, more than a screen tall, and
  // either not product UI or led by display type (a landing page with a working form is still one).
  const design = !appMode && vw >= 1024 && pageH >= vh * 1.25 && (!isProductUI() || (!!display && display.size >= Math.max(40, bodySize * 3)));
  dbg('design ' + design + ' productUI ' + isProductUI());
  /** The family that carries the running text: the most characters in paragraphs and list items of 60 characters or more. */
  const bodyFace = ((): { family: string; stack: string; el: HTMLElement | null } => {
    const tally = new Map<string, { n: number; stack: string; el: HTMLElement }>();
    for (const el of all('p, li, dd, blockquote')) {
      if (!isVisible(el) || el.closest(MOCK) || inHeader(el)) continue;
      const t = textOf(el);
      if (t.length < 60) continue;
      const stack = getComputedStyle(el).fontFamily;
      const f = firstFamily(stack);
      const e = tally.get(f) ?? { n: 0, stack, el };
      e.n += t.length;
      tally.set(f, e);
    }
    let best: { family: string; stack: string; el: HTMLElement | null } = { family: '', stack: '', el: null };
    let most = 0;
    for (const [family, e] of tally) if (e.n > most) [most, best] = [e.n, { family, stack: e.stack, el: e.el }];
    return best;
  })();

  // Sizes that are not a small set of roles. The count of declared sizes does not separate strong
  // pages from weak ones (strong pages declare many); what does is a sprawl of mid sizes, about 28
  // to 72px at 1440, used for headings, where everything looks equally important. Sizes are rounded
  // as rendered at this width and grouped when within 8% of each other.
  rule('type-untokened-sizes', () => {
    if (!design) return;
    const k = Math.min(1.33, Math.max(0.75, vw / 1440));
    const lo = 28 * k;
    const hi = 72 * k;
    const allSizes: number[] = [];
    const headSizes: number[] = [];
    const midSizes: number[] = [];
    for (const el of textEls) {
      if (el.closest(MOCK) || inHeader(el) || ownText(el).length < 2) continue;
      const s = Math.round(fontPx(el));
      allSizes.push(s);
      if (s < lo || s > hi) continue;
      midSizes.push(s);
      if (el.closest('h1, h2, h3, h4, h5, h6, [role="heading"]')) headSizes.push(s);
    }
    const headGroups = clusterSizes(headSizes);
    const mid = clusterSizes(midSizes);
    const every = clusterSizes(allSizes);
    dbg('type-untokened-sizes heads ' + sizeList(headGroups) + ' | mid ' + sizeList(mid) + ' | all ' + every.length + ' ' + sizeList(every));
    if (headGroups.length > 2 || mid.length > 4) {
      add('type-untokened-sizes', 'P3', null, 'Headings come in ' + headGroups.length + ' mid sizes (' + (sizeList(headGroups) || 'none') + 'px) and text in ' + mid.length +
        ' sizes between ' + Math.round(lo) + ' and ' + Math.round(hi) + 'px (' + sizeList(mid) + 'px; sizes within 8% count as one) at ' + vw +
        'px, so the headings all look equally important. Set type from a few size roles (display, heading, lead, body, small) and give each heading level one of them (type.md).');
    } else if (every.length > 12) {
      add('type-untokened-sizes', 'P3', null, every.length + ' distinct text sizes are rendered at ' + vw + 'px (' + sizeList(every) +
        'px; sizes within 8% count as one, tables and mock-ups left out). Set type from a few size roles (display, heading, lead, body, small) (type.md).');
    }
  });

  // Running text set small. Persuade pages read at 17-20px; 14-15px is interface text.
  rule('type-small-body', () => {
    if (!design) return;
    let small = 0;
    let total = 0;
    let example: Element | null = null;
    const sizes = new Set<number>();
    for (const el of all('p, li, dd, blockquote')) {
      if (!isVisible(el) || el.closest(MOCK + ', footer, figcaption, form, nav, [role="contentinfo"], small') || inHeader(el)) continue;
      const t = textOf(el);
      if (t.length < 120) continue;
      const size = fontPx(el);
      // Running text: wraps to two lines or more.
      const lh = parseFloat(getComputedStyle(el).lineHeight) || size * 1.4;
      if (el.getBoundingClientRect().height < lh * 1.8) continue;
      total += t.length;
      if (size < 15.5) {
        small += t.length;
        sizes.add(Math.round(size));
        example ??= el;
      }
    }
    dbg('type-small-body ' + small + '/' + total);
    if (total >= 400 && small / total > 0.25) {
      add('type-small-body', 'P3', example, Math.round((small / total) * 100) + '% of the running text is under 16px (' + Array.from(sizes).sort().join(', ') +
        'px). Body text on a page that persuades reads at 17-20px; keep 14-15px for interface labels (type.md).');
    }
  });

  // Two faces that look alike: two sans-serifs (or two serifs) of similar proportions, one for
  // display and one for body. Judged from a small table of common web faces and from glyphs drawn
  // on a canvas (x-height and width per em); reported only when both agree they are alike.
  rule('type-twin-faces', () => {
    if (!design || !display || !bodyFace.family || display.family === bodyFace.family) return;
    const SANS = ['inter', 'geist', 'space grotesk', 'bricolage grotesque', 'figtree', 'manrope', 'plus jakarta sans', 'dm sans', 'poppins', 'roboto', 'instrument sans',
      'archivo', 'schibsted grotesk', 'host grotesk', 'hanken grotesk', 'public sans', 'switzer', 'familjen grotesk', 'funnel display', 'funnel sans', 'satoshi', 'general sans',
      'cabinet grotesk', 'league spartan', 'sora', 'red hat display', 'red hat text', 'mona sans', 'hubot sans', 'syne', 'commissioner', 'atkinson hyperlegible', 'atkinson hyperlegible next',
      'asap', 'radio canada big', 'work sans', 'outfit', 'urbanist', 'lexend', 'montserrat', 'open sans', 'lato', 'nunito sans', 'source sans 3', 'ibm plex sans', 'noto sans',
      'helvetica', 'helvetica neue', 'arial', 'libre franklin', 'karla', 'rubik', 'mulish', 'raleway', 'onest', 'geologica', 'albert sans', 'be vietnam pro', 'epilogue', 'archivo narrow'];
    const SERIF = ['fraunces', 'instrument serif', 'playfair display', 'playfair', 'newsreader', 'literata', 'source serif 4', 'petrona', 'young serif', 'gambetta', 'zodiak',
      'sentient', 'eb garamond', 'libre caslon text', 'libre caslon display', 'crimson pro', 'spectral', 'alegreya', 'bodoni moda', 'gloock', 'boska', 'dm serif display', 'dm serif text',
      'lora', 'merriweather', 'pt serif', 'libre baskerville', 'cormorant', 'cormorant garamond', 'georgia', 'times new roman', 'noto serif', 'ibm plex serif', 'source serif pro', 'besley'];
    const kind = (family: string, stack: string): string => {
      if (SANS.includes(family)) return 'sans';
      if (SERIF.includes(family)) return 'serif';
      const generic = stack.toLowerCase();
      if (/\bmonospace\b|\bmono\b/.test(generic)) return 'mono';
      if (/\bsans-serif\b|system-ui/.test(generic)) return 'sans';
      if (/\bserif\b/.test(generic)) return 'serif';
      return '';
    };
    const a = kind(display.family, display.stack);
    const b = kind(bodyFace.family, bodyFace.stack);
    if (!a || a !== b || a === 'mono') return;
    // Both faces must really be loaded, or the canvas would measure the fallback.
    const loaded = new Set<string>();
    document.fonts.forEach((f) => {
      if (f.status === 'loaded') loaded.add(f.family.replace(/^["']|["']$/g, '').toLowerCase());
    });
    if (!loaded.has(display.family) || !loaded.has(bodyFace.family)) {
      notes.push('type-twin-faces: ' + display.family + ' and ' + bodyFace.family + ' are both ' + a + ' faces, but one is not loaded, so their shapes were not compared.');
      return;
    }
    const probe = document.createElement('canvas').getContext('2d');
    if (!probe) return;
    const measure = (family: string): [number, number] => {
      probe.font = '400 100px "' + family + '"';
      const x = probe.measureText('x').actualBoundingBoxAscent;
      const h = probe.measureText('H').actualBoundingBoxAscent || 1;
      return [x / h, probe.measureText('abcdefghijklmnopqrstuvwxyz').width / 100];
    };
    const [xa, wa] = measure(display.family);
    const [xb, wb] = measure(bodyFace.family);
    const stretch = (el: Element | null): number => (el ? parseFloat(getComputedStyle(el).fontStretch) || 100 : 100);
    const stretchGap = Math.abs(stretch(display.els[0] ?? null) - stretch(bodyFace.el));
    dbg('type-twin-faces ' + display.family + ' x ' + xa.toFixed(3) + ' w ' + wa.toFixed(2) + ' / ' + bodyFace.family + ' x ' + xb.toFixed(3) + ' w ' + wb.toFixed(2) + ' stretch gap ' + stretchGap);
    const widthGap = Math.abs(wa - wb) / Math.min(wa, wb);
    if (widthGap <= 0.12 && Math.abs(xa - xb) <= 0.1 && stretchGap < 15) {
      add('type-twin-faces', 'P3', display.els[0] ?? null, 'These two faces look alike: ' + display.family + ' (display) and ' + bodyFace.family + ' (body) are both ' + a +
        ' faces with x-heights of ' + Math.round(xa * 100) + '% and ' + Math.round(xb * 100) + '% of the capital and widths within ' + Math.round(widthGap * 100) +
        '%. Use one family for both, or two faces that clearly differ (type.md).');
    }
  });

  // ---- colour, shape, depth -----------------------------------------------------------------
  // Corners from many sources: more than three radii in repeated use.
  rule('radius-sprawl', () => {
    if (!design) return;
    const uses = new Map<string, number>();
    for (const el of pool()) {
      if (el instanceof SVGElement) continue;
      const cs = getComputedStyle(el);
      const raw = cs.borderTopLeftRadius;
      if (!raw || raw === '0px') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 12 || r.height < 12 || !isVisible(el) || el.closest('[aria-hidden="true"], [data-mock]')) continue;
      const shaped = /^(IMG|VIDEO|PICTURE|CANVAS|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || rgba(cs.backgroundColor)[3] > 0.1 ||
        (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none') || cs.boxShadow !== 'none' || /url\(/.test(cs.backgroundImage);
      if (!shaped) continue;
      const px = raw.endsWith('%') ? (parseFloat(raw) / 100) * Math.min(r.width, r.height) : parseFloat(raw) || 0;
      const round = raw.endsWith('%') ? parseFloat(raw) >= 40 : px >= Math.min(r.width, r.height) / 2 - 1;
      const key = round ? 'round' : Math.round(px) + 'px';
      uses.set(key, (uses.get(key) ?? 0) + 1);
    }
    // A radius used once is often a one-off detail; the language is what repeats.
    const repeated = Array.from(uses).filter(([k, n]) => k !== 'round' && n >= 2).map(([k]) => k);
    dbg('radius-sprawl ' + Array.from(uses).map(([k, n]) => k + 'x' + n).join(' '));
    if (repeated.length > 3) {
      add('radius-sprawl', 'P3', null, repeated.length + ' different corner radii are in repeated use (' + repeated.sort((a, b) => parseFloat(a) - parseFloat(b)).join(', ') +
        ', with pills and circles counted apart). Pick at most three radius tokens and use them everywhere (colour.md).');
    }
  });

  // ---- the finishing pass (finish.md) ---------------------------------------------------------
  // Cheap prompts for what a last pass catches. Each reports once a page, naming the first case.
  const NOT_COPY = 'code, pre, kbd, samp, var, script, style, input, textarea, select, [contenteditable="true"], [data-mock], [role="img"]';

  // Left-over working text: TODO, TBD, a bracketed placeholder, an example.com address or link.
  rule('leftover-text', () => {
    const hits: Element[] = [];
    for (const el of textEls) {
      if (el.closest(NOT_COPY)) continue;
      const t = ownText(el);
      if (/\bTODO\b|\bTBD\b/.test(t) || /\[\s*placeholder\s*\]|\bexample\.com\b/i.test(t)) hits.push(el);
    }
    for (const a of all<HTMLAnchorElement>('a[href*="example.com"]')) if (isVisible(a) && !hits.includes(a)) hits.push(a);
    if (hits.length) add('leftover-text', 'P3', hits[0]!, hits.length + ' place(s) still show working text (TODO, TBD, [placeholder] or example.com). Replace each, or mark a needed stand-in in a code comment and list it in the report (finish.md, 1).');
  });

  // Typewriter marks in running copy: straight double quotes, a spaced hyphen or a double hyphen for a dash.
  rule('straight-quotes', () => {
    let first: Element | null = null;
    let n = 0;
    const kinds = new Set<string>();
    for (const el of textEls) {
      if (el.closest(NOT_COPY)) continue;
      const t = ownText(el);
      if (t.length < 3) continue;
      const found: string[] = [];
      if (/"/.test(t)) found.push('straight quotes');
      if (/\s-\s|\S--\S|\s--\s/.test(t)) found.push('a hyphen for a dash');
      if (!found.length) continue;
      found.forEach((k) => kinds.add(k));
      first ??= el;
      n++;
    }
    if (first) add('straight-quotes', 'P3', first, n + ' text element(s) use ' + Array.from(kinds).join(' and ') + '. Use curly quotes (“ ” ‘ ’) and an en or em dash (– —) in visible copy (finish.md, 5).');
  });

  // Prices set on their own (a price tag, a plan's figure) in proportional figures, so digits do not line up.
  rule('price-figures', () => {
    const price = /^(from\s+)?[-+−]?[$€£¥₹]\s?\d[\d,.]*(\s?[kKmM])?(\s*\/\s*\w+)?$|^\d[\d,.]*\s?(€|£|kr|zł|CHF)$/i;
    const tabularByDefault = (cs: CSSStyleDeclaration): boolean => {
      if (!ctx) return false;
      ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      return Math.abs(ctx.measureText('1111').width - ctx.measureText('0000').width) < 0.5;
    };
    const loose: Element[] = [];
    for (const el of textEls) {
      if (el.closest('table, ' + NOT_COPY)) continue;
      const t = textOf(el).replace(/\s+/g, ' ');
      if (t.length > 18 || !price.test(t)) continue;
      const cs = getComputedStyle(el);
      if (/tabular-nums/.test(cs.fontVariantNumeric) || /tnum/.test(cs.fontFeatureSettings) || /mono|courier|consolas|menlo|monaco/i.test(cs.fontFamily) || tabularByDefault(cs)) continue;
      loose.push(el);
    }
    if (loose.length) add('price-figures', 'P3', loose[0]!, loose.length + ' price(s) are set in proportional figures; give prices font-variant-numeric: tabular-nums so the digits line up and do not shift when they change (finish.md, 5). A font: shorthand resets it to normal, so set it after any font: rule that reaches the price.');
  });

  // A heading whose last line is one short word, at desktop width.
  rule('heading-widow', () => {
    if (appMode || vw < 1280) return;
    const widows: Element[] = [];
    for (const h of all('h1, h2, h3')) {
      if (!isVisible(h) || h.closest('[data-mock], [role="img"]')) continue;
      const words: Range[] = [];
      const walk = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const node = walk.currentNode as Text;
        for (const m of (node.nodeValue ?? '').matchAll(/\S+/g)) {
          const r = document.createRange();
          r.setStart(node, m.index!);
          r.setEnd(node, m.index! + m[0].length);
          words.push(r);
        }
      }
      if (words.length < 4) continue;
      const last = words[words.length - 1]!;
      const before = words[words.length - 2]!;
      const lr = last.getBoundingClientRect();
      const br = before.getBoundingClientRect();
      if (!lr.height || !br.height) continue;
      // The last word sits on a line below the word before it, and is short. (Glyph boxes overlap in tight leading, so compare tops.)
      if (lr.top - br.top > br.height / 2 && last.toString().replace(/[^\p{L}\p{N}]/gu, '').length <= 6) widows.push(h);
    }
    if (widows.length) add('heading-widow', 'P3', widows[0]!, widows.length + ' heading(s) end on a line holding one short word. Set text-wrap: balance on headings, or rewrite the line (finish.md, 6).');
  });

  // Timed motion on the browser's default curves: a bare ease, or linear on something that is not a loop or tied to scroll.
  rule('bare-easing', () => {
    const bare: Element[] = [];
    const split = (v: string): string[] => v.split(/,(?![^(]*\))/).map((x) => x.trim());
    for (const el of pool()) {
      const cs = getComputedStyle(el);
      let hit = false;
      const durs = split(cs.transitionDuration);
      if (cs.transitionProperty !== 'none' && durs.some((d) => parseFloat(d) > 0)) {
        const fns = split(cs.transitionTimingFunction);
        hit = durs.some((d, i) => parseFloat(d) > 0 && /^(ease|linear)$/.test(fns[i % fns.length] ?? ''));
      }
      if (!hit && cs.animationName && cs.animationName !== 'none') {
        const names = split(cs.animationName);
        const adur = split(cs.animationDuration);
        const fns = split(cs.animationTimingFunction);
        const counts = split(cs.animationIterationCount);
        const timelines = split((cs as unknown as Record<string, string>).animationTimeline ?? 'auto');
        hit = names.some((nm, i) => {
          if (nm === 'none' || !(parseFloat(adur[i % adur.length] ?? '0') > 0)) return false;
          if ((timelines[i % timelines.length] ?? 'auto') !== 'auto') return false; // tied to scroll: linear is right
          const fn = fns[i % fns.length] ?? '';
          if (fn === 'ease') return true;
          return fn === 'linear' && (counts[i % counts.length] ?? '1') !== 'infinite'; // a steady loop (marquee, spinner) may be linear
        });
      }
      if (hit) bare.push(el);
    }
    if (bare.length) add('bare-easing', 'P3', bare[0]!, bare.length + ' element(s) animate on the default ease or linear curve. Give timed motion a named easing token (one curve to arrive, one to move); linear only for scroll-scrubbed motion or a steady loop (finish.md, 8; motion.md, M14).');
  });

  // Borders from many sources: more than three border widths in repeated use.
  rule('border-sprawl', () => {
    if (!design) return;
    const uses = new Map<string, number>();
    for (const el of pool()) {
      if (el instanceof SVGElement || el.closest('[aria-hidden="true"], [data-mock]')) continue;
      const cs = getComputedStyle(el);
      const widths = new Set<string>();
      for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
        const w = parseFloat((cs as unknown as Record<string, string>)['border' + side + 'Width'] ?? '0');
        const st = (cs as unknown as Record<string, string>)['border' + side + 'Style'];
        if (w > 0 && st !== 'none' && st !== 'hidden') widths.add(Math.round(w * 2) / 2 + 'px');
      }
      if (!widths.size || !isVisible(el)) continue;
      for (const w of widths) uses.set(w, (uses.get(w) ?? 0) + 1);
    }
    const repeated = Array.from(uses).filter(([, n]) => n >= 2).map(([k]) => k);
    if (repeated.length > 3) {
      add('border-sprawl', 'P3', null, repeated.length + ' different border widths are in repeated use (' + repeated.sort((a, b) => parseFloat(a) - parseFloat(b)).join(', ') +
        '). Rules, borders and drawn strokes read as one hand at one or two weights (finish.md, 10).');
    }
  });

  // ---- hero and layout ---------------------------------------------------------------------
  // Too many separate things on the first screen.
  rule('hero-crowded', () => {
    if (vw < 1280 || !design) return;
    const atoms: DOMRect[] = [];
    const blocks = new Set<Element>();
    // A booking or order form, or the one card or device holding it, is one group however many
    // fields and labels it has: its parts are counted as the whole. So is a list, timeline or board. A card is a box of its own
    // (a fill, a border or a shadow) under 40% of the screen that holds a field.
    const units = new Map<Element, Element | null>();
    const ownBox = (cs: CSSStyleDeclaration): boolean =>
      !/^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor) || cs.boxShadow !== 'none' ||
      ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs.getPropertyValue('border-' + s.toLowerCase() + '-width')) > 0 && cs.getPropertyValue('border-' + s.toLowerCase() + '-style') !== 'none');
    // A list, timeline, table or board (three or more like items) is one group too, however many stops it has.
    const listOf = (el: Element): Element | null => {
      for (let n: Element | null = el, depth = 0; n && n !== document.body && depth < 6; depth++, n = n.parentElement) {
        if (inHeader(n)) return null;
        const kids = Array.from(n.children).filter((k) => isVisible(k));
        if (kids.length < 3) continue;
        const r = n.getBoundingClientRect();
        if (r.width * r.height >= vw * vh * 0.5) return null;
        if (n.matches('ol, ul, dl, table, [role="list"], [role="table"]')) return n;
        const sig = (k: Element): string => k.tagName + '.' + (typeof k.className === 'string' ? k.className.trim().split(/\s+/)[0] : '');
        const first = sig(kids[0]!);
        if (kids.filter((k) => sig(k) === first).length >= Math.max(3, kids.length * 0.75)) return n;
      }
      return null;
    };
    const unitOf = (el: Element): Element | null => {
      if (units.has(el)) return units.get(el) ?? null;
      const form = el.closest('form, [role="form"]') ?? el.closest('fieldset');
      let unit: Element | null = form && !inHeader(form) ? form : listOf(el);
      let n: Element | null = unit ?? el;
      for (let depth = 0; n && n !== document.body && depth < 8; depth++, n = n.parentElement) {
        const r = n.getBoundingClientRect();
        if (r.width * r.height >= vw * vh * 0.4) break;
        if (n.querySelector('input:not([type="hidden"]), select, textarea') && ownBox(getComputedStyle(n))) {
          unit = n;
          break;
        }
      }
      units.set(el, unit);
      return unit;
    };
    const counted = new Set<Element>();
    const count = (el: Element, r: DOMRect): void => {
      const unit = unitOf(el);
      if (!unit) {
        atoms.push(r);
        return;
      }
      if (counted.has(unit)) return;
      counted.add(unit);
      atoms.push(unit.getBoundingClientRect());
    };
    for (const el of textEls) {
      if (inHeader(el) || el.closest('[aria-hidden="true"]')) continue;
      let block: HTMLElement | null = el;
      while (block && block !== document.body && getComputedStyle(block).display.startsWith('inline')) block = block.parentElement;
      if (!block || blocks.has(block)) continue;
      blocks.add(block);
      const r = block.getBoundingClientRect();
      if (r.top < vh && r.bottom > 0 && r.width > 0) count(block, r);
    }
    for (const el of all<Element>('img, video, canvas, svg, input:not([type="hidden"]), select, textarea, button')) {
      if (el.parentElement?.closest('svg') || inHeader(el) || el.closest('[aria-hidden="true"]') || !isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.top >= vh || r.bottom <= 0 || (el.tagName === 'svg' && (r.width < 48 || r.height < 48))) continue;
      count(el, r);
    }
    // Things within 14px of each other (a row of chips, a label and its value) are one group.
    const GAP = 14;
    const parent = atoms.map((_, i) => i);
    const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i] ?? i)));
    const near = (a: DOMRect, b: DOMRect): boolean =>
      a.left - GAP < b.right && b.left - GAP < a.right && a.top - GAP < b.bottom && b.top - GAP < a.bottom &&
      // a picture behind text does not swallow the text: only touching edges join
      !(a.width * a.height > vw * vh * 0.1 || b.width * b.height > vw * vh * 0.1);
    for (let i = 0; i < atoms.length; i++) {
      for (let j = i + 1; j < atoms.length; j++) {
        const a = atoms[i];
        const b = atoms[j];
        if (a && b && near(a, b)) parent[find(i)] = find(j);
      }
    }
    const groups = new Set(atoms.map((_, i) => find(i))).size;
    dbg('hero-crowded groups ' + groups);
    if (groups > 7) {
      add('hero-crowded', 'P3', null, 'The first screen at ' + vw + 'px holds about ' + groups + ' separate groups of content (text blocks, pictures and controls more than 14px apart; a form or the card holding it, and a list, timeline or board, count once). ' +
        'Keep what a stranger needs in five seconds: what it is, one line, the action, one proof, the picture. Move the rest below (first-screen.md).');
    }
  });

  // Many words on the first screen: a statement, a line and the action read in seconds; paragraphs
  // there are read by few. Counts the words of visible text in the first viewport. Left out: the
  // header, anything hidden from assistive technology, text inside SVG drawings, charts and mock-ups
  // (role="img", data-mock), and a list, table or board that covers a fifth of the screen, which is
  // the hero itself. A form's labels count.
  rule('hero-wordy', () => {
    if (vw < 1280 || !design) return;
    const HERO_WORDS = 110;
    let words = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? '').trim();
      const el = node.parentElement;
      if (!text || !el || el.closest('script, style, noscript, template, svg, canvas, [aria-hidden="true"], [role="img"], [data-mock]') || inHeader(el) || !isVisible(el)) continue;
      // A ruled list, table or board that is itself the hero (an offer as a price list, a departures
      // board) is the first screen's picture, not paragraphs to cut: its words are not counted.
      const board = el.closest('table, ul, ol, dl, [role="table"], [role="list"]');
      if (board) {
        const b = board.getBoundingClientRect();
        if (b.width * Math.min(b.bottom, vh) - b.width * Math.max(b.top, 0) >= vw * vh * 0.2) continue;
      }
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width === 0 || r.top >= vh || r.bottom <= 0) continue;
      words += text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
    }
    dbg('hero-wordy words ' + words);
    if (words > HERO_WORDS) {
      add('hero-wordy', 'P3', null, 'The first screen at ' + vw + 'px carries about ' + words + ' words outside the header. A statement, one line under it and the action are read in seconds; ' +
        'move the rest to the panels below, a ruled table or a disclosure, keeping every must-have (composure.md, "Few words"). Fine to keep where the page is for reading.');
    }
  });

  // ---- covered content ---------------------------------------------------------------------
  // Something laid over the first screen's form, price or text: a band that moves, a positioned
  // badge, a sticky panel. Found by geometry, then confirmed by hit-testing the middle of the
  // overlap (the covering element is made hit-testable for that moment only, then restored), so a
  // picture painted under the text, or text set on a picture, is not reported. A moving band that
  // carries words collides whichever is on top: it may not run under a form or text either.
  rule('covered-content', () => {
    if (appMode) return;
    const PRICE = /[£$€¥]\s?\d|\d\s?(€|kr|zł)/;
    const targets: Array<{ el: Element; what: string }> = [];
    for (const el of all<Element>('input:not([type="hidden"]), select, textarea, button')) {
      if (isVisible(el) && onFirstScreen(el.getBoundingClientRect())) targets.push({ el, what: describe(el) });
    }
    for (const el of textEls) {
      if (!onFirstScreen(el.getBoundingClientRect()) || inHeader(el)) continue;
      const own = ownText(el);
      if (PRICE.test(own) && own.length <= 40) targets.push({ el, what: "'" + own + "'" });
      else if (el.matches('p, li, label, dd, blockquote') && textOf(el).length >= 20) targets.push({ el, what: describe(el) });
      if (targets.length > 300) break;
    }
    if (!targets.length) return;
    const runningForever = new Set<Element>();
    for (const a of document.getAnimations()) {
      const t = (a.effect as KeyframeEffect | null)?.target;
      if (t && a.playState === 'running' && a.effect?.getTiming().iterations === Infinity) runningForever.add(t);
    }
    const covers: Array<{ el: Element; moving: boolean; r: DOMRect }> = [];
    for (const el of all<Element>('body *')) {
      if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) continue;
      const cs = getComputedStyle(el);
      const moving = runningForever.has(el);
      const placed = cs.position === 'absolute' || cs.position === 'fixed' || cs.position === 'sticky';
      if (!moving && !placed) continue;
      if (cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05 || !isVisible(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8 || !onFirstScreen(r)) continue;
      // A full-width bar held to the top or bottom edge is a header or an action bar (fixed-cover's to judge).
      if ((cs.position === 'fixed' || cs.position === 'sticky') && r.width >= vw * 0.9 && (r.top <= 1 || r.bottom >= vh - 1)) continue;
      covers.push({ el, moving: moving && textOf(el).length >= 3, r });
    }
    // Moving bands first, so the band is named rather than what sits on it.
    covers.sort((a, b) => Number(b.moving) - Number(a.moving));
    const found: string[] = [];
    let first: Element | null = null;
    const seen = new Set<Element>();
    for (const t of targets) {
      if (found.length >= 3) break;
      const q = t.el.getBoundingClientRect();
      for (const c of covers) {
        if (c.el.contains(t.el) || t.el.contains(c.el) || seen.has(t.el)) continue;
        const l = Math.max(q.left, c.r.left, 0);
        const rr = Math.min(q.right, c.r.right, vw);
        const top = Math.max(q.top, c.r.top, 0);
        const b = Math.min(q.bottom, c.r.bottom, vh);
        const area = (rr - l) * (b - top);
        // A shared edge of a pixel or two is not a cover: the overlap must be at least 4px each way.
        if (rr - l < 4 || b - top < 4 || (area < q.width * q.height * 0.1 && area < 200)) continue;
        if (c.moving) {
          seen.add(t.el);
          first ??= c.el;
          found.push(describe(c.el).replace(/ ".*$/, '') + ' (a moving band) crosses ' + t.what);
          break;
        }
        const he = c.el as HTMLElement;
        const before = he.style.getPropertyValue('pointer-events');
        const prio = he.style.getPropertyPriority('pointer-events');
        let hit: Element | null = null;
        try {
          he.style.setProperty('pointer-events', 'auto', 'important');
          hit = document.elementFromPoint((l + rr) / 2, (top + b) / 2);
        } finally {
          if (before) he.style.setProperty('pointer-events', before, prio);
          else he.style.removeProperty('pointer-events');
          if (he.getAttribute('style') === '') he.removeAttribute('style');
        }
        if (!hit || !c.el.contains(hit) || t.el.contains(hit)) continue;
        seen.add(t.el);
        first ??= c.el;
        found.push(describe(c.el).replace(/ ".*$/, '') + ' (positioned) covers ' + t.what);
        break;
      }
    }
    if (found.length) {
      add('covered-content', 'P1', first, found.join('; ') + '. Nothing may cover, cut across or collide with a form, a price or text on the first screen: move it, or end it before the content (first-screen.md).');
    }
  });

  // ---- text colliding with text or a drawn line ----------------------------------------------
  // Two pieces of visible text whose lines overlap (more than half a line high), or text laid over the
  // stroke of a drawing, on the first screen. Text is measured line by line (Range rectangles),
  // clipped by any ancestor that hides overflow, and left out when it is nearly transparent, a moving
  // band (covered-content's case) or hidden from view. A drawn line counts when it is solid and at
  // least 1.5px wide on screen and is not part of the text's own block (an underline or highlight
  // drawn for that text); it is tested on its real outline (isPointInStroke) at a dozen points inside
  // each line of text, so a line that only passes near the text is not reported.
  rule('text-collision', () => {
    if (appMode) return;
    type Box = { l: number; t: number; r: number; b: number };
    interface Line extends Box { node: Text; el: Element; svg: boolean }
    const clipMemo = new Map<Element, Box>();
    const clipOf = (el: Element): Box => {
      const hit = clipMemo.get(el);
      if (hit) return hit;
      let box: Box = { l: -Infinity, t: -Infinity, r: Infinity, b: Infinity };
      const parent = el.parentElement;
      if (parent && parent !== document.documentElement) box = { ...clipOf(parent) };
      const cs = getComputedStyle(el);
      if (!(el instanceof SVGElement && el.ownerSVGElement) && (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') && el !== document.body) {
        const r = el.getBoundingClientRect();
        box = { l: Math.max(box.l, r.left), t: Math.max(box.t, r.top), r: Math.min(box.r, r.right), b: Math.min(box.b, r.bottom) };
      }
      clipMemo.set(el, box);
      return box;
    };
    const opacityOf = (el: Element): number => {
      let o = 1;
      for (let n: Element | null = el; n && o > 0.01; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity) || 0;
      return o;
    };
    const moving = new Set<Element>();
    for (const a of document.getAnimations()) {
      const t = (a.effect as KeyframeEffect | null)?.target;
      if (t && a.playState === 'running' && a.effect?.getTiming().iterations === Infinity) moving.add(t);
    }
    const blockOf = (el: Element): Element => {
      let n: Element | null = el;
      while (n && n.parentElement && (n instanceof SVGElement || getComputedStyle(n).display.startsWith('inline') || getComputedStyle(n).display === 'contents')) n = n.parentElement;
      return n ?? el;
    };
    const lines: Line[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const range = document.createRange();
    for (let node = walker.nextNode() as Text | null; node && lines.length < 800; node = walker.nextNode() as Text | null) {
      const text = node.nodeValue ?? '';
      if (!/[\p{L}\p{N}]/u.test(text)) continue;
      const el = node.parentElement;
      if (!el || el.closest('script, style, noscript, template, select, option, textarea, [data-mock], [role="img"]')) continue;
      if (!isVisible(el) || isScreenReaderOnly(el) || [...moving].some((m) => m.contains(el))) continue;
      const cs = getComputedStyle(el);
      const ink = el instanceof SVGElement ? rgba(cs.fill) : rgba(cs.color);
      if ((ink[3] ?? 0) * opacityOf(el) < 0.35 && !(parseFloat(cs.getPropertyValue('-webkit-text-stroke-width')) > 0)) continue;
      const clip = clipOf(el);
      range.selectNodeContents(node);
      for (const q of Array.from(range.getClientRects())) {
        const box = { l: Math.max(q.left, clip.l), t: Math.max(q.top, clip.t), r: Math.min(q.right, clip.r), b: Math.min(q.bottom, clip.b) };
        if (box.r - box.l < 4 || box.b - box.t < 4 || box.b <= 0 || box.t >= vh || box.r <= 0 || box.l >= vw) continue;
        lines.push({ ...box, node, el, svg: !!(el instanceof SVGElement) });
      }
    }
    const found: string[] = [];
    let first: Element | null = null;
    const pairs = new Set<string>();
    const say = (a: Element, what: string): void => {
      first ??= a;
      if (found.length < 3) found.push(what);
    };
    const name = (el: Element): string => describe(el).replace(/^(\w+)[^ ]* /, '$1 ');
    // Text over text.
    for (let i = 0; i < lines.length; i++) {
      const a = lines[i]!;
      for (let j = i + 1; j < lines.length; j++) {
        const b = lines[j]!;
        if (a.node === b.node) continue;
        const w = Math.min(a.r, b.r) - Math.max(a.l, b.l);
        const h = Math.min(a.b, b.b) - Math.max(a.t, b.t);
        if (w < 6 || h < 0.5 * Math.min(a.b - a.t, b.b - b.t)) continue;
        const ea = blockOf(a.el), eb = blockOf(b.el);
        const key = [ea, eb].map((e) => describe(e)).sort().join('|');
        if (pairs.has(key)) continue;
        pairs.add(key);
        say(a.el, name(ea) + ' runs into ' + name(eb));
      }
    }
    // Text over a drawn line.
    const strokes: SVGGeometryElement[] = [];
    for (const g of all<SVGGeometryElement>('svg path, svg line, svg polyline, svg polygon, svg circle, svg ellipse, svg rect')) {
      if (strokes.length >= 300) break;
      const cs = getComputedStyle(g);
      if (cs.stroke === 'none' || cs.visibility === 'hidden' || cs.display === 'none' || typeof g.isPointInStroke !== 'function') continue;
      const r = g.getBoundingClientRect();
      if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
      const m = g.getScreenCTM();
      const scale = m ? Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)) : 1;
      if ((parseFloat(cs.strokeWidth) || 0) * scale < 1.5) continue;
      if ((rgba(cs.stroke)[3] ?? 0) * (parseFloat(cs.strokeOpacity) || 0) * opacityOf(g) < 0.4) continue;
      // A line drawn in dashes, or still being drawn, shows only part of its outline: skip it unless fully drawn.
      if (cs.strokeDasharray && cs.strokeDasharray !== 'none') {
        const len = g.hasAttribute('pathLength') ? parseFloat(g.getAttribute('pathLength') ?? '0') : (typeof g.getTotalLength === 'function' ? g.getTotalLength() : 0);
        const dash = parseFloat(cs.strokeDasharray.split(/[ ,]+/)[0] ?? '0');
        if (!(Math.abs(parseFloat(cs.strokeDashoffset) || 0) < 0.01 * Math.max(1, len) && dash >= len * 0.99)) continue;
      }
      strokes.push(g);
    }
    if (strokes.length) {
      for (const ln of lines) {
        if (found.length >= 3) break;
        const own = blockOf(ln.el);
        const group = ln.svg ? ln.el.closest('a, g') : null;
        for (const g of strokes) {
          if (own.contains(g) || (group && group.contains(g)) || ln.el.contains(g)) continue;
          const r = g.getBoundingClientRect();
          if (r.right < ln.l || r.left > ln.r || r.bottom < ln.t || r.top > ln.b) continue;
          const m = g.getScreenCTM();
          if (!m) continue;
          const inv = m.inverse();
          let hits = 0;
          for (let yi = 0; yi < 2; yi++) {
            for (let xi = 0; xi < 6; xi++) {
              const x = ln.l + (ln.r - ln.l) * (0.08 + 0.84 * (xi / 5));
              const y = ln.t + (ln.b - ln.t) * (0.3 + 0.4 * yi);
              const p = new DOMPoint(x, y).matrixTransform(inv);
              if (g.isPointInStroke(p)) hits++;
            }
          }
          if (hits < (ln.svg ? 3 : 2)) continue;
          const key = describe(own) + '|' + describe(g.ownerSVGElement ?? g);
          if (pairs.has(key)) continue;
          pairs.add(key);
          say(ln.el, name(own) + ' sits on a drawn line (' + describe(g).split(' ')[0] + ' in ' + describe(g.ownerSVGElement ?? g).split(' ')[0] + ')');
          break;
        }
      }
    }
    if (found.length) {
      add('text-collision', 'P1', first, 'On the first screen at ' + vw + 'px: ' + found.join('; ') + '. Text may not run into other text or a drawn line: recompose this width (move, resize or stack), never shrink the text to fit (first-screen.md).');
    }
  });

  // ---- a canvas over a picture that draws nothing ------------------------------------------------
  // shot.js --check scrolls to each picture with a canvas laid over it (a WebGL layer redrawing it) and
  // reports the ones that capture as one flat colour there: an empty box where the picture should be.
  rule('blank-canvas', () => {
    const blank = options.blankCanvases ?? [];
    if (!blank.length) return;
    const canvases = all<HTMLCanvasElement>('canvas');
    add('blank-canvas', 'P1', canvases[blank[0]![0]] ?? null, blank.length + ' picture(s) under a canvas show one flat colour where the picture should be (' + blank.map((b) => b[1]).join(', ') +
      '). Keep the <img> visible until the canvas has drawn it, and show it again on any doubt (showpiece.md, 6).');
  });

  // ---- tables ---------------------------------------------------------------------------
  rule('table-headers', () => {
    for (const table of all<HTMLTableElement>('table')) {
      if (!isVisible(table) || /^(presentation|none)$/.test(table.getAttribute('role') ?? '')) continue;
      const rows = Array.from(table.rows);
      const cols = Math.max(0, ...rows.map((r) => r.cells.length));
      if (rows.length <= 2 || cols <= 2) continue;
      if (table.querySelector('th, [role="columnheader"], [role="rowheader"]')) continue;
      add('table-headers', 'P2', table, 'Data table with ' + rows.length + ' rows and ' + cols + ' columns has no header cells (th); screen readers cannot say which column a value is in.');
    }
  });

  rule('table-numbers', () => {
    const numeric = /^[-+−]?[$€£¥]?\s?[-+−]?\(?\d[\d,.\s]*\)?\s?(%|[kKmMbB]|bn|x)?$/;
    const tabularByDefault = (cs: CSSStyleDeclaration): boolean => {
      if (!ctx) return false;
      ctx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      return Math.abs(ctx.measureText('1111').width - ctx.measureText('0000').width) < 0.5;
    };
    for (const table of all<HTMLTableElement>('table')) {
      if (!isVisible(table)) continue;
      let rows = Array.from(table.tBodies).flatMap((b) => Array.from(b.rows));
      if (!rows.length) rows = Array.from(table.rows).filter((r) => !r.closest('thead') && !!r.querySelector('td'));
      rows = rows.filter((r) => Array.from(r.cells).every((c) => c.colSpan === 1));
      const cols = Math.min(30, Math.max(0, ...rows.map((r) => r.cells.length)));
      for (let c = 0; c < cols; c++) {
        const cells = rows.map((r) => r.cells[c]).filter((cell): cell is HTMLTableCellElement => !!cell && cell.tagName === 'TD');
        const filledCells = cells.filter((cell) => textOf(cell));
        const nums = filledCells.filter((cell) => numeric.test(textOf(cell)));
        const first = nums[0];
        if (!first || nums.length < 3 || nums.length < filledCells.length * 0.8) continue;
        const cs = getComputedStyle(first);
        const align = cs.textAlign;
        const kid = first.firstElementChild;
        const kidCs = kid ? getComputedStyle(kid) : null;
        const right =
          align === 'right' ||
          (align === 'end' && cs.direction === 'ltr') ||
          ((align === 'start' || align === 'left') && cs.direction === 'rtl') ||
          (!!kidCs && (kidCs.textAlign === 'right' || /end|right/.test(kidCs.justifyContent)));
        const tabular = /tabular-nums/.test(cs.fontVariantNumeric) || /tnum/.test(cs.fontFeatureSettings) ||
          /mono|courier|consolas|menlo|monaco/i.test(cs.fontFamily) || tabularByDefault(cs);
        const problems: string[] = [];
        if (!right) problems.push('not right-aligned');
        if (!tabular) problems.push('not in tabular figures');
        if (problems.length) {
          add('table-numbers', 'P3', first, 'Column ' + (c + 1) + ' holds numbers that are ' + problems.join(' and ') + '; right-align numbers and use tabular figures so digits line up.');
        }
      }
    }
  });

  // ---- focus: run last, because it moves focus and scrolls ----------------------------
  rule('focus-removed', () => {
    const selector = 'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';
    const targets = all(selector)
      .filter((el) => !el.hasAttribute('onfocus') && !el.hasAttribute('onfocusin') && isVisible(el) && !isScreenReaderOnly(el))
      .slice(0, 40);
    if (!targets.length) return;
    const before = document.activeElement;
    const sx = window.scrollX;
    const sy = window.scrollY;
    // Remember every scrolled container around a target, so any that move can be put back.
    const scrollers = new Map<Element, [number, number]>();
    for (const el of targets) {
      for (let n = el.parentElement; n && n !== document.documentElement; n = n.parentElement) {
        if (!scrollers.has(n) && (n.scrollHeight > n.clientHeight || n.scrollWidth > n.clientWidth)) scrollers.set(n, [n.scrollLeft, n.scrollTop]);
      }
    }
    const look = (el: Element | null): string => {
      if (!el) return '';
      const cs = getComputedStyle(el);
      const parts = [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.boxShadow, cs.borderTopColor, cs.borderBottomColor, cs.borderLeftColor,
        cs.borderTopWidth, cs.borderBottomWidth, cs.backgroundColor, cs.backgroundImage, cs.color, cs.textDecorationLine];
      for (const p of ['::before', '::after']) {
        const ps = getComputedStyle(el, p);
        parts.push(ps.content, ps.opacity, ps.backgroundColor, ps.transform, ps.boxShadow, ps.borderBottomColor);
      }
      return parts.join('|');
    };
    // A focus style may be drawn inside the control: an SVG link whose shape changes stroke or fill,
    // a card whose arrow moves. The first few descendants are compared too.
    const kidsOf = (el: Element): Element[] => Array.from(el.querySelectorAll('*')).slice(0, 8);
    const lookInside = (el: Element): string => kidsOf(el).map((k) => {
      const cs = getComputedStyle(k);
      return [cs.outlineStyle, cs.outlineColor, cs.stroke, cs.strokeWidth, cs.fill, cs.opacity, cs.transform, cs.color, cs.backgroundColor, cs.textDecorationLine, cs.visibility].join('|');
    }).join('~');
    let measured = 0;
    try {
      for (const el of targets) {
        // Turn transitions off for a moment, so the focused style can be read at once.
        const frozen: Array<[HTMLElement, string | null]> = [];
        // In app mode a focus ring may be drawn on a row or card around the control, up to two levels up.
        const grand = appMode ? el.parentElement?.parentElement ?? null : null;
        for (const n of [...(appMode ? [el, el.parentElement, grand] : [el, el.parentElement]), ...kidsOf(el)]) {
          if (!(n instanceof HTMLElement || n instanceof SVGElement)) continue;
          frozen.push([n as HTMLElement, n.getAttribute('style')]);
          (n as HTMLElement).style.setProperty('transition', 'none', 'important');
        }
        try {
          const off = look(el) + '#' + look(el.parentElement) + (grand ? '#' + look(grand) : '') + '#' + lookInside(el);
          // Only controls already on screen are tested for being hidden; nothing is scrolled into view,
          // except in app mode: each control is first scrolled to the middle of its scroll area, as a person would
          // scroll to it, so a row that merely passes under a tab bar is not reported but one that can
          // never come out from under a fixed layer still is. Scroll positions are restored below.
          if (appMode) el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' as ScrollBehavior });
          const r = el.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          const inView = cx > 0 && cy > 0 && cx < window.innerWidth && cy < window.innerHeight;
          el.focus({ focusVisible: true, preventScroll: true } as FocusOptions);
          // Only judge focus the browser shows as keyboard focus; otherwise a :focus-visible style would not apply.
          if (document.activeElement !== el || !el.matches(':focus-visible')) continue;
          measured++;
          const on = look(el) + '#' + look(el.parentElement) + (grand ? '#' + look(grand) : '') + '#' + lookInside(el);
          if (on === off) {
            add('focus-removed', 'P1', el, 'Nothing visible changes when this control takes keyboard focus (outline, shadow, border and background stay the same).');
          }
          if (inView) {
            const hit = document.elementFromPoint(cx, cy);
            if (hit && hit !== el && !el.contains(hit) && !hit.contains(el)) {
              let cover: Element | null = hit;
              while (cover && !['fixed', 'sticky'].includes(getComputedStyle(cover).position)) cover = cover.parentElement;
              if (cover && !cover.contains(el)) add('focus-obscured', 'P2', el, 'When focused, this control is hidden behind ' + describe(cover) + ', which is fixed or sticky.');
            }
          }
        } finally {
          el.blur();
          getComputedStyle(el).outlineStyle; // settle the unfocused style before transitions return
          for (const [n, style] of frozen) {
            if (style === null) n.removeAttribute('style');
            else n.setAttribute('style', style);
          }
        }
      }
    } finally {
      // Put the page back as it was: focus, the window's scroll, and every container that moved.
      if (before instanceof HTMLElement && before !== document.body) before.focus({ preventScroll: true });
      else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      for (const [n, [left, top]] of scrollers) {
        if (n.scrollLeft !== left || n.scrollTop !== top) {
          n.scrollLeft = left;
          n.scrollTop = top;
        }
      }
      if (window.scrollX !== sx || window.scrollY !== sy) window.scrollTo(sx, sy);
    }
    if (!measured) notes.push('Keyboard focus could not be shown in this page, so focus visibility was not checked.');
  });

  // ---- result ---------------------------------------------------------------
  let dropped = 0;
  for (const n of Object.values(counts)) if (n > MAX_PER_RULE) dropped += n - MAX_PER_RULE;
  if (dropped) notes.push(dropped + ' further findings were omitted (more than ' + MAX_PER_RULE + ' per rule); see countsByRule.');
  notes.push('Not checked: keyboard order, states, whether forms complete, overlapping or colliding labels below the first screen, and anything about taste. Focus is checked on the first 40 controls only. Check the rest by hand.');

  return {
    url: location.href,
    viewport: vw + 'x' + vh,
    summary: severityCounts,
    countsByRule: counts,
    findings,
    notes,
    ...(appMode ? { mode: 'app', relaxed: APP_RELAXED } : {}),
  };
})();
