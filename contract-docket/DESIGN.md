# Design system

## Surface

Operate: a Korean-language electronic-contract workspace for preparing a contract, reviewing its document, sending a signing link, and tracking the response.

## Direction

The contract is the file; the sender and signer are its route. A document preview and its dated activity record share the same detail view instead of competing dashboard cards. The recipient page keeps the agreement readable before presenting the signature controls.

## Color

| Token | Value | Use |
|---|---|---|
| `--paper` | `#f5f4ef` | Main canvas |
| `--white` | `#fffefa` | Document and form surfaces |
| `--ink` | `#202a32` | Primary text |
| `--muted` | `#64707a` | Supporting text |
| `--line` | `#dedfd9` | Quiet separators |
| `--blue` | `#2458df` | Primary action, selection, focus |
| `--green` | `#2f7657` | Completed signature |
| `--amber` | `#92631b` | Awaiting signature |
| `--red` | `#a5413e` | Declined or error state |

Use semantic status colors consistently. The blue accent belongs to an action or an active selection, not decoration.

## Type and layout

Use the system sans stack in `app/globals.css`, including platform Korean fonts. Product UI typography uses fixed sizes and restrained weights. Keep the desktop navigation persistent, the document preview legible, and workflow details adjacent to the selected contract. At 980px the workspace becomes one column; at 680px the navigation becomes a compact header and the list/detail flow stacks.

## Components and states

- Actions use compact 6px-radius buttons with visible keyboard focus.
- Lists use ruled rows, stable status labels, and tabular dates.
- Contract previews use a paper surface; uploaded PDFs remain in a native PDF frame.
- Empty, loading, error, sent, signed, and declined states are explicit.
- Signature pads support pointer input and PNG/JPG image import.
- Iconography uses small, single-stroke inline SVGs; no decorative raster assets ship.

## Motion and accessibility

State transitions are short and restrained. Reduced-motion preferences disable authored animation. Controls use labels, semantic buttons, a keyboard-operable search shortcut, visible focus, and touch-capable signature drawing.

## Operational boundary

The workspace is a local MVP, not a production security or legal-assurance design. Do not imply account protection, identity verification, a certified audit trail, or legal validity until those capabilities exist.
