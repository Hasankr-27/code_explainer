# Code Explainer

A pure front-end web app that parses source code in the browser and visualises its structure — classes, methods, fields, relationships, and an interactive class diagram.  No backend, no API key, no build step required.

## Features

- **Drag-and-drop** or browse to upload one or more files
- **Supported languages:** Python · JavaScript · Java · C#
- **Structure tab** — class cards with fields, methods, return types, and object-creation calls
- **Relations tab** — inheritance, interface implementation, and instantiation map
- **Diagram tab** — interactive SVG class diagram, draggable nodes
- **EN / TR** language toggle
- **Syntax highlighting** via highlight.js (all four languages)
- Max file size: 50 KB per file

## Usage

No installation needed.  Just open `index.html` in any modern browser:

```
open index.html          # macOS
start index.html         # Windows
xdg-open index.html      # Linux
```

Or serve it with any static file server:

```bash
npx serve .
# → http://localhost:3000
```

## Project Structure

```
code_explainer/
├── index.html   # Single-page app shell
├── style.css    # All styles (dark theme)
└── app.js       # Parsers + rendering logic (~2 000 lines, no dependencies)
```

`app.js` is self-contained vanilla JavaScript.  External CDN dependencies (loaded via `<script>` tags) are limited to **highlight.js** for syntax colouring and **Google Fonts** for typography.

## Parsers

Each language has its own regex-based static parser that runs entirely in the browser:

| Language   | Classes | Methods | Fields / Properties | Imports     |
|------------|---------|---------|---------------------|-------------|
| Python     | ✓       | ✓       | `self.x`, annotations | `import`, `from … import` |
| JavaScript | ✓       | ✓       | Class fields        | `import`, `require` |
| Java       | ✓       | ✓       | Field declarations  | `import`    |
| C#         | ✓ (class, interface, enum, struct, record, abstract) | ✓ | Fields + properties | `using` |

## License

MIT
