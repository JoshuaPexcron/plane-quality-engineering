# Exploratory testing charters

Timeboxed sessions, 45 to 60 minutes each. One charter per session. Notes go into this folder as one file per session, findings worth reporting go to `docs/bugs/`.

The automated suite covers the known risks. These sessions exist to find what no one put on a list.

| Charter | Focus                                                                                                     |
| ------- | --------------------------------------------------------------------------------------------------------- |
| E1      | Work item creation with hostile input: very long titles, emoji, HTML and script tags, markdown edge cases |
| E2      | Role boundaries as guest and member: hunt for actions the UI forgot to hide or the API forgot to block    |
| E3      | Drag and drop and bulk operations on a busy board: reordering, multi-select, undo                         |
| E4      | Keyboard-only navigation through the core flow: login, create an item, comment                            |
| E5      | Reserve: follow up on anything suspicious from E1 to E4                                                   |

## Session rules

- Set a timer. When it rings, the session ends.
- Take notes while testing, not afterwards. Rough is fine.
- Every session note answers: what did I cover, what did I find, what stays open.
- A finding without reproduction steps is a rumor. Write the steps down immediately.
