#!/usr/bin/env python3
"""Build data/posts.json from content/posts/*.md.

This keeps Markdown files as the editable source while the static front end reads
one lightweight JSON index. Requires PyYAML: pip install -r requirements.txt
"""
from pathlib import Path
import json
import re
import sys
import datetime as _dt
try:
    import yaml
except ImportError as exc:
    raise SystemExit("PyYAML is required. Run: python3 -m pip install -r requirements.txt") from exc

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content" / "posts"
OUT = ROOT / "data" / "posts.json"


def parse_markdown(text):
    if not text.startswith('---'):
        raise ValueError('Missing frontmatter delimiter')
    _, fm, body = text.split('---', 2)
    meta = yaml.safe_load(fm) or {}
    sections = []
    current = None
    buffer = []
    def flush():
        nonlocal current, buffer
        if current is None:
            if ''.join(buffer).strip():
                sections.append({'heading': 'Note', 'paragraphs': paragraphs(buffer)})
        else:
            sections.append({'heading': current, 'paragraphs': paragraphs(buffer)})
        buffer = []
    def paragraphs(lines):
        joined = ''.join(lines).strip()
        if not joined:
            return []
        chunks = re.split(r'\n\s*\n', joined)
        return [re.sub(r'\s+', ' ', chunk.strip()) for chunk in chunks if chunk.strip()]
    for line in body.splitlines(True):
        match = re.match(r'^##\s+(.+?)\s*$', line)
        if match:
            if current is not None or buffer:
                flush()
            current = match.group(1).strip()
            buffer = []
        else:
            buffer.append(line)
    if current is not None or buffer:
        flush()
    meta['body'] = sections
    return meta


def normalize(value):
    if isinstance(value, (_dt.date, _dt.datetime)):
        return value.isoformat()[:10]
    if isinstance(value, dict):
        return {str(k): normalize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [normalize(item) for item in value]
    return value

def main():
    posts = []
    for path in sorted(CONTENT.glob('*.md')):
        try:
            post = parse_markdown(path.read_text(encoding='utf-8'))
        except Exception as exc:
            raise SystemExit(f"Could not parse {path}: {exc}") from exc
        if not post.get('id'):
            post['id'] = path.stem
        posts.append(normalize(post))
    posts.sort(key=lambda item: str(item.get('date', '')), reverse=True)
    OUT.write_text(json.dumps({'posts': posts}, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    print(f"Wrote {len(posts)} posts to {OUT.relative_to(ROOT)}")

if __name__ == '__main__':
    main()
