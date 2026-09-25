---
name: sample-skill
description: Fixture covering the Markdown features SKILL.md files use in practice.
---

# Sample Skill

Use this skill when you need to *process* PDFs with **pdfplumber** & friends.
Special chars: 5 < 6 > 4, "quotes", 'single', &amp; literal, 100% done, a\b.

<script>alert("xss")</script>
<img src="https://example.com/x.png" onerror="alert(1)">
<details><summary>Click</summary>hidden?</details>
<!-- an HTML comment that must disappear -->

## Quick start

1. Install the package
2. Run the script:

```bash
pip install pdfplumber
python -c "print('<ok>')"
	indented_with_tab()
```

- Supports `inline <code>` spans
- Nested:
  - child item with [a link](https://github.com/anthropics/skills)
- [x] finished task
- [ ] open task

> Note: keep **originals**.
> Second line.

| Tool | Purpose |
|------|:-------:|
| pdfplumber | text \| tables |
| pypdf | merge |

---

![diagram](images/diagram.png) and <https://example.com/auto?a=1&b=2>
~~deprecated~~ __strong__ _em_ snake_case_word
