"""Every path this box's own docs name is a link, and every relative link lands on a tracked file.

Red first (2026-11-24): README's Files table and REFERENCES.md named `OBJECTIVES.md`, `specs/`, `~/vibetracks`, ... as
code, never as links. Zach, Daily Note Nov 24 "# Vibe tracks agent feedback": "/rate bad these files should have been
linked...". The rule this holds: anything a reader could open is one click away.

What counts as naming a path: a `code span` (outside a fenced block and outside a link's text) that is a tracked file
or folder of this repo (a `<placeholder>` tail like `solutions/<id>/` reads as its folder), or that starts with `~/<name>`
(a folder on Zach's machine, which must link to where a reader can open it, e.g. its GitHub repo; `~/.cache` and
other dot paths are machine state with nothing to open).

WHY OBJECTIVES.md and specs/ are exempt: they are the frozen ruler v1 (sha256 in ruler/manifest.json, `vta verify`);
they gain links only through a ruler bump. Lift this into `blackbox check` so every box gets it (the feedback sent to
the blackbox agent the same night).
"""

from __future__ import annotations

import re
import subprocess
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
FROZEN = re.compile(r"^(OBJECTIVES\.md|specs/.*)$")
FENCE = re.compile(r"^(```|~~~).*?^\1[^\n]*$", re.M | re.S)
LINK = re.compile(r"!?\[((?:[^\[\]]|\[[^\]]*\])*)\]\(([^)\s]+)(?:\s+\"[^\"]*\")?\)")
CODE = re.compile(r"`([^`\n]+)`")
SCHEME = re.compile(r"^[a-z][a-z0-9+.-]*:", re.I)


def tracked() -> set[str]:
    out = subprocess.run(["git", "-C", str(REPO), "ls-files"], capture_output=True, text=True, check=True).stdout
    return set(out.splitlines())


def folders(files: set[str]) -> set[str]:
    return {"/".join(f.split("/")[:i]) + "/" for f in files for i in range(1, f.count("/") + 1)}


def as_path(span: str, doc_dir: str, files: set[str], dirs: set[str]) -> str | None:
    """The tracked path a code span names (relative to the repo root or to the doc's folder), else None."""
    name = span.split("<")[0].strip()
    if not name or " " in name or name.startswith(("-", "/")):
        return None
    for base in ("", doc_dir):
        cand = (base + name) if base else name
        if cand in files or cand in dirs or (cand + "/") in dirs:
            return cand
    return None


def problems_in(doc: str, text: str, files: set[str], dirs: set[str]) -> list[str]:
    out = []
    doc_dir = doc.rsplit("/", 1)[0] + "/" if "/" in doc else ""
    body = FENCE.sub(lambda m: "\n" * m.group(0).count("\n"), text)
    linked = [(m.start(), m.end()) for m in LINK.finditer(body)]

    def line(pos: int) -> int:
        return body.count("\n", 0, pos) + 1

    for m in CODE.finditer(body):
        if any(a <= m.start() < b for a, b in linked):
            continue
        span = m.group(1)
        if re.match(r"~/[^.\s]", span):  # WHY not ~/.cache, ~/.gitconfig: machine state, nothing to open
            out.append(f"{doc}:{line(m.start())}: names {span!r} (a folder on this machine) without linking it")
        elif (path := as_path(span, doc_dir, files, dirs)) is not None:
            out.append(f"{doc}:{line(m.start())}: names {span!r} without linking it (link {path})")
    for m in LINK.finditer(body):
        target = m.group(2)
        if SCHEME.match(target) or target.startswith("#"):
            continue
        parts: list[str] = []
        for piece in (doc_dir + target.split("#")[0]).split("/"):
            if piece == "..":
                if parts:
                    parts.pop()
                else:
                    parts.append("..")
            elif piece not in ("", "."):
                parts.append(piece)
        resolved = "/".join(parts)
        if resolved not in files and (resolved + "/") not in dirs:
            out.append(f"{doc}:{line(m.start())}: link {target!r} lands on no tracked file")
    return out


def test_every_path_the_docs_name_is_a_link():
    files = tracked()
    dirs = folders(files)
    docs = sorted(f for f in files if f.endswith(".md") and not FROZEN.match(f))
    assert docs, "no docs found: the check would pass on nothing"
    problems = []
    for doc in docs:
        problems += problems_in(doc, (REPO / doc).read_text(), files, dirs)
    assert not problems, f"{len(problems)} unlinked or broken:\n" + "\n".join(problems)


def test_the_check_catches_what_it_is_for():
    """The ruler goes red on the exact miss it exists for, and green on the fix (a check that can fail)."""
    files = {"OBJECTIVES.md", "specs/S1.1-a.md", "README.md"}
    dirs = folders(files)
    red = "| `OBJECTIVES.md` | the outside view |\n| `specs/` | notes |\nBuilds on `~/vibetracks`.\n[gone](nope.md)\n"
    found = problems_in("README.md", red, files, dirs)
    assert len(found) == 4, found
    green = ("| [`OBJECTIVES.md`](OBJECTIVES.md) | the outside view |\n| [`specs/`](specs/) | notes |\n"
             "Builds on [vibetracks](https://github.com/zacharyyamaoka/vibetracks).\n"
             "```bash\nls ~/vibetracks specs/\n```\n`vta verify` and `meta.json` are not paths here.\n")
    assert problems_in("README.md", green, files, dirs) == []
