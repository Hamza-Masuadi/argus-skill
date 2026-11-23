# Argus

The design skill that looks at its own work. Argus makes your coding agent design websites, dashboards and app screens the way a designer does: ask first, show you directions to choose from, build, then look at the real page and fix what it sees.

```bash
npx argus-skill install
```

Then ask for design work as usual: "build a landing page for my bakery", "add a settings screen", "make this look better". Or name a command, such as `/argus polish the pricing section`.

Works with Claude Code, Cursor, Codex, Gemini CLI, GitHub Copilot, Kiro, OpenCode, Grok, Devin and Windsurf.

## Why

Agents already know the rules of design. Their pages still come out generic, for four reasons, and Argus answers each.

- **The agent cannot see what it makes.** It writes code and imagines the result. Argus renders the page at phone and desktop width, looks at it, fixes it and looks again.
- **Its first idea is everyone's first idea.** Argus asks you two short rounds of questions, throws away the obvious ideas and builds each direction out of your subject's own kit: the things your customers handle, read and do.
- **It judges better than it generates.** Argus builds several first screens and puts them on one page, so you pick by looking instead of describing.
- **It plays safe.** Every new page gets one idea carried all the way down, and one big move on the first screen.

## How it works

For new work, a page, a dashboard, a tool or an app screen:

1. **It asks.** Two short rounds, every question skippable, with a recommended answer already chosen. First the business: who it is for, why they would pick you, how they act, and what you have to show. Saved in `DESIGN.md`, never asked again. Then this page: what a visitor should be sure of, what must be on it, what would be wrong for you, and how many directions to show: 1, 3 or 5.
2. **It shows you named directions.** Each one is a different idea, with its own structure, colours and type, shown live on one page (a first screen, or for a tool or app its main working screen) with its palette, its idea and its risk. In a set of three or more, one is plain, led by photographs, the product or, for an abstract subject, type; one is chosen by chance; Argus marks its own pick after looking at them all. Choose one or mix two.
3. **It builds the page** from the direction you chose: the first screen to a written bar first, then every section from your subject's kit, with large real pictures and motion that has a purpose, all with real content and working controls.
4. **It looks.** Screenshots at four widths, a measured check, and a list of mistakes found in real generated pages. It fixes what it finds and looks again.
5. **It reports** what it made, what it checked and what it assumed, and records the design in `DESIGN.md` so the next session can build on it.

In a project that already has a look, Argus matches instead of inventing: it measures the fonts, sizes, colours and spacing your product really uses, builds the new screen from those, and lists anything it could not match. A one-line tweak gets no ceremony at all.

## Commands

| Command | What it does |
|---|---|
| `variants` | Builds three to five distinct directions and shows them on one page for you to pick or mix |
| `polish` | Final pass on a working screen: alignment, spacing, states, copy |
| `audit` | Measured check with a score and ranked findings; changes nothing |
| `typeset` | Fixes typography |
| `colorize` | Fixes or introduces colour |
| `animate` | Adds motion with a purpose, or removes motion without one |
| `simplify` | Removes what is not earning its place |

## What makes it different

- **It looks at its own work.** Verified means rendered and looked at, not "the code reads right".
- **You choose by looking.** Directions arrive as real screens, not as a paragraph of adjectives.
- **It matches before it invents.** Inside an existing product, it measures the system and stays in it.
- **Plain text.** The skill is Markdown. No background process, no hooks, no settings changed. The installer and the tools make no network calls, except `photos`, and that only when it runs.
- **Small core.** About 1,700 words load when the skill triggers. Everything else loads only for the task in hand.
- **Real pictures, large and few.** It decides once what kind of picture the subject takes, then uses your photographs, the product itself shown working, or stock photographs it finds and credits on its own, which you can swap for yours. Where good photographs are few, it uses them large and lets type carry the other sections. Generated images only if you ask for them; drawn illustration comes last. Pages arrive, respond and move with a purpose, always with a reduced-motion version.
- **More than landing pages.** Separate guides for product UI, photo-led pages, web and native mobile.
- **Honest about design lore.** Its reference on the laws of UX says which are well supported and which popular "rules" are myths.

## Tools

The agent uses these by itself. You can also run them:

```bash
npx argus-skill check http://localhost:3000
```

| Command | What it does |
|---|---|
| `check <url>` | Measures contrast, overflow, collapsed columns, target sizes, labels, page length and more in a real browser |
| `shot <url>` | Screenshots at phone and desktop widths, once the page has stopped changing; `--full` captures the whole page, `--wait <ms>` gives scripted animations longer |
| `inventory <url>` | Measures the design system a page really uses; `--against <url>` lists what a new screen adds to an existing one |
| `compare` | Builds a before-and-after page from two screenshots, with a slider and the pixels that changed |
| `lint` | Scans source files when nothing can be rendered |
| `contrast` | Checks colour pairs |
| `rules` | Lists all 101 rules that `check` and `lint` apply, with severity and source; `--json` for scripts |
| `photos "<words>"` | Finds free-licence photographs on Openverse and Wikimedia Commons, downloads candidates and writes `credits.json` with author and licence |

Written in TypeScript, shipped compiled, no dependencies. They need Node 22 or later and, for the browser tools, an installed Chrome-family browser.

## Other ways to install

**Claude Code, as a plugin**

```
/plugin marketplace add Hamza-Masuadi/argus-skill
/plugin install argus@argus-skill
```

**Installer options**

| Option | Effect |
|---|---|
| `--global` | Install for your user account instead of this project |
| `--tools=claude,cursor` | Choose the tools yourself |
| `--all` | Every supported tool |
| `--force` | Replace an existing copy |
| `--dry-run` | Show what would happen and change nothing |

`update` replaces an existing copy, `uninstall` removes it, `list` shows every supported tool and its folder. The installer only copies files.

**With the skills CLI**

```bash
npx skills add Hamza-Masuadi/argus-skill
```

**By hand**

Copy the `skills/argus` folder into your tool's skills folder, keeping the name `argus`.

<details>
<summary>Where each tool reads skills</summary>

| Tool | In a project | For your user account |
|---|---|---|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Codex, Amp and other tools that read the shared convention | `.agents/skills/` | `~/.agents/skills/` |
| Cursor | `.cursor/skills/` | `~/.cursor/skills/` |
| Gemini CLI | `.gemini/skills/` | `~/.gemini/skills/` |
| GitHub Copilot / VS Code | `.github/skills/` | `~/.copilot/skills/` |
| Kiro | `.kiro/skills/` | `~/.kiro/skills/` |
| OpenCode | `.opencode/skills/` | `~/.config/opencode/skills/` |
| Grok | `.grok/skills/` | `~/.grok/skills/` |
| Devin / Windsurf | `.devin/skills/` | `~/.config/devin/skills/` |

</details>

<details>
<summary>What is inside</summary>

Everything is in `skills/argus/`.

| File | Purpose |
|---|---|
| `SKILL.md` | The core: routing, the loop, and the rules that always hold |
| `references/ask.md` | The two question rounds for new work |
| `references/create.md` | New pages: the idea, the big move, the section plan, directions, the bar for the first screen |
| `references/imagery.md` | Which kind of picture a page uses, where pictures come from, and how to draw well when drawing is right |
| `references/structures.md` | Thirteen page structures, so directions differ in shape and not only in colour |
| `references/ingredients.md` | The token roles every design fills in, and options for colour, type, shape and space |
| `references/extend.md` | Adding to a product that already has a look |
| `references/product.md` | Dashboards, tools and app screens |
| `references/photos.md` | Any page that uses photographs |
| `references/web.md`, `references/mobile.md` | What goes where on a page or app screen |
| `references/slips.md` | Mistakes found in real generated pages, checked on every look |
| `references/verify.md` | How to capture, check and review |
| `references/craft.md` | Every number: type, colour, space, motion, targets |
| `references/laws.md` | What the established laws of UX do and do not justify, plus myths |
| `references/tells.md` | Common generated-design defaults and what to do instead |
| `references/review.md`, `references/design-md.md` | Critique format; the project's design memory |
| `references/commands/` | One file per command |
| `assets/compare.html` | The choosing page for directions |
| `scripts/` | The tools above |

</details>

## Status

Argus is developed and tested in Claude Code, with the browser tools tested on macOS. If you use it in another tool or on another system, [open an issue](https://github.com/Hamza-Masuadi/argus-skill/issues) and say how it went. See the [changelog](CHANGELOG.md) for what is new.

## Credits

Named after Argus Panoptes, the hundred-eyed watchman of Greek myth. Written from scratch, drawing on established design research (Laws of UX, Nielsen Norman Group, WCAG 2.2, the Apple and Material guidelines) and on lessons from studying other design skills.

Created by Hamza Masuadi (Hamzawee), co-authored with Claude (Anthropic).

## Licence

MIT. See [LICENSE](LICENSE).
