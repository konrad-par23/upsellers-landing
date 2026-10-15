# Upsellers — landing (KV02 v3 · people)

Static landing page built from the Paper file "Upsellers" (artboard *Simple flow (KV02 v3 · people)*), plus the boards *KV02 — Motion & interaction notes* and *KV02 v3 — Chapter nav states*.

Plain HTML, CSS and JS. No build step.

```bash
python3 -m http.server 4173
```

## Files

- `index.html`: markup for the four sections (hero, 01 gain, 02 setup, 03 go live)
- `styles.css`: tokens, layout, responsive rules (≤1320, ≤1100, ≤900, ≤760), reduced motion
- `main.js`: chapter nav, hero depth carousel, calculator, bar reveal, setup timeline with micro-demos, aurora pause
- `assets/`: merchant photos and the serum product shot, exported from Paper

## To confirm before launch

- Link targets: `#early-access`, `#sign-in`, `#privacy` and `#terms` are placeholders.
- Bar tooltip copy and its "Source: …" lines are draft text.
