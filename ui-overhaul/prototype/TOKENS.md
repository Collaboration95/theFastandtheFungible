# UO-04 token sheet

The prototype uses semantic CSS custom properties in `styles.css`. These are the compact visual contract for the working surfaces.

| Token group | Values | Use |
| --- | --- | --- |
| Background / surface | `--bg: #f7f8f6`; `--surface: #fff`; `--surface-subtle: #f1f4f1` | Calm neutral canvas, cards, and quiet groups |
| Text | `--text: #1f2825`; `--muted-strong: #4d5a54`; `--muted: #66736d` | Primary copy, supporting copy, helper text |
| Border | `--border: #dce3de`; `--border-strong: #bfcbc3` | Quiet dividers and form controls |
| Accent | `--accent: #287a68`; `--accent-strong: #1c5b4d`; `--accent-soft: #e4f0ec` | One restrained action color, active state, allowed/open labels |
| Semantic states | `--success`, `--warning`, `--danger`, `--info` plus `*-soft` backgrounds | Text-labelled success, warning, blocked, pending, and recovery states |
| Focus | `--focus: #116bff` | 3px visible keyboard focus ring |
| Radius | `--radius-sm: 8px`; `--radius-md: 14px`; `--radius-lg: 22px` | Controls, cards, home/demo hero |
| Spacing | `--space-1` through `--space-9` (4px → 56px) | Consistent breathing room and responsive stacking |
| Type | `--text-xs: 12px`; `--text-sm: 14px`; `--text-md: 16px`; `--text-lg: 20px`; `--text-xl: 28px`; `--text-2xl: 42px` | Neutral sans-serif hierarchy |

Working surfaces use the system sans stack (`Inter`, `ui-sans-serif`, `system-ui`, `Segoe UI`) and one accent. Expressive treatment is limited to first-run spacing and hero scale; the research desk remains tool-like.
