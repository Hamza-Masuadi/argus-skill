# Argus

The design skill that looks at its own work. Argus makes your coding agent design websites, dashboards and app screens the way a designer does: ask first, show you directions to choose from, build, then look at the real page and fix what it sees.

```bash
npx argus-skill install
```

Then ask for design work as usual: "build a landing page for my bakery", "add a settings screen", "make this look better". Or name a command, such as `/argus polish the pricing section`.

Works with Claude Code, Cursor, Codex, Gemini CLI, GitHub Copilot, Kiro, OpenCode, Grok, Devin and Windsurf.

## Why

Agents already know the rules of design. Their pages still come out generic, for four reasons. Argus is built around fixing each one.

- **The agent cannot see what it makes.** It writes code and imagines the result. Argus renders the page at phone and desktop width, looks at it, fixes it and looks again.
- **Its first idea is everyone's first idea.** Argus asks you one short round of questions, throws away the obvious ideas and draws the design from your subject.
- **It judges better than it generates.** Argus builds several first screens and puts them side by side, so you pick by looking instead of describing.
- **It plays safe.** Every new page gets one idea carried all the way down, and one big move on the first screen.

## How it works

For a new page:

1. **It asks.** One round, every question skippable, with a recommended answer already chosen. Who it is for, how it should feel, what you have to show. It also proposes three first-screen approaches suited to your subject and asks how many directions you want to see: 1, 3 or 5.
2. **It shows you directions.** Each one is a different idea for the whole design, shown as a real first screen, side by side on one page. Pick one or mix them.
3. **It builds the page** from the direction you chose, with real content and working controls.
4. **It looks.** Screenshots at three widths, a measured check, and a list of mistakes found in real generated pages. It fixes what it finds and looks again.
5. **It reports** what it made, what it checked and what it assumed.

In a project that already has a look, Argus does the opposite of inventing: it measures the fonts, sizes, colours and spacing your product really uses, builds the new screen from those, and lists anything it could not match. A one-line tweak gets no ceremony at all.

## Commands

| Command | What it does |
|---|---|
| `variants` | Builds three to five distinct directions and shows them side by side for you to pick |
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
- **Plain text.** The skill is Markdown. No background process, no hooks, no network calls, no settings changed.
- **Small core.** About 1,300 words load when the skill triggers. Everything else loads only for the task in hand.
- **More than landing pages.** Separate guides for product UI, photo-led pages, web and native mobile.
- **Honest about design lore.** Its reference on the laws of UX says which are well supported and which popular "rules" are myths.

## Tools

The agent uses these by itself. You can also run them:

```bash
npx argus-skill check http://localhost:3000
```

| Command | What it does |
|---|---|
| `check <url>` | Loads the page in a real browser and measures contrast, overflow, collapsed columns, target sizes, labels, page length and more |
| `shot <url>` | Screenshots at phone and desktop widths; `--full` captures the whole page |
| `inventory <url>` | Measures the design system a page really uses; `--against <url>` lists what a new screen adds to an existing one |
| `compare` | Builds a before-and-after page from two screenshots, with a slider and the pixels that changed |
| `lint` | Scans source files when nothing can be rendered |
| `contrast` | Checks colour pairs |

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
| `references/ask.md` | The question round for new work |
| `references/create.md` | New pages: the idea, the big move, directions, the first-screen pass |
| `references/structures.md` | Twelve page structures, so directions differ in shape and not only in colour |
| `references/ingredients.md` | The token roles every design fills in, and options for colour, type, shape and space |
| `references/extend.md` | Adding to a product that already has a look |
| `references/product.md` | Dashboards, tools and app screens |
| `references/photos.md` | Pages where pictures do the selling |
| `references/web.md`, `references/mobile.md` | What goes where on a page or app screen |
| `references/slips.md` | Mistakes found in real generated pages, checked on every look |
| `references/verify.md` | How to capture, check and review |
| `references/craft.md` | Every number: type, colour, space, motion, targets |
| `references/laws.md` | What the established laws of UX do and do not justify, plus myths |
| `references/tells.md` | Common generated-design defaults and what to do instead |
| `references/review.md`, `references/design-md.md` | Critique format; recording decisions |
| `references/commands/` | One file per command |

</details>

## Status

Argus is developed and tested in Claude Code, with the browser tools tested on macOS. If you use it in another tool or on another system, [open an issue](https://github.com/Hamza-Masuadi/argus-skill/issues) and say how it went. See the [changelog](CHANGELOG.md) for what is new.

## Credits

Named after Argus Panoptes, the hundred-eyed watchman of Greek myth. Written from scratch, drawing on established design research (Laws of UX, Nielsen Norman Group, WCAG 2.2, the Apple and Material guidelines) and on lessons from studying other design skills, including impeccable, taste-skill, UI UX Pro Max and Anthropic's frontend-design.

Created by Hamza Masuadi (Hamzawee), co-authored with Claude (Anthropic).

## Licence

MIT. See [LICENSE](LICENSE).
