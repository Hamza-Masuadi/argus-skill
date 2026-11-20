# Laws and principles

For justifying a decision or a review finding. You know these laws; what this file adds is what each one does and does not license, because they are misquoted more often than they are quoted correctly. Cite a law only for what it says, and never cite the myths at the end.

*(weak)* marks thin or contested evidence. *(convention)* marks sound practice without strong research.

## Placement and emphasis

| Law | It licenses | It does not license |
|---|---|---|
| **Fitts** | Primary action large and close to where attention already is. Mouse: screen edges are huge targets. Touch: edges and corners are the least accurate | Making everything big; size has diminishing returns |
| **Gestalt** (proximity, similarity, common region) | Group by spacing first, likeness second, a box last. Things that look alike must behave alike | Boxes around everything |
| **Von Restorff** | One emphasised element per view | Several "highlighted" items, which cancel out; colour as the only difference |
| **Serial position** | Most important nav items first and last | Claims about where eyes land; it is about memory |

## Choices and load

| Law | It licenses | It does not license |
|---|---|---|
| **Hick** | Fewer, staged or recommended options on screens where the user weighs a decision | Short menus or deep hierarchies; it does not apply to lists people scan |
| **Working memory** (Miller; about 4 chunks) | Never make users carry information between screens; chunk long numbers | "Seven menu items maximum"; menus are read, not memorised |
| **Choice overload** *(weak)* | Filters, defaults and easy comparison | "Fewer options always converts" |
| **Progressive disclosure** | Common options shown, advanced one step away, two levels at most | Hiding frequently used features |
| **Tesler** | Moving complexity into the system: defaults, inference, memory | Hiding controls users need |

## Expectations

| Law | It licenses | It does not license |
|---|---|---|
| **Jakob** | Standard patterns for standard jobs; originality in character, not in how controls work | Copying a competitor's flaws |
| **Norman** (signifiers, mapping, feedback, constraints) | Every control shows it can be used, and every action shows what happened | Icons alone for unfamiliar actions |
| **Recognition over recall** | Visible labels, recent items, suggestions | |
| **Visible navigation** | Primary navigation on screen wherever there is room. Hiding it behind a menu icon measurably cuts discovery and slows tasks on large screens | A hamburger menu on desktop |
| **Paradox of the active user** | Teaching in context, at the moment of need | First-launch tours |

## Time

| Finding | Number |
|---|---|
| **Response limits** (Nielsen) | 0.1s feels instant: react to every press within it. 1s holds the flow of thought: show activity past it. 10s loses attention: show progress and a cancel |
| **Core Web Vitals**, "good" | main content painted within 2.5s; response to interaction within 200ms; layout shift 0.1 or less |
| **Doherty** *(rule of thumb)* | respond within about 400ms; a convention, not a measured cliff |
| **Skeletons** *(weak)* | not proven to feel faster than spinners; their value is holding the layout steady |

## Errors and trust

| Principle | It licenses |
|---|---|
| **Error prevention** | Constrain inputs, offer defaults, disable what cannot be done and say why |
| **Forgiveness** | Undo over "are you sure?"; confirm only the irreversible and name the consequence; never lose typed work |
| **Postel** | Accept any reasonable format and normalise. Not: guessing when input is truly ambiguous |
| **User control** | A way out of every state. Anything that moves on its own for over five seconds can be paused |
| **Aesthetic-usability** | Visual quality is functional: people forgive attractive interfaces. It also hides real problems, so it never replaces checking |
| **Peak-end** *(weak)* | Extra care on the completion and failure moments of a flow |
| **Goal-gradient** | Showing real progress. Faked progress or invented incompleteness is manipulation |

## Forms

- One column; short related fields may share a row.
- Labels above fields, always visible; a placeholder is never the label.
- Validate when the user leaves a field, and clear the error the moment it is fixed.
- Allow paste and password managers; show-password instead of a confirm field.
- Never ask twice for the same information in one flow.
- A field whose purpose is unclear costs more than several obvious ones; the count matters less than relevance.

## Reading and mobile

- People scan. The F-shaped pattern is what happens to unformatted text: prevent it with headings, front-loaded first words and lists. It is not a layout to design to.
- People scroll when given a reason; attention is still heaviest at the top.
- Anything styled like an advert is ignored.
- Phones are held many ways and grips shift (Hoober). Touch is most accurate at the centre, least at edges and corners.

## Accessibility (WCAG 2.2 AA, exactly)

- Text 4.5:1; large text (about 24px, or 19px bold) 3:1; control boundaries and meaningful graphics 3:1.
- Targets 24x24 CSS px minimum, inline text links exempt. 44px is the stricter level and the platform guidance for touch: recommend it, do not report its absence as an AA failure.
- Works at 320 CSS px wide without sideways scroll, with text at 200%, and with increased text spacing.
- Focus visible and not hidden behind sticky bars.
- Dragging has a non-drag alternative. Colour is never the only signal.

## Myths: never apply or cite

| Claim | Reality |
|---|---|
| Three-click rule | Tested and false; clear steps matter, not their count |
| "Users don't scroll" | They do; priority still belongs at the top |
| 7±2 menu items | A misreading of working memory |
| Design to the F-pattern or Z-pattern | The F-pattern is a failure state; the Z-pattern has no solid research |
| Thumb-zone heat maps | Assume one fixed grip; real use varies |
| 60-30-10 colour rule, golden ratio | Folklore. Useful residue: mostly neutral, one sparing accent |
| The 8-point grid is optimal | A convention; consistency is the point |
| "Every extra field costs conversions" | Relevance and clarity matter more than counts |
| "Skeletons are faster than spinners" | Not shown |
| Eight-second attention span | No valid source |
