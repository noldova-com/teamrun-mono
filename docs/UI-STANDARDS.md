# TeamRun UI standards

**Scope:** Renderer appearance, controls, interaction states and accessibility. Code ownership, security and implementation conventions belong to [the coding standards](CODING-STANDARDS.md).

TeamRun uses a compact, modern IDE-inspired desktop shell: panel cards, pill tabs, restrained surfaces and no separate activity bar. This document defines TeamRun's rules; changes to a reference application's appearance do not automatically change them.

Section 1 owns typography; section 8 owns component metrics. Dimensions are CSS pixels at default font settings unless another unit is shown. Preferred dimensions and minimums yield to text fitting, responsive layout and accessibility.

## 1. Typography

Use Noldova Sans for interface and prose, and Noldova Mono for code, with system fallbacks. Appearance offers independent interface and code font choices; selecting System changes only that font stack. Font assets and their licenses must be reviewed before distribution.

There are three adjustable base sizes, each ranging from 12 to 18 CSS pixels. Secondary labels and headings are derived roles, not additional user preferences. All roles are shared tokens; components do not invent text sizes.

| Role | Token or derivation | Default size | Line-height rule |
|---|---|---|---|
| Panel | `--tr-text-panel` | 13px | At least 18px and at least the font size plus 5px |
| Message | `--tr-text-message` | 14px | 1.6 for prose |
| Code | `--tr-text-code` | 14px | At least 1.5; preserve code alignment |
| Label | Derived from panel size: the larger of 12px and panel size minus 1px | 12px | At least the font size plus 4px; tooltips use at least the font size plus 7px |
| Settings group heading | Twice the panel size | 26px | At least 1.25 times the font size |

Panel text applies to navigation, menus, fields, options and dialog text. Label text applies to section headers, button labels, tooltips and secondary teammate details. Messages, their cards and the composer use the message role; code blocks, diffs and terminals use the code role. Inline code in the composer retains the input font's metrics so editing and selection stay aligned.

Use weight 400 for ordinary text and 600 for conversation titles, section headers, setting/dialog titles, choice pills and resolved mentions. Row/tab selection does not change weight; choice pills retain 600 in both states.

Rows, buttons, headings and overlays grow to fit the actual font, zoom, translated labels and validation text. Do not clip glyphs or vertically truncate labels to preserve baseline height. Where specified, display names may truncate horizontally with the full value available through an accessible label or tooltip.

Use Material Symbols Rounded for interface icons. Glyph sizes and control geometry are separate: a small icon still needs a usable pointer target.

## 2. Color and themes

Every visual color comes from a shared theme token. The built-in Light Modern and Dark Modern palette starts from the values below. The renderer must have complete initial tokens before themed content is painted; nested theme previews resolve derived tokens within their own scope.

The table specifies normal-state colors. Check actual composited foreground/background pairs in hover, selection and overlay states under section 7; correct the mapping or use a verified fallback when needed. Decorative borders may remain subtle; boundaries needed to identify controls must meet non-text contrast requirements.

| Token | Theme key or source | Light | Dark | Use |
|---|---|---|---|---|
| `--tr-window` | `sideBar.background` | #F8F8F8 | #181818 | Shell and dock surfaces |
| `--tr-panel` | `editor.background` | #FFFFFF | #1F1F1F | Document surface |
| `--tr-raised` | `teamrun.raisedBackground`, fallback `editorWidget.background` | #F8F8F8 | #2B2B2B | Message cards and user bubbles |
| `--tr-code` | `teamrun.codeBackground`, fallback `sideBar.background` | #F8F8F8 | #181818 | Code body |
| `--tr-code-header` | `teamrun.codeHeaderBackground`, fallback `editorWidget.background` | #F2F2F2 | #2B2B2B | Code header |
| `--tr-inline-code` | Foreground mixed at 12% over the local surface | 12% foreground | 12% foreground | Inline-code background; text remains fully opaque |
| `--tr-text` | `foreground` | #3B3B3B | #CCCCCC | Ordinary text and selected-tab labels |
| `--tr-text-muted` | `teamrun.mutedForeground`, fallback `descriptionForeground` | #616161 | #9D9D9D | Secondary text on normal surfaces |
| `--tr-text-tab` | Opaque muted text, adjusted for its surface | #616161 | #9D9D9D | Unselected, operable tab labels |
| `--tr-text-placeholder` | Opaque muted text, adjusted for its surface | #616161 | #9D9D9D | Composer placeholder |
| `--tr-icon-color` | `icon.foreground`, fallback `foreground` | #3B3B3B | #CCCCCC | Interface icons |
| `--tr-card-border` | `surface.border`, fallback `widget.border` | #E5E5E5 | #252526 | Decorative panel border |
| `--tr-border` | `sideBarSectionHeader.border` | #E5E5E5 | #2B2B2B | Section dividers |
| `--tr-accent` | `focusBorder`, contrast-adjusted | #005FB8 | #4DAAFC | Focus, drop guides and active resize indicators |
| `--tr-link` | `textLink.foreground` | #005FB8 | #4DAAFC | Links |
| `--tr-hover` | `list.hoverBackground` | #F2F2F2 | #2A2D2E | Row, tab and menu-item hover |
| `--tr-selected` | `list.inactiveSelectionBackground`, fallback `list.activeSelectionBackground` | #E4E6F1 | #37373D | Selected rows, tabs and choice pills |
| `--tr-toolbar-hover` | `toolbar.hoverBackground` | #B8B8B850 | #5A5D5E50 | Icon-button hover |
| `--tr-scrollbar` | `scrollbarSlider.background` | #64646466 | #79797966 | Scrollbar thumb; adjust when needed for visibility |
| `--tr-title-bar`, `--tr-title-bar-text` | `titleBar.activeBackground`, `titleBar.activeForeground` | #F8F8F8, #1E1E1E | #181818, #CCCCCC | Native title-bar integration |
| `--tr-input`, `--tr-input-border`, `--tr-input-text`, `--tr-placeholder` | `input.*`, with contrast-checked border fallback | #FFFFFF, #858585, #3B3B3B, #767676 | #313131, #858585, #CCCCCC, #989898 | Fields and selects; placeholders are not substitutes for labels |
| `--tr-button`, `--tr-button-text`, `--tr-button-hover` | `button.*` | #005FB8, #FFFFFF, #0258A8 | #0078D4, #FFFFFF, #026EC1 | Primary button |
| `--tr-button-secondary`, `--tr-button-secondary-text`, `--tr-button-secondary-hover` | `button.secondary*` | #E5E5E5, #3B3B3B, #CCCCCC | transparent, #CCCCCC, #2B2B2B | Secondary button |
| `--tr-dropdown`, `--tr-dropdown-border`, `--tr-dropdown-list` | `dropdown.*`, fallback `input.*` | #FFFFFF, #858585, #FFFFFF | #313131, #858585, #1F1F1F | Select and options list |
| `--tr-list-active`, `--tr-list-active-text` | `list.activeSelection*` | #E8E8E8, #000000 | #04395E, #FFFFFF | Chosen or keyboard-active option |
| `--tr-button-border` | `button.border` | #0000001A | #FFFFFF1A | Decorative edge where the button fill already identifies the control |
| `--tr-setting-title` | `settings.headerForeground`, fallback `foreground` | #1F1F1F | #FFFFFF | Settings titles |
| `--tr-hover-widget`, `--tr-hover-widget-border` | `editorHoverWidget.*`, fallback `editorWidget.background` / `widget.border` | #F8F8F8, #3B3B3B33 | #202020, #CCCCCC33 | Tooltip surface |
| `--tr-quick-input` | `quickInput.background`, fallback `editorWidget.background` | #F8F8F8 | #222222 | Search surface |
| `--tr-menu-separator` | `menu.separatorBackground`, fallback `widget.border` | #3B3B3B33 | #454545 | Decorative menu separator |
| `--tr-widget-shadow` | `widget.shadow` | #00000029 | #0000005C | Select-list shadow |
| `--tr-widget-border` | `widget.border`, fallback `surface.border` | #E5E5E5 | #313131 | Dialog and search outline |
| `--tr-dialog` | `dialog.background`, fallback `editorWidget.background` | #F8F8F8 | #202020 | Dialog surface |
| `--tr-menu`, `--tr-menu-text`, `--tr-menu-border` | `menu.*` | #FFFFFF, #3B3B3B, #CECECE | #1F1F1F, #CCCCCC, #454545 | Menus; keyboard and pointer rows use the hover fill |
| `--tr-checkbox`, `--tr-checkbox-border` | `checkbox.*`, with contrast-checked border fallback | #F8F8F8, #858585 | #313131, #858585 | Checkbox surface and identifiable boundary |
| `--tr-badge`, `--tr-badge-text` | `badge.*` | #CCCCCC, #3B3B3B | #616161, #F8F8F8 | Available filled-badge pair; count chips use the component table |
| `--tr-progress` | `progressBar.background`, fallback accent | #005FB8 | #4DAAFC | Progress indicators |
| `--tr-notification`, `--tr-notification-border` | `notifications.*` | #FFFFFF, #E5E5E5 | #1F1F1F, #454545 | Notification surface |
| `--tr-error`, `--tr-removed` | Semantic error/removal foregrounds | #A1260D | #F48771 | Errors and removed lines/counts, with text or symbols identifying their meaning |
| `--tr-added` | Semantic addition foreground | #3F6212 | #B5CEA8 | Added lines/counts and copy-success icon |
| `--tr-added-background`, `--tr-removed-background` | Respective semantic foreground mixed over the local surface | 12% foreground | 12% foreground | Diff backgrounds; normal code text remains readable |

Keep unselected tabs, secondary labels, placeholders, historical teammate names and selectable unavailable mentions readable. Do not dim them as disabled controls. On selected surfaces, use the selected foreground or another validated token when muted text loses contrast.

Use one interaction accent per theme. Error, addition/removal and stable avatar identity colors are distinct semantic roles and are allowed. Pair meaningful color changes with text, icons or other discernible state cues. A teammate's stable identity selects its palette entry; rename, account changes and unavailable state do not select a new color. The default responder has a reserved color outside the named-teammate palette. Each foreground/background pair must be checked in both themes.

Shadows are shared tokens: `--tr-shadow-large` is 0 0 12px at 14% black; `--tr-shadow-xlarge` is 0 0 20px at 15% black; `--tr-widget-shadow` supplies select lists. Menus, tooltips, dialogs, search overlays and drag ghosts may use their assigned shadow. Ordinary panel and message cards do not. A modal backdrop uses `--tr-backdrop` at 50% black; a non-modal search overlay does not dim the window.

Nested theme previews, including the Gallery, must resolve base and derived colors within their own theme scope. Framework color tokens map to the same source values; changing component libraries is a separate implementation decision.

## 3. Panels and surfaces

Each dock and document area uses a panel card with a tab bar and active content. Docks use the shell surface; documents use the panel surface. Collapsed docks show view icons. Section 8 owns card geometry.

Do not add dividers below the native window row or every tab bar, or between every container. Optional section-header separators, functional borders, table separators and code-header dividers remain allowed.

Panel cards may clip content to their corners; overlays, focus indicators and drag guides must remain visible and controls accessible.

Radius tokens are `hover` = 3px, `small` = 4px, `medium` = 6px and `large` = 8px; `round` is reserved for circular controls and avatars. Section 8 assigns a radius to each component. Do not introduce another radius assignment in a general rule or component-local stylesheet.

## 4. Tabs, navigation and history

- Show a tab bar for every panel, including a panel with one view. The document strip scrolls horizontally when necessary, keeps the active tab visible and offers an overflow list. Dock actions remain reachable at the end of their strip.
- A tab uses a pill fill for selection and hover. Selected labels use ordinary text; unselected labels use the opaque tab-text token. Hover must not erase the selection or keyboard-focus cue. A running reply can replace the close glyph with a spinner, but hovering or focusing the tab reveals its close action.
- Middle-click closes the targeted conversation, Settings or dock tab with the same behavior as its close control, without first activating a background tab or starting autoscroll. Keyboard users have an equivalent close command. Closing the active tab moves focus to an appropriate surviving tab or panel.
- Every panel can dock on the left, on the right or at the bottom, or open in the middle as a tab beside conversations, and moves between these places the same way.
- Dragging shows a destination marker, docking guides and a preview. The dragged representation may dim; its name remains available in the accessible interaction. Provide keyboard/menu alternatives for moving, pinning and docking views.
- Preview tabs use italic labels, with one preview per strip. Opening another preview replaces it; an explicit keep action, double-click or sending a message keeps the conversation tab. All of these actions have a keyboard-accessible equivalent.
- Restore the conversation's reading anchor and expansion/wrap choices. Message/image loading must not flash at intrinsic size or move the reader to unrelated content; a located search result stays visible during surrounding layout changes.
- Conversations read oldest to newest. Activity and Changes read newest first. Each can load more history as needed, with details loaded on expansion. Their shared retention principle does not require the same chronological order.
- The conversation's Go to latest control is centred at the bottom; Activity and Changes place it at the top centre. Returning to latest resumes following new content. Scrolling away suspends following until the user returns. Loading and retry feedback belong to the requesting panel and do not insert extra scrollable height.
- Eviction retains known row geometry and control choices. Remeasurement after width/font changes preserves the reading anchor. Metadata lifetime follows the architecture's history contract.
- A terminal follows new output until the person scrolls away. Scrolling up continues through all earlier output, loaded as needed, without switching to another view, and search covers all of it. **Restart** starts a fresh shell in the same terminal. Closing or restarting a terminal whose command is still running asks first.

The [architecture's history contract](ARCHITECTURE.md#9-renderer-synchronization-and-history) owns retention and initial budgets. Implementations define and test payload/image limits, overscan and follow-scroll thresholds; this document owns visible behavior.

## 5. Spacing and responsive layout

Use the shared spacing scale of 4, 8, 12, 16 and 24px and section 8's component measurements, subject to section 1's text-fitting rules.

- Overlays fit within the viewport below native chrome, with an outer margin. Reduce preferred widths as needed; bound height and scroll content while keeping essential actions reachable.
- Fields/selects shrink to their container; settings rows and dialog actions wrap or stack. Errors wrap within their owner. Truncated labels retain their full accessible name.
- The conversation column is fluid and centred up to its preferred maximum. Message prose wraps; code and genuinely two-dimensional tables/diffs may scroll horizontally within their own region. A long string must not widen the document card or the entire window.
- Prefer enough room for the document before the docks. When space decreases, shrink the left dock first, then the right, and the bottom on the vertical axis. Preserve the user's saved dock sizes so they return when space becomes available. If preferred minima cannot fit, collapse docks into reachable controls rather than overflowing the window or producing negative pane sizes.
- Resize within available window bounds. Navigation, hidden-dock controls, the composer and dialog actions stay reachable at the smallest supported window and enlarged zoom; drafts, selections and reading position survive layout changes.
- Native window controls and application overlay controls occupy separate usable regions. Image-viewer Close, Copy and Download controls must never be covered by the operating system's close/minimize controls.

## 6. Interaction states

- **Hover:** use the appropriate row, toolbar or button hover token. A checkbox or field does not need an extra hover fill. Hover-only actions also appear on keyboard focus and remain usable while the pointer moves to them.
- **Pointer:** buttons, links, tabs, selectable rows and menu items use a hand cursor; editable text uses the text cursor, resize handles use their resize cursor, and disabled controls use the default cursor.
- **Selection:** rows, tabs and choice pills use the selected surface. Options under keyboard navigation use the active-list foreground/background pair. Expose selected and pressed states semantically; a checked checkbox shows its mark without relying on a color change alone.
- **Focus:** editable fields use the accent border. Other controls have a visible keyboard-focus outline that survives hover and selection and is not clipped or hidden behind overlays. Use a contrast-safe alternative or a two-color treatment when the accent blends into a control's fill. Menu keyboard focus remains distinct through its active row and semantic state.
- **Disabled:** a genuinely unavailable control may dim, but it must not respond to activation. Explain the reason where useful. Readable status text, unselected tabs and selectable unavailable teammates are not disabled controls and must retain sufficient contrast.
- **Working:** show local progress and cancellation where supported. Keep the status in the component that owns the work. Announce significant progress and completion accessibly without announcing every timer tick or streamed token.
- **Errors:** show a clear message with an applicable recovery action. Preserve drafts and selections on recoverable failures. Do not depend on red coloring or a transient toast to explain why an operation failed.
- **Dragging:** show the source, valid targets and the intended destination. Clear previews and highlights on drop, cancellation, blur or loss of the target. Respect reduced-motion preferences for rearrangement animations.

## 7. Accessibility

- Operable UI text, placeholders, tooltips and informative secondary text meet at least 4.5:1 contrast at normal sizes. Large text follows the applicable 3:1 threshold. Disabled-control exceptions apply only to genuinely inoperable controls, not unselected tabs or historical information. Measure the composited foreground/background pair in every relevant state. See [text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- Essential control boundaries, state indicators and focus cues meet at least 3:1 against adjacent colors where required for identification. Decorative separators are not substitutes for an identifiable control. Color alone does not communicate success, error, availability or identity. See [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- Use semantic controls, accessible names and associated labels. Icon-only actions expose their purpose. Errors and help text are associated with their inputs; a tooltip or placeholder is not the only label. Expose selected, expanded, checked, pressed and disabled states through the appropriate semantics.
- All operations are usable by keyboard with a predictable focus order. Tabs, lists, menus and completion use their established keyboard patterns; activation and dismissal cannot depend on middle-click, double-click, drag or a context menu alone.
- Modal dialogs receive appropriate initial focus, contain focus while open, make the background inert and return focus to the opener or a sensible surviving control when closed. Escape dismisses a dismissible overlay; forms with unsaved work use an explicit discard policy. Non-modal search and popovers do not accidentally trap focus. See the [modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
- Pointer targets are at least 24 by 24 CSS pixels or meet a documented spacing/equivalent-control exception. Visual glyphs, hover pads and hit regions can differ, but hit regions must not overlap adjacent controls. A narrow resize sash needs adequate hit spacing or an equivalent adequately sized pointer control, plus keyboard operation. Do not restore large framework hit regions that obscure neighboring controls. See [target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- Tooltips open on focus as well as hover, can be dismissed without moving focus and stay available while the user moves the pointer over them. Prefer placement above the visible anchor, flip when needed and keep the tooltip within the viewport. Reposition or dismiss it when the anchor scrolls, becomes clipped or is removed. Tooltips contain descriptions; use a popover or dialog for interactive content. See [hover/focus content](https://www.w3.org/WAI/WCAG22/Understanding/content-on-hover-or-focus.html).
- Enlarged text, zoom, high-contrast/forced-color modes and reduced motion remain usable. Do not hide focus or selection cues when a custom theme or color preference changes. Provide text alternatives for images and meaningful status announcements without repeatedly stealing focus.

## 8. Component metrics and behavior

This table owns component geometry and radii. Typography follows section 1, radii section 3 and pointer targets section 7. Heights grow to fit text; widths are preferred maxima unless marked as minimums.

| Component | Default geometry | Text role | Surface and behavior |
|---|---|---|---|
| Window row | 35px high | Panel; title 600 | Shell; window controls and breadcrumb, with no divider beneath |
| Panel card | 1px border; large radius; 4px gaps and outer side/bottom margin | Inherited | Shell for docks, panel for documents; meets the window row above |
| Dock sizing | Preferred minimum 160px on its resize axis; collapsed strip 44px | Inherited | Preserve saved sizes; collapse when necessary to keep the document and controls reachable |
| Document area | Preferred minimum 220px across and down | Inherited | Priority when allocating pane space; effective size must fit the usable window |
| Conversation column | Fluid width up to 55rem | Message | Centred in the document; prose wraps and wide code/tables scroll within their own regions |
| Tab bar | 32px minimum high; 2px start inset | Panel | One per card; grows for an overflow scrollbar; dock action at the end |
| Tab | 32px minimum high; 24px pill; 2px side inset; 8px label inset; 28px action allowance; 24px action slot; 20px close pad; small radius | Panel | Selected/hover fill; selected text or opaque tab text; accessible close target fits the action slot |
| Sidebar row | 26px minimum high; 8px text inset; 16px icon; 8px icon gap; small radius | Panel | Hover/selected surface; project name or twistie toggles children; conversation indentation 28px; initially ten conversations, then Show N more; pinned conversations appear under Pinned once |
| Section header | 28px minimum high; text inset 24px; separator inset 4px | Label, 600 | No fill; optional separator above |
| Teammate avatar | 24px circle; round | Panel initial | One of twelve stable identity colors; reserved default color; full identity/settings accessible. Unavailable/former state uses a label or badge without making the initial or name unreadable |
| Teammates section | Rows at least 40px; list up to 16rem high | Panel name, Label detail | Between Pinned and Projects; only named members of the active conversation tab. Settings/image tabs show no-active-chat state. Global management belongs in Settings |
| Configuration table | Rows grow; 8px cell padding | Panel; header 600 | Providers and Teammates share the pattern: title/Add above, explanation, semantic headers, separators and labelled actions; horizontal scroll only when necessary |
| Member strip | At least 40px high | Avatar labels | Below document tabs; default first, named members scroll horizontally, Add last; idle members can be removed through their menu |
| Teammate dialog | Dialog geometry | Panel | Labelled name/account/model/effort fields and optional role text; preserves its draft and shows an actionable error when a busy mutation is refused |
| Mention completion | Up to 16rem high; menu geometry | Panel | Above the composer when space permits; members first, others grouped; arrows navigate, Enter inserts, Escape dismisses; selectable unavailable choices remain legible and identified |
| Mention text | Inline | Message, 600 | Accent for resolved user mentions outside code/escapes; retain stored spelling and show unavailable identity explicitly; provider replies do not invite teammates |
| Menu | Large radius; 1px border; 4px vertical padding; section-label padding 8px 12px 4px | Panel; section labels muted | Menu surface and large shadow |
| Menu item | 26px minimum high; 4px inset; 8px text padding; 16px icon; medium radius; separator spacing 5px | Panel | Hover/keyboard-active row; disabled actions are inoperable |
| Tooltip | Up to 700px wide, viewport-clamped; 2px vertical/8px horizontal padding; hover radius | Label, tooltip line height | Hover-widget surface, 1px border and large shadow; accessible placement/dismissal from section 7 |
| Dialog | Preferred width 440px; large radius; title padding 22px 32px 12px 20px; body 0 32px 0 20px; actions 20px 8px 8px with 8px gaps | Panel; title 600 | Dialog surface, 1px border, extra-large shadow and modal backdrop; content/actions reflow |
| Sash | 4px visual gap; three 2px grip dots spaced 5px | Accessible resize label | Grip at 30% normal foreground; accent after 300ms hover or during drag; keyboard resize exposes the affected pane and size |
| Quick input (search) | Preferred width 600px; 6px top margin; padding 6px 6px 4px; hits 4px below field; large radius | Panel | Quick-input surface, border and extra-large shadow; non-modal and viewport-clamped |
| Button | 26px minimum high; 8px side padding; small radius | Label | Primary, secondary or text-button tokens; no ripple/state layer; adequate hit region without overlapping controls |
| Text field | 26px minimum high; preferred width 200px; 6px inner padding; small radius | Panel | Input tokens; labelled; focus border; wraps validation text outside the input |
| Select | 26px minimum high; preferred width 320px; small radius | Panel | Field styling; arrow in readable foreground; shrinks to its container |
| Dropdown list | 26px minimum rows; 4px inner padding; 8px row side padding; small radius | Panel | Dropdown surface, 1px border and widget shadow; chosen/keyboard row uses active-list pair; no decorative check mark |
| Checkbox | 18px visual square; 8px label gap; hover radius | Panel label | Label participates in the hit target; border and check mark remain identifiable |
| Choice pills (toggle group) | 22px minimum visual height; 8px side padding; 4px gaps; small radius | Panel, 600 | Selected or hover fill, no decorative border/check; separate semantic selected state |
| Settings item | Padding 12px 14px 18px; description gap 3px; control gap 9px; medium radius | Panel; title 600 | Subtle hover surface; text and controls wrap |
| Settings heading | Automatic height; 10px surrounding space, 15px start inset | Settings group heading, 600 | Heading foreground; grows with its proportional line height |
| Icon button | 22px visual pad around a 16px glyph; small radius | Accessible name | Toolbar hover; pointer hit region at least 24px unless a documented exception applies |
| Dock guide, compass arm and hub | 40px square around a 24px glyph; small radius; medium-radius plate with 2px gaps | Accessible action name | Raised surface; accent for the chosen destination |
| Progress | 2px bar; 16px spinner; reveal after 300ms where delay avoids flicker | Accessible status | Progress token; empty track; completion/error remain understandable without animation |
| Message copy | 16px glyph inside an adequate icon-button target | Accessible name | Muted normal icon, readable hover/focus; check and Copied feedback for 1.5s; remains discoverable |
| Message bubble (user) | Automatic height; medium radius | Message | Raised surface, aligned right; rendered Markdown remains selectable |
| Word wrap | Icon-button geometry; 16px wrap glyph | Accessible name | Initially off; precedes Copy or diff collapse; pressed state exposed; Enter/Space activate |
| Inline code | Text metrics; small radius | Code in messages, input font in composer | Inline-code token; completed composer spans conceal backticks within padding, while incomplete spans/selected source stay editable; preserve native undo and selection |
| Reply | Automatic height | Message | Unfilled body, muted provider line, raised detail cards |
| Reply status | Fits available width | Message | Active: status/timer below content and approvals, Stop at the end. Complete: elapsed time and activity disclosure below provider header; no spinner/Stop. Activity opens by pointer or keyboard |
| Message list window | Available panel size | Message | Stable anchors and geometry, gradual history loading, newest initially unless restoring a saved position or locating a result; bottom-centred Go to latest |
| Activity and Changes history | Available panel size | Panel/message content as appropriate | Newest first; expand details on demand; retain visited geometry/control choices; top-centred Go to latest |
| Preview tab | Tab geometry | Panel, italic | One temporary preview per strip; explicit keep action available |
| Sidebar row while dragged | Sidebar-row geometry; small radius | Panel | Shell-color ghost, border and large shadow; placeholder may dim; rearrangement animation up to 150ms and disabled for reduced motion; conversations can move between projects |
| Card (files, activity) | Automatic height; medium radius; 1px border | Message | Raised surface; file header groups icon, Edited N files and added/removed counts; output aligns under the step title |
| Code block | Automatic body height; 26px minimum header; medium radius; 1px border | Code body; Panel/Label header | Separate header/body surfaces and divider; language, wrap and copy controls; horizontal scroll is local to the block |
| Composer | Two visible input lines initially, grows to ten before inner scrolling; large radius; 1px border | Message | Window surface; round Send button; resizing preserves discussion position and draft |
| Composer attachments | Horizontal row; 7rem square image tiles with large radius | Message/file labels | Filenames available on hover/focus; remove buttons appear on hover/focus; other files use chips. File-only Send is available; errors preserve the draft; sent files survive reopening and return with rewind |
| Model choices | Composer menu and Settings selects | Panel | Provider, Account, Model, Effort for unnamed responders; filter accounts by provider and label their host. Wait for the selected account's catalog, retain missing saved choices visibly, and clear incompatible choices only on explicit selection changes. Named teammate editing may span providers |
| File-drop target | Conversation content below document tabs | Message | Accent tint/border and centred Drop to attach; covers messages and composer without altering layout; remains stable across child boundaries and clears on leave/drop/cancel/blur; text drags are unaffected |
| Image viewer (modal) | Usable window below native title bar | Message | Dark backdrop; initial fit, zoom/fit below, previous/next at sides. Filename, Copy Image, Download Image and Close remain reachable. Arrow navigation; Escape or empty backdrop dismisses and restores focus; right-click offers copy/download |
| Image preview | Up to 24rem high and available column width | Message caption | Preserve aspect ratio, do not upscale, reserve known dimensions while decoding/reloading and avoid intrinsic-size flashes |
| Image document | Available document pane | Message | General settings choose Popup (default) or Tab. Right-click offers the alternative, Open in a new tab or Open modal, without changing the preference, then Copy Image and Download Image. Tabs use themed viewer controls without modal title-bar inset; background clicks do not close them; draft survives switching views |
| Badge (counts, +1 -0), key chip | 20px visual height; small radius; 1px border | Panel | Count badges unfilled, key chips raised; diff counts use semantic text and signs; failures have an explicit status |

Provider defaults and unsupported capabilities must be explained in user-facing terms. Default model and Default effort remain explicit choices; a host label identifies where the CLI/profile runs. An explicitly unsupported image capability prevents sending that input with an explanation; an unknown capability remains unknown and any provider rejection preserves the draft. This UI rule does not introduce remote-host or provider capabilities.

Unnamed responders may select Default sign-in for the chosen provider, clearly distinguished from a saved account. An explicit provider change resets incompatible account/model/effort selections. A failed catalog refresh preserves the current choices, exposes the failure and offers retry; it must not silently switch an account or model.

Copy feedback uses both the check glyph and the accessible Copied label, including image toolbar copy. Image tabs last for the app session unless a separately accepted persistence contract changes that behavior. The image viewer's decoding and memory budget belongs to its implementation contract; visible transitions must remain stable.

## 9. Implementation and verification

- Shared stylesheet/theme tokens own colors and geometry; templates use shared layout and component classes. Layout classes may arrange elements and consume tokens, but do not add competing literal sizes, colors or radii. Framework overrides must preserve semantics, focus and hit testing as well as appearance.
- Docks and documents share the panel-card and tab primitives. A new control extends the component table when its contract differs; update this owner through review instead of adding a private visual exception.
- Use the framework's supported theming APIs where available. Verify the actual cascade and theme scope rather than assuming a particular stylesheet order or increasing specificity without examining the conflict.
- The Gallery demonstrates each reusable control's meaningful states in light and dark themes. Include keyboard focus, selection, disabled/working/error states, long text and overlay behavior. Gallery coverage does not replace checks in the real parent layouts.
- Verify default and minimum/maximum font preferences, relevant font fallbacks, 100% and 200% zoom, the smallest supported window, reduced motion and forced colors. Check that active controls, focus and dialog actions remain reachable and that code/diff scrolling does not widen the page.
- Capture relevant UI regions with recorded theme, font settings, zoom, viewport, platform and revision. Compare with the approved TeamRun baseline. When a reference application informs a change, record its version/settings and provide a reproducible reference; access to one person's installed editor is not a prerequisite for contribution.
- Use DOM/computed-style and contrast measurements for numerical claims, plus keyboard and assistive-technology checks for interaction claims. Screenshots alone do not prove geometry, contrast or accessibility. Check composited colors in each state and test popup anchoring during scroll, resize and removal.
- Check owning components and real layouts under [TESTING.md](TESTING.md), which owns UI automation, the platform matrix, screenshots, reporting and cleanup. This document owns the visual and interaction requirements.
