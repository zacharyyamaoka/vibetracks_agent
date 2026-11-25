#!/usr/bin/env python3
"""The acceptance run's fixture (OBJECTIVES §7), seeded: dev = seed 1, holdout = seed 2.

    python3 ruler/fixture.py --seed 1 --home <temp HOME> --bin <dir for the fake gh> --state <dir outside HOME>
                             --blackbox-repo ~/blackbox_agent --blackbox-ref <frozen sha> --out <fixture.json>

Makes, inside a temporary HOME that holds nothing else:
- N black-box agent repos (the blackbox_agent format at the frozen ref: its README format table plus template/), each a
  git repo with one commit dated at its activity time, with a known title, state (status.json `status`), agents
  working (agents/<name>.md `status: working`), waits (ideas.md "## Suggestions for Zach", mirrored in
  site/data/state.json `needs`), feedback notes (feedback/*.md) and a site (site/index.html with a marker text; one
  box has no site/). Every file's mtime, the commit dates, status.json `updated_t` and the ledger row's `t` are the
  box's activity time, so "last updated" reads the same whichever of them a version uses.
- the parent tree those boxes form (fixture.json `boxes[].parent`, siblings in manual order); the ruler hands it to the
  version under test through that version's own CLI (ruler/stage.py), never by writing a Vibe Tracks file;
- one more box that is not in the tree (S1.5's `vt add`), and a plain folder that is not a box;
- (ruler v3) six **package** boxes: a parent with two sub-tracks and a grandchild, and two top-level leaves
  (fixture.json `package_boxes`):
  boxes whose Pages workflow builds the site with the blackbox_agent package, as Zach's boxes do since blackbox-agent
  0.1 (2026-11-24), so a version builds them with its own `blackbox build` and the real dashboard viewer loads (S1.6).
  They commit no site/; each one's objective name (OBJECTIVES.md) is its marker, which its built landing and dashboard
  both show. Not in the tree: the fold and speed groups add them with `vt add`, so every v2 group runs as it did;
- `~/blackbox_agent`: blackbox_agent at the frozen ref (README.md, template/, tools/apply_template.py), a git repo, so
  a `vt new` that copies the starter box works offline;
- `~/.gitconfig` (a fixture person), and a fake `gh` in --bin that records its arguments and plays signed in or out.

Box titles are drawn from a pool split by seed, so dev and holdout never share a name; depths, counts and activity
times come from the seed. Two runs with one seed write the same bytes (git objects included).
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import random
import re
import stat
import subprocess
import sys
from pathlib import Path

PERSON = {"name": "Fixture Person", "email": "owner@example.com"}
BIRDS = ["Kestrel", "Plover", "Heron", "Avocet", "Dunlin", "Merlin", "Godwit", "Shrike", "Linnet", "Bittern",
         "Curlew", "Ouzel", "Petrel", "Sanderling", "Whimbrel", "Wagtail", "Siskin", "Garganey", "Redshank", "Brambling",
         "Pipit", "Turnstone", "Gannet", "Fulmar", "Grebe", "Dotterel", "Smew", "Twite", "Bunting", "Nuthatch",
         "Waxwing", "Treecreeper", "Shoveler", "Stint", "Skua", "Kittiwake", "Ptarmigan", "Wigeon", "Chiffchaff", "Coot"]
TOPICS = ["Grasp", "Sort", "Reach", "Vision", "Gripper", "Conveyor", "Calibration", "Bin", "Sensor", "Motion",
          "Planner", "Camera", "Belt", "Pick", "Wrist", "Torque", "Thermal", "Lidar", "Suction", "Fleet"]
STATES = ("working", "blocked", "idle", "done")
TEMPLATE_FILES = (".github/workflows/pages.yml", "site/nav.json", "tests/test_readme_landing_link.py")
# The blackbox_agent README's format table ("one box = one repo"), files only (a folder with no file has no place in git)
# The package's own Pages workflow (blackbox-agent 0.1.12 scaffold/github/workflows/pages.yml, as vendored in vibetracks
# 940b507): the line a version reads to know the box builds with the package (vibetracks PEP 0028 "package").
PACKAGE_WORKFLOW = """name: pages
on: {push: {branches: [main]}, workflow_dispatch: {}}
permissions: {contents: read, pages: write, id-token: write}
jobs:
  site:
    uses: zacharyyamaoka/blackbox_agent/.github/workflows/site.yml@v0
    secrets: {CLOUDFLARE_API_TOKEN: "${{ secrets.CLOUDFLARE_API_TOKEN }}", CLOUDFLARE_ACCOUNT_ID: "${{ secrets.CLOUDFLARE_ACCOUNT_ID }}"}
"""
FORMAT_FILES = ("README.md", "OBJECTIVES.md", "AGENTS.md", "PROGRESS.md", "ledger.jsonl", "ideas.md", "REFERENCES.md",
                "status.json")
STARTER_FILES = tuple(sorted(FORMAT_FILES + TEMPLATE_FILES))


def iso(t: dt.datetime) -> str:
    return t.astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def slugify(title: str, sep: str = "_") -> str:
    return re.sub(r"[^a-z0-9]+", sep, title.lower()).strip(sep)


def git(cwd: Path, *args: str, env: dict | None = None, check: bool = True) -> str:
    out = subprocess.run(["git", "-C", str(cwd), *args], capture_output=True, text=True, env=env)
    if check and out.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} in {cwd}: {out.stderr.strip()}")
    return out.stdout.strip()


def git_env(home: Path, when: dt.datetime) -> dict:
    stamp = f"{int(when.timestamp())} +0000"
    return {"PATH": "/usr/bin:/bin", "HOME": str(home), "LANG": "C.UTF-8", "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_AUTHOR_NAME": PERSON["name"], "GIT_AUTHOR_EMAIL": PERSON["email"], "GIT_AUTHOR_DATE": stamp,
            "GIT_COMMITTER_NAME": PERSON["name"], "GIT_COMMITTER_EMAIL": PERSON["email"], "GIT_COMMITTER_DATE": stamp}


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


def commit_all(folder: Path, home: Path, when: dt.datetime, message: str) -> str:
    env = git_env(home, when)
    git(folder, "init", "-q", "-b", "main", env=env)
    git(folder, "add", "-A", env=env)
    git(folder, "commit", "-q", "-m", message, env=env)
    return git(folder, "rev-parse", "HEAD", env=env)


def touch_tree(folder: Path, when: dt.datetime) -> None:
    stamp = when.timestamp()
    for path in sorted(folder.rglob("*")):
        if ".git" in path.relative_to(folder).parts:
            continue
        os.utime(path, (stamp, stamp), follow_symlinks=False)
    os.utime(folder, (stamp, stamp))


# ── the plan: which boxes, in which tree, with which facts ──────────────────────────────────────────────────────


def plan(seed: int) -> dict:
    """Pure: the seed's boxes and tree. Every role a check needs is present in every seed."""
    rng = random.Random(seed * 7919)
    pool = BIRDS[((seed - 1) * 20) % len(BIRDS):][:20]
    rng.shuffle(pool)
    topics = TOPICS[:]
    rng.shuffle(topics)
    # 40 distinct titles: each bird with its own topic, then each bird with the next topic
    titles = [f"{pool[i % 20]} {topics[(i + i // 20) % 20]} Agent" for i in range(40)]
    boxes: list[dict] = []

    def add(parent: dict | None, state: str, agents: int = 0, *roles: str) -> dict:
        title = titles[len(boxes)]
        box = {"title": title, "slug": slugify(title), "parent": parent["slug"] if parent else None, "state": state,
               "agents": agents, "roles": list(roles), "waits": [], "feedback": [], "site": True}
        boxes.append(box)
        return box

    # S3.4: a parent whose children are blocked (2 agents) and working (1 agent): a pip and 3 agents
    rollup = add(None, "idle", 0, "rollup_parent")
    add(rollup, "blocked", 2, "rollup_blocked")
    add(rollup, "working", 1, "rollup_working")
    for _ in range(rng.randint(0, 1)):
        add(rollup, "idle", 0)
    # a chain for depth (S2.7's indents, S2.8's own-subtree refusal)
    chain_depth = rng.randint(2, 4)
    parent = None
    for level in range(chain_depth):
        parent = add(parent, "working" if level == 0 else rng.choice(["idle", "working"]), 1 if level == 0 else 0,
                     *(["chain"] if level else ["chain_top"]))
    # siblings under the chain's top (S2.8 reorder between two rows)
    chain_top = next(b for b in boxes if "chain_top" in b["roles"])
    for _ in range(rng.randint(1, 2)):
        add(chain_top, rng.choice(["idle", "done"]), 0, "chain_sibling")
    # top-level leaves; one has no site (S1.1)
    for i in range(rng.randint(2, 4)):
        add(None, rng.choice(["idle", "working"]) if i else "idle", 0, *(["nosite"] if i == 0 else ["top_leaf"]))
    # done boxes, some nested (S3.1 Done preset)
    for i in range(rng.randint(2, 3)):
        add(rollup if i == 1 else None, "done", 0, "done_box")
    next(b for b in boxes if "nosite" in b["roles"])["site"] = False

    # waits (S3.2): two boxes, one each, never a done box
    open_boxes = [b for b in boxes if b["state"] != "done"]
    for n, box in enumerate(rng.sample(open_boxes, 2)):
        token = hashlib.sha256(f"{seed}-wait-{n}".encode()).hexdigest()[:6]
        box["waits"].append(f"Decide the {box['title'].split()[1].lower()} limits for {box['title'].split()[0]} "
                            f"(wait {token})")
    # feedback (S3.3): two boxes, 1-2 notes each
    for n, box in enumerate(rng.sample([b for b in boxes if b["site"]], 2)):
        for k in range(rng.randint(1, 2)):
            token = hashlib.sha256(f"{seed}-fb-{n}-{k}".encode()).hexdigest()[:6]
            box["feedback"].append({"title": f"{box['title'].split()[0]} feedback {token}",
                                    "body": f"The {box['title'].split()[1].lower()} run felt slow (note {token}).",
                                    "added": f"2026-11-{10 + 3 * n + k:02d}", "token": token})
    # activity: distinct minutes between Nov 10 and Nov 24 (UTC), in a seeded order
    base = dt.datetime(2026, 11, 10, 0, 0, tzinfo=dt.timezone.utc)
    minutes = rng.sample(range(0, 14 * 24 * 60, 7), len(boxes))
    for box, minute in zip(boxes, minutes):
        box["activity"] = iso(base + dt.timedelta(minutes=minute))
        token = hashlib.sha256((str(seed) + box['slug']).encode()).hexdigest()[:8]
        box["marker"] = f"VTA site marker {box['slug']} {token}"
        box["readme_marker"] = f"VTA readme marker {box['slug']} {token}"

    extra_title = f"{titles[len(boxes)]}"
    extra = {"title": extra_title, "slug": slugify(extra_title), "parent": None, "state": "idle", "agents": 0,
             "roles": ["extra"], "waits": [], "feedback": [], "site": True,
             "activity": iso(base + dt.timedelta(days=13, hours=5)),
             "marker": f"VTA site marker {slugify(extra_title)} extra{seed}",
             "readme_marker": f"VTA readme marker {slugify(extra_title)} extra{seed}"}
    new_titles = {key: f"{titles[len(boxes) + 1 + i]}" for i, key in
                  enumerate(["s41", "s41_from", "s43_local", "s43_out", "s43_in", "s42", "s44"])}
    plain = f"plain_folder_{hashlib.sha256(f'plain{seed}'.encode()).hexdigest()[:6]}"
    latest = max(dt.datetime.fromisoformat(b["activity"].replace("Z", "+00:00")) for b in boxes)
    package = package_plan(seed, titles[len(boxes) + 1 + len(new_titles):], latest)
    return {"seed": seed, "boxes": boxes, "extra": extra, "new_titles": new_titles, "plain_folder": plain,
            "package_boxes": package,
            "s15_parent": next(b for b in boxes if "top_leaf" in b["roles"])["slug"],
            "section_name": f"Section {pool[-1]}"}


def package_plan(seed: int, titles: list[str], latest: dt.datetime) -> list[dict]:
    """Ruler v3: the six package boxes, from their own random stream (the boxes above draw exactly as in v2, so every
    v2 box, title and marker is unchanged), and two top-level leaves (S1.6: six package boxes, the kind every box of
    Zach's is, so open_ms has six of them a round). A parent (S2.9: two sub-tracks, one with a sub-track of its own; S3.4: a
    blocked one with 2 agents and a working one with 1 below it) whose activity is newer than every box above (`latest`
    is theirs) and, in both seeds, older than the extra box, so whichever order a version sorts by, a row sits below its
    subtree once the extra box is added after it."""
    rng = random.Random(seed * 104729 + 3)
    boxes: list[dict] = []

    def add(parent: dict | None, state: str, agents: int, *roles: str) -> dict:
        title = titles[len(boxes)]
        slug = slugify(title)
        token = hashlib.sha256(f"{seed}-package-{slug}".encode()).hexdigest()[:8]
        box = {"title": title, "slug": slug, "parent": parent["slug"] if parent else None, "state": state,
               "agents": agents, "roles": ["package", *roles], "waits": [], "feedback": [], "site": False,
               "kind": "package", "marker": f"vta_page_{token}", "readme_marker": f"VTA readme marker {slug} {token}"}
        boxes.append(box)
        return box

    top = add(None, "idle", 0, "pkg_parent")
    middle = add(top, "blocked", 2, "pkg_child", "pkg_blocked")
    add(middle, "working", 1, "pkg_grandchild")
    add(top, "idle", 0, "pkg_child")
    add(None, rng.choice(["idle", "working"]), 0, "pkg_leaf")
    add(None, rng.choice(["idle", "working"]), 0, "pkg_leaf")
    # 10-400 minutes after the newest box above (seed 1: Nov 22 04:29; seed 2: Nov 21 19:09), so before the extra box's
    # Nov 23 05:00; the parent newest, the leaves oldest
    minutes = sorted(rng.sample(range(10, 400), len(boxes)), reverse=True)
    for box, minute in zip(boxes, minutes):
        box["activity"] = iso(latest + dt.timedelta(minutes=minute))
    return boxes


def preorder(boxes: list[dict]) -> list[dict]:
    kids: dict = {}
    for b in boxes:
        kids.setdefault(b["parent"], []).append(b)
    out: list[dict] = []

    def walk(parent: str | None) -> None:
        for b in kids.get(parent, []):
            out.append(b)
            walk(b["slug"])

    walk(None)
    return out


# ── writing a box ──────────────────────────────────────────────────────────────────────────────────────────────


def template_text(blackbox: Path, ref: str, path: str) -> str:
    return git(blackbox, "show", f"{ref}:template/{path}")


def fill(text: str, box: dict) -> str:
    return text.replace("{{name}}", box["title"]).replace("{{owner}}", "fixture-owner").replace("{{repo}}", box["slug"])


def write_box(folder: Path, box: dict, seed: int, blackbox: Path, ref: str, home: Path) -> str:
    when = dt.datetime.fromisoformat(box["activity"].replace("Z", "+00:00"))
    title, slug = box["title"], box["slug"]
    write(folder / "README.md",
          f"# {title}\n\n**[▶ Live landing page](https://fixture-owner.github.io/{slug}/)**, redeployed from `main` on "
          f"every push · a black-box agent repo in the [blackbox_agent](https://github.com/zacharyyamaoka/blackbox_agent) "
          f"format\n\nA fixture box for the vibetracks_agent acceptance run (ruler v1, seed {seed}).\n\n{box['readme_marker']}\n")
    if box.get("kind") == "package":
        # WHY the marker is the objective's name: the package's landing and dashboard both print it at the top
        # ("<box> · <objective> (dev, lower is better)"), the box's README never does, nor does a "building" page
        write(folder / "OBJECTIVES.md", f"# Objectives & Gates\n\n**Objective (one number, lower is better): "
                                        f"`{box['marker']}`**, target 0.\n")
    else:
        write(folder / "OBJECTIVES.md", f"# Objectives & Gates\n\nObjective: `fixture_metric`, lower is better, target 0.\n")
    write(folder / "AGENTS.md", "# How an agent works here\n\nRead OBJECTIVES.md, propose, evaluate, commit.\n")
    write(folder / "PROGRESS.md", f"# Progress\n\nGenerated from ledger.jsonl. Last activity {box['activity']}.\n")
    write(folder / "REFERENCES.md", "# References\n\n- blackbox_agent: the format.\n")
    tries = "- [ ] **Try a smaller step.** Expect the metric to drop.\n"
    asks = "".join(f"- [ ] **{w}**\n" for w in box["waits"])
    write(folder / "ideas.md", f"# Ideas\n\n## I'll try\n\n{tries}\n## Suggestions for Zach\n\n{asks}")
    write(folder / "ledger.jsonl", json.dumps({"t": box["activity"], "solution": "s1", "parent": None, "split": "dev",
                                               "ruler": "v1", "objective": round(1.0 + (len(slug) % 7) / 10, 2),
                                               "admissible": True}, separators=(",", ":")) + "\n")
    write(folder / "status.json", json.dumps({
        "schema": "ai-team-status/1", "member": title, "team": "Fixture Team",
        "remit": f"fixture box {slug}", "kpi": {"name": "fixture_metric", "value": 1.0, "unit": "", "direction": "down",
                                               "target": 0, "level": None, "level_name": None, "next_gate": None,
                                               "on_track": None},
        "counter_kpi": None, "status": box["state"], "blocked_on": None,
        "todo": {"open": 1, "done_7d": 0, "top": ["Try a smaller step."]},
        "links": {"repo": f"https://github.com/fixture-owner/{slug}", "report": "PROGRESS.md"},
        "updated_t": when.timestamp()}, indent=2) + "\n")
    write(folder / "specs" / "O1.1-fixture.md", "---\nid: O1.1\nkind: shall\ntests: []\n---\n# O1.1 The fixture metric\n")
    for note in box["feedback"]:
        write(folder / "feedback" / f"{note['added']}-{note['token']}.md",
              f"---\nid: fb-{note['token']}\npolarity: negative\nadded: {note['added']}\nfrom: Zach\n---\n"
              f"# {note['title']}\n\n{note['body']}\n")
    for n in range(box["agents"]):
        write(folder / "agents" / f"agent-{n + 1}.md",
              f"---\nagent: claude-code\nmodel: claude-opus-5-5\nstatus: working\nstarted: {box['activity']}\n---\n"
              f"# Agent {n + 1}\n")
    write(folder / "solutions" / "s1" / "meta.json", json.dumps({
        "id": "s1", "parent": None, "change": "first", "proposed_by": {"agent": "fixture", "model": None},
        "created": box["activity"]}, indent=2) + "\n")
    for path in TEMPLATE_FILES:
        write(folder / path, fill(template_text(blackbox, ref, path), box))
    if box.get("kind") == "package":
        write(folder / ".github" / "workflows" / "pages.yml", PACKAGE_WORKFLOW)
    if box["site"]:
        write(folder / "site" / "index.html",
              f"<!doctype html>\n<html><head><meta charset=\"utf-8\"><title>{title}</title></head>\n<body>\n"
              f"<h1>{title}</h1>\n<p id=\"vta-marker\">{box['marker']}</p>\n</body></html>\n")
        write(folder / "site" / "data" / "state.json", json.dumps({
            "schema": "bb-state/1", "box": title, "ref": None, "read_at": box["activity"],
            "about": {"repo": slug, "url": None, "site": None, "remit": f"fixture box {slug}"},
            "needs": [{"ask": w, "text": w, "source": "ideas.md", "section": "Suggestions for Zach", "kind": "decision"}
                      for w in box["waits"]],
            "feedback": [{"path": f"feedback/{n['added']}-{n['token']}.md", "title": n["title"], "from": "Zach",
                          "polarity": "negative", "date": n["added"]} for n in box["feedback"]],
            "agents": {"registered": box["agents"], "backfilled": 0, "proposers": []},
            "activity": {"rows": 1, "backfilled": True, "recent": [{"t": box["activity"], "kind": "ledger"}]}},
            indent=1) + "\n")
    touch_tree(folder, when)
    head = commit_all(folder, home, when, f"{title}: fixture box (seed {seed})")
    touch_tree(folder, when)
    return head


def write_blackbox(home: Path, blackbox: Path, ref: str) -> dict:
    """~/blackbox_agent at the frozen ref, reduced to what a starter copy reads: README.md, template/, the apply tool."""
    dest = home / "blackbox_agent"
    archive = subprocess.run(["git", "-C", str(blackbox), "archive", ref, "README.md", "template",
                              "tools/apply_template.py"], capture_output=True, check=True)
    dest.mkdir(parents=True)
    subprocess.run(["tar", "-x", "-C", str(dest)], input=archive.stdout, check=True)
    when = dt.datetime.fromtimestamp(int(git(blackbox, "show", "-s", "--format=%ct", ref)), dt.timezone.utc)
    touch_tree(dest, when)
    head = commit_all(dest, home, when, f"blackbox_agent at {ref[:7]} (README.md, template/, tools/apply_template.py)")
    return {"path": str(dest), "ref": ref, "head": head}


FAKE_GH = r'''#!/usr/bin/env python3
"""A fake `gh` for the acceptance run (ruler/fixture.py): records every call, plays signed in or out, and makes a
local bare repo for `repo create` (pushing there with --push). Nothing leaves the machine."""
import json, os, subprocess, sys, time
LOG, STATE, REMOTES = __LOG__, __STATE__, __REMOTES__
args = sys.argv[1:]
with open(LOG, "a", encoding="utf-8") as fh:
    fh.write(json.dumps({"t": time.time(), "args": args, "cwd": os.getcwd()}) + "\n")
try:
    signed_in = open(STATE, encoding="utf-8").read().strip() == "in"
except OSError:
    signed_in = False
if args[:2] == ["auth", "status"]:
    if signed_in:
        print("github.com\n  ✓ Logged in to github.com account fixture-owner (keyring)")
        sys.exit(0)
    print("You are not logged into any GitHub hosts. To log in, run: gh auth login", file=sys.stderr)
    sys.exit(1)
if not signed_in:
    print("To get started with GitHub CLI, please run:  gh auth login", file=sys.stderr)
    sys.exit(4)
if args[:2] == ["repo", "create"]:
    rest = args[2:]
    name = next((a for a in rest if not a.startswith("-")), "repo")
    source = rest[rest.index("--source") + 1] if "--source" in rest and rest.index("--source") + 1 < len(rest) else None
    for a in rest:
        if a.startswith("--source="):
            source = a.split("=", 1)[1]
    bare = os.path.join(REMOTES, name.split("/")[-1] + ".git")
    subprocess.run(["git", "init", "-q", "--bare", bare], check=True)
    if source:
        subprocess.run(["git", "-C", source, "remote", "add", "origin", bare], check=False)
        if "--push" in rest:
            subprocess.run(["git", "-C", source, "push", "-q", "-u", "origin", "HEAD"], check=False)
    print("https://github.com/fixture-owner/" + name.split("/")[-1])
    sys.exit(0)
if args[:2] == ["api", "user"]:
    print(json.dumps({"login": "fixture-owner"}))
    sys.exit(0)
print("fake gh: not supported here: " + " ".join(args), file=sys.stderr)
sys.exit(1)
'''


def write_fake_gh(bin_dir: Path, state_dir: Path) -> dict:
    bin_dir.mkdir(parents=True, exist_ok=True)
    (state_dir / "gh-remotes").mkdir(parents=True, exist_ok=True)
    paths = {"log": str(state_dir / "gh-calls.jsonl"), "state": str(state_dir / "gh-state"),
             "remotes": str(state_dir / "gh-remotes")}
    Path(paths["state"]).write_text("out\n")
    Path(paths["log"]).write_text("")
    script = (FAKE_GH.replace("__LOG__", repr(paths["log"])).replace("__STATE__", repr(paths["state"]))
              .replace("__REMOTES__", repr(paths["remotes"])))
    gh = bin_dir / "gh"
    gh.write_text(script)
    gh.chmod(gh.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)
    return {"path": str(gh), **paths}


def build(seed: int, home: Path, bin_dir: Path, state_dir: Path, blackbox: Path, ref: str) -> dict:
    home = home.resolve()
    if home.exists() and any(home.iterdir()):
        raise SystemExit(f"fixture: {home} is not empty")
    home.mkdir(parents=True, exist_ok=True)
    state_dir.mkdir(parents=True, exist_ok=True)
    write(home / ".gitconfig",
          f"[user]\n\tname = {PERSON['name']}\n\temail = {PERSON['email']}\n[init]\n\tdefaultBranch = main\n"
          "[commit]\n\tgpgsign = false\n[safe]\n\tdirectory = *\n")
    p = plan(seed)
    ordered = preorder(p["boxes"])
    for box in ordered:
        folder = home / box["slug"]
        box["path"] = str(folder)
        box["head"] = write_box(folder, box, seed, blackbox, ref, home)
    extra = p["extra"]
    extra["path"] = str(home / extra["slug"])
    extra["head"] = write_box(home / extra["slug"], extra, seed, blackbox, ref, home)
    for box in p["package_boxes"]:
        box["path"] = str(home / box["slug"])
        box["head"] = write_box(home / box["slug"], box, seed, blackbox, ref, home)
    plain = home / p["plain_folder"]
    write(plain / "notes.txt", "A plain folder: not a black-box agent repo.\n")
    return {
        "schema": "vibetracks-agent/fixture-1", "seed": seed, "home": str(home), "person": PERSON,
        "boxes": ordered, "extra": extra, "package_boxes": p["package_boxes"], "plain_folder": str(plain),
        "s15_parent": p["s15_parent"],
        "new_titles": p["new_titles"], "section_name": p["section_name"],
        "starter_files": list(STARTER_FILES), "blackbox": write_blackbox(home, blackbox, ref),
        "gh": write_fake_gh(bin_dir, state_dir),
        "track_naming": "a track is named on the command line by its box folder's basename (its slug)",
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--seed", type=int, required=True)
    parser.add_argument("--home", type=Path, required=True)
    parser.add_argument("--bin", type=Path, required=True)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--blackbox-repo", type=Path, required=True)
    parser.add_argument("--blackbox-ref", required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args(argv)
    data = build(args.seed, args.home, args.bin, args.state, args.blackbox_repo.expanduser(), args.blackbox_ref)
    args.out.write_text(json.dumps(data, indent=1) + "\n")
    print(f"fixture seed {args.seed}: {len(data['boxes'])} boxes in {data['home']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
