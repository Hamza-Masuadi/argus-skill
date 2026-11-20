# Designing mobile apps

How to design screens for phones and tablets. This is about decisions, not code, and applies whatever the app is built with. `craft.md` holds the numbers.

A phone is used in short bursts, often while doing something else. Design for a distracted person, not a seated reader.

To look at native work, build and run it on a simulator or device and capture the screen (`verify.md`). The web scripts do not apply; walk `slips.md` and this file against the screenshots.

## One screen, one job

- Each screen has one purpose a user could name. If a screen needs a paragraph to explain, split it.
- One primary action per screen, placed in the central or lower part of the screen. People hold phones in several ways and shift grip constantly, so do not design for one fixed "thumb zone": touch is most accurate near the centre and least accurate at edges and corners. Give targets near the edges extra size, and keep the top corners for infrequent actions.
- Show less and go deeper. Mobile favours a clear path through several simple screens over one dense screen.

## Navigation

- **Top-level destinations** (three to five) go in a bar that stays put: a tab bar at the bottom. Label every tab with a word; icons alone are guessed at.
- **Drilling down** pushes a new screen with a clear way back. The title tells users where they are.
- **Self-contained tasks** (compose, edit, pick) open as a sheet or modal with an explicit cancel and a confirm, and return the user to where they were.
- Do not hide primary navigation in a hamburger menu. What is out of sight is not used.
- Keep the user's place: switching tabs and coming back restores scroll position and state.

## Feel native on each platform

Users know their platform's habits. An app that ignores them feels like a web page in a wrapper. Honour the differences where they exist:

| | iOS | Android |
|---|---|---|
| Going back | Edge swipe and a back control at top left | System back gesture; the app must respond to it |
| Primary creation action | A button in the navigation bar or toolbar | Often a floating action button |
| Type and icons | System font and its symbol set | System font and Material icons |
| Controls | iOS-style switches, pickers and sheets | Material switches, menus and bottom sheets |
| Feedback after an action | Subtle, in place | A brief message at the bottom, often with undo |

Use the platform's standard controls for standard jobs (lists, settings, pickers, alerts). Spend custom design on what makes the product distinctive: its content, its key screen, its signature interaction. A custom toggle is rarely that.

## Touch

- Targets are at least 44pt on iOS and 48dp on Android, with space between them. Small text links packed together are a common failure.
- The whole row is tappable, not only its label or chevron.
- Every touch gets immediate visible feedback.
- Gestures (swipe to delete, pull to refresh, long press) are shortcuts. Each one needs a visible alternative, because gestures cannot be discovered by looking.
- Keep destructive actions away from frequent ones, and prefer undo to a confirmation prompt.

## Typing is expensive

- Ask for as little text as possible. Offer choices, defaults, scanning, sign-in with an existing account, and autofill.
- One field per row, with the right keyboard for each (numbers, email, phone).
- The keyboard covers half the screen. The focused field and the submit action stay visible above it.
- Validate in place, in plain words, without clearing what the user typed.

## First run and permissions

- Let people reach value before asking for an account. A sign-up wall on first launch loses many of them.
- Skip tutorial carousels; teach in context, at the moment a feature is first relevant.
- Ask for a permission (notifications, location, camera) at the moment it is needed, after explaining what the user gets. Asking for everything at launch earns refusals.

## Lists, loading and failure

- Most app screens are lists. Make rows scannable: one strong line, one supporting line, one piece of status at most.
- Show content-shaped placeholders while loading, and keep already-loaded content on screen when refreshing.
- Networks fail on phones. Design the offline and error states, keep what the user typed, and offer a retry.
- Empty screens say what belongs there and offer the first step.

## The device is part of the design

- Keep content clear of the notch, rounded corners, home indicator and system bars, while letting backgrounds run to the edges.
- Support light and dark appearance and the user's text-size setting. A layout that breaks when text grows excludes the people who need it most.
- Motion explains where things come from and go to. Keep it short, and honour the reduced-motion setting.
- Haptics mark meaningful moments (success, a threshold crossed), not every tap.
- On tablets and foldables, use the width: two panes side by side, not a stretched phone layout.

## Native numbers

The web numbers in `craft.md` do not carry over. On a native app, use the platform's own text styles and units, so that the user's text-size setting works and the app matches the system around it.

| | iOS | Android |
|---|---|---|
| Body text | 17pt | 16sp |
| Smallest text | 11pt | 11-12sp |
| Standard side margin | 16pt | 16dp |
| Touch target | 44pt | 48dp |

- Take sizes from the platform's named text styles (body, headline, caption and so on), never fixed numbers, so text scales with the user's setting.
- The dense 13-14px scale in `craft.md` is for desktop web tools. It is too small for a phone.
- Line your content up with the system's own margins. A custom margin a few points off the large title is visible at once.
- Native apps follow the system's light and dark appearance. Both are expected.

## The system's parts are not yours

The status bar, the navigation bar and its buttons, sheet and alert styling, and the keyboard belong to the platform. Leave them standard. Design the content area and choose the accent colour.

Check the platform's default secondary text colour against your own background. It is tuned for system backgrounds and can fail contrast on a tinted one.

## Small apps

An app with one main screen has no tab bar. Add one when there are three to five real destinations, not before.

On touch there is no hover and usually no keyboard focus. Every control still needs a pressed state and a disabled state.

## Looking at native work

Build it, run it on a simulator or device, and capture the screen. Look at four things at least: light appearance, dark appearance, a large accessibility text size, and the screen after its main action.

| | iOS Simulator | Android emulator or device |
|---|---|---|
| Screenshot | `xcrun simctl io booted screenshot shot.png` | `adb exec-out screencap -p > shot.png` |
| Dark appearance | `xcrun simctl ui booted appearance dark` | `adb shell cmd uimode night yes` |
| Large text | `xcrun simctl ui booted content_size accessibility-large` | `adb shell settings put system font_scale 1.3` |

- Relaunch the app after changing the text size; many screens do not relayout until then.
- Wait for sheets and transitions to finish before capturing. A capture taken mid-animation shows a state that never rests on screen, and a tap sent then can land on the wrong row.
- Set appearance and text size back when you are done.
- The web scripts do not apply. `scripts/contrast.js` still works on colour values you have in code.

## Slips specific to native

- Content margin slightly off the system title or navigation bar.
- Hard-coded text sizes that ignore the user's text-size setting.
- At large text, a row's parts wrap and strand a separator or an icon. Give each fact its own line at large sizes.
- Fixed heights around text, which clip when text grows.
- System grey text on a custom background, failing contrast.
- A custom control where the platform has a standard one.
- A tab bar with a single item.
- Restyled system chrome.

