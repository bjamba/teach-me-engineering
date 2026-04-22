# ML/AI Engineering Foundations

A self-paced curriculum for building ML/AI engineering skills from first principles.

## How to use this

1. **Start here:** open `dashboard.html` in your browser (just double-click it).
2. Work through the modules in order. Each lesson is a standalone HTML file — open it like a webpage.
3. Exercises are either interactive HTML pages or Jupyter notebooks. Run the notebooks with `jupyter lab`.
4. To resume with Claude as a tutor, run `/teach-me` from this directory in Claude Code.

## What's inside

| Module | Focus | Status |
|---|---|---|
| 1. Mathematical Foundations | Linear algebra, calculus, gradients | Ready |
| 2. Statistics & Probability | Distributions, inference, bias/variance | Ready |
| 3. Classical ML | Regression, trees, boosting, evaluation | Ready |
| 4. Feature Engineering & Unsupervised | Feature crafting, clustering, PCA | Roadmap |
| 5. Deep Learning Foundations | Neural nets, backprop, PyTorch | Roadmap |
| 6. Modern AI | Transformers, LLMs, fine-tuning, RAG | Roadmap |
| 7. MLOps | FastAPI, Docker, AWS deploy, monitoring | Roadmap |
| 8. Capstone | Portfolio projects | Roadmap |

Modules 4–8 start as roadmap pages. Claude builds them out on arrival — that way the content stays fresh and adapts to what has already been covered.

## Timeline & Cost

**1–2 hours/day → ~4–6 months** to complete the full curriculum at that pace.

**Free.** Everything in this repo runs in your browser or with free tools (Python, numpy, scikit-learn, PyTorch, Jupyter).

**Optional extras** (pick what you want, when you want):
- **Google Colab** (free GPU for deep learning) — sign in with Google, no setup.
- **GitHub** (free) — host capstone projects and build a portfolio.
- **AWS Lambda free tier** — used in the MLOps module for model deployment.
- **Hugging Face** (free) — for downloading pretrained models later.

If you ever want GPU time beyond Colab, Modal, RunPod, or Lambda Labs start at a few cents/hour.

## Running Jupyter notebooks

```bash
pip install jupyterlab numpy pandas scikit-learn matplotlib seaborn
jupyter lab
```

For deep learning modules (5+), also install:

```bash
pip install torch torchvision transformers
```

## Progress tracking

The dashboard tracks progress in `localStorage` (per-browser). The authoritative record is `curriculum.json` — Claude updates it at the end of each tutoring session.

## Credits

All external sources (images, datasets, references) are credited in `credits.html`.
