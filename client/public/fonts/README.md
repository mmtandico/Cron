# Power Type fonts

Drop your licensed Power Type font files here. The stylesheet in
`src/index.css` expects these exact file names:

| File          | Family      | Weight |
| ------------- | ----------- | ------ |
| `bn-r.woff`   | BaseNeue    | 400    |
| `bn-m.woff`   | BaseNeue    | 500    |
| `bn-sm.woff`  | BaseNeue    | 600    |
| `ob-db.woff`  | OffBit Dot  | 700    |
| `ob-b.woff`   | OffBit      | 700    |

`.woff2` versions with the same base name are picked up first if present.

Until the files are added the app falls back to free Google Fonts:
Inter Tight (for BaseNeue) and Doto (for OffBit).
