# DSA Fluency — Data Structures & Algorithms without the CS Degree

A self-paced, browser-native curriculum for engineers who don't have a formal computer-science background but want FAANG-interview-level fluency in data structures and algorithms.

## Why this exists

Most DSA material is one of two things:

1. **A textbook** — rigorous and complete, but written in a register that assumes you've already taken Algorithms 101.
2. **A LeetCode grind list** — practical, but offers no theory, no metaphors, no through-line.

This course is the third thing: rigorous from first principles, but written for someone who builds production software for a living and wants the *concepts* in their bones, not just the patterns.

Every concept comes with:

- **A real-world metaphor** so you can think about it without code
- **An animated visualization** that runs in the page
- **A working code editor** with Python, JavaScript, and TypeScript tabs and test cases
- **A "what they'll ask in the interview" callout** translating theory into interview-speak
- **A 📓 button** for capturing your own notes — exportable as Markdown when you're done

## Modules

| # | Module | Status |
|---|---|---|
| 0 | Mental Model — How to Think About Algorithms | Ready |
| 1 | Arrays, Strings, and Hashing — The Workhorses | Ready |
| 2 | Stacks, Queues, Deques | Starter (lesson + drill) |
| 3 | Linked Lists, Trees, and Recursion | Starter |
| 4 | Heaps & Priority Queues | Starter |
| 5 | Graphs — BFS, DFS, Topological Sort | Starter |
| 6 | Searching & Sorting | Starter |
| 7 | Dynamic Programming, Greedy & Backtracking | Starter |

Modules 0 and 1 are fully fleshed out; modules 2–7 ship with one lesson and one drill each, designed to be expanded as you go.

## How to use it

1. Open `dashboard.html` in your browser (or visit it on GitHub Pages).
2. Start at Module 0 — it's the foundation everything else stands on.
3. Read each lesson, play with the visualizations, then run the drills.
4. As you go, hit the floating 📓 button to capture metaphors, gotchas, and rehearsal lines.
5. When you've covered enough ground, open `notebook.html` and download your notes as Markdown.

## Cost & timeline

- **Cost:** Free. The course runs entirely in your browser — Python via Pyodide, TypeScript via the in-browser compiler, no servers, no accounts.
- **Cadence:** Designed for ~5 hr/week. The full course is roughly 3 months at that pace if you do every drill at least twice; 6+ months if you treat the drills as deep practice.

## Stack

- Static HTML/CSS/JS, no build step
- [Pyodide](https://pyodide.org/) for in-browser Python execution
- [TypeScript](https://www.typescriptlang.org/) compiler bundle for in-browser TS transpile
- All visualizations are vanilla JS / SVG (`assets/visualizers.js`)

## Hosting

This course works identically under `file://` and on GitHub Pages. See the repo's [HOSTING.md](../HOSTING.md) for the rules every course in this monorepo follows.

## Notebook export

The `dsa_notes` localStorage key is the source of truth for your captured notes. The notebook page renders them grouped by module and gives you three export formats:

- **Markdown** — the recommended format. Drop it into Obsidian, Notion, Logseq, or just a folder.
- **HTML** — a self-contained page you can open anywhere.
- **JSON** — structured backup if you want to script against your notes later.

## Layout

```
dsa-fluency/
├── dashboard.html               # Course home — start here
├── notebook.html                # Full notebook view + export
├── credits.html                 # Library + font credits
├── curriculum.json              # Source of truth for module/lesson structure
├── README.md                    # You're here
├── assets/
│   ├── styles.css               # Course theme (indigo + amber)
│   ├── code-runner.js           # In-page Python/JS/TS runner with test cases
│   ├── notebook.js              # Floating note widget + full-page exporter
│   └── visualizers.js           # Big-O / array / hashmap / tree / heap / graph viz
├── module-00-mental-model/
│   ├── lesson-01-big-o.html
│   ├── ...
│   └── exercises/
│       ├── drill-01-big-o-classifier.html
│       └── ...
├── module-01-arrays-hashing/
│   └── ...
└── ...
```
