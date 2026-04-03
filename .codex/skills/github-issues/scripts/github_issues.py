#!/usr/bin/env python3
import argparse
import base64
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request


GITHUB_API_VERSION = "2022-11-28"
USER_AGENT = "codex-github-issues-skill"
HTTP_TIMEOUT_SECONDS = 20


def configure_stdio():
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            reconfigure(encoding="utf-8", errors="replace")


def run_git(args, cwd=None, stdin_text=None):
    result = subprocess.run(
        ["git", *args],
        cwd=cwd,
        input=stdin_text,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or result.stdout.strip() or "git command failed")
    return result.stdout.strip()


def parse_repo(remote_url):
    patterns = [
        r"^https://github\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?/?$",
        r"^git@github\.com:(?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?$",
        r"^ssh://git@github\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?/?$",
    ]
    for pattern in patterns:
        match = re.match(pattern, remote_url.strip())
        if match:
            return f"{match.group('owner')}/{match.group('repo')}"
    raise ValueError(f"Unsupported GitHub remote URL: {remote_url}")


def resolve_repo(repo_arg, cwd):
    if repo_arg:
        repo = repo_arg.strip().strip("/")
        if repo.count("/") != 1:
            raise ValueError(f"Invalid repo format: {repo_arg}")
        return repo
    remote_url = run_git(["remote", "get-url", "origin"], cwd=cwd)
    return parse_repo(remote_url)


def get_auth_header(repo):
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if token:
        return {"Authorization": f"Bearer {token}"}, "env-token"

    request_text = f"protocol=https\nhost=github.com\npath={repo}.git\n\n"
    output = run_git(["credential", "fill"], stdin_text=request_text)
    creds = {}
    for line in output.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            creds[key] = value

    username = creds.get("username")
    password = creds.get("password")
    if username and password:
        raw = f"{username}:{password}".encode("ascii", "ignore")
        basic = base64.b64encode(raw).decode("ascii")
        return {"Authorization": f"Basic {basic}"}, "git-credential"

    raise RuntimeError("No GitHub authentication found in env vars or git credential helper.")


def read_text(inline_text, file_path):
    if inline_text and file_path:
        raise ValueError("Use either inline text or a file path, not both.")
    if file_path:
        with open(file_path, "r", encoding="utf-8") as handle:
            return handle.read()
    return inline_text


def normalize_labels(value):
    if not value:
        return None
    return [item.strip() for item in value.split(",") if item.strip()]


def build_headers(auth_headers):
    return {
        **auth_headers,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
    }


def api_request(method, url, auth_headers, payload=None):
    data = None
    headers = build_headers(auth_headers)
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url=url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=HTTP_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API error {exc.code}: {detail}") from exc
    except Exception as exc:
        raise RuntimeError(f"GitHub request failed: {exc}") from exc


def preview_or_execute(args, payload):
    if args.dry_run:
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return True
    return False


def cmd_create(args, repo, auth_headers):
    body = read_text(args.body, args.body_file) or ""
    payload = {"title": args.title, "body": body}
    labels = normalize_labels(args.labels)
    if labels:
        payload["labels"] = labels
    if preview_or_execute(args, {"repo": repo, "action": "create", "payload": payload}):
        return
    issue = api_request("POST", f"https://api.github.com/repos/{repo}/issues", auth_headers, payload)
    print(json.dumps({"action": "create", "number": issue["number"], "url": issue["html_url"], "repo": repo}, ensure_ascii=False))


def cmd_get(args, repo, auth_headers):
    issue = api_request("GET", f"https://api.github.com/repos/{repo}/issues/{args.number}", auth_headers)
    print(
        json.dumps(
            {
                "action": "get",
                "repo": repo,
                "number": issue["number"],
                "state": issue["state"],
                "title": issue["title"],
                "url": issue["html_url"],
                "labels": [label["name"] for label in issue.get("labels", [])],
                "comments": issue.get("comments", 0),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


def cmd_list(args, repo, auth_headers):
    query = {"state": args.state, "per_page": args.limit}
    labels = normalize_labels(args.labels)
    if labels:
        query["labels"] = ",".join(labels)
    url = f"https://api.github.com/repos/{repo}/issues?{urllib.parse.urlencode(query)}"
    issues = api_request("GET", url, auth_headers)
    payload = []
    for issue in issues:
        if "pull_request" in issue:
            continue
        payload.append(
            {
                "number": issue["number"],
                "state": issue["state"],
                "title": issue["title"],
                "url": issue["html_url"],
                "labels": [label["name"] for label in issue.get("labels", [])],
            }
        )
    print(json.dumps({"action": "list", "repo": repo, "count": len(payload), "issues": payload}, ensure_ascii=False, indent=2))


def cmd_comment(args, repo, auth_headers):
    body = read_text(args.body, args.body_file)
    if not body:
        raise ValueError("Comment body is required.")
    payload = {"body": body}
    if preview_or_execute(args, {"repo": repo, "action": "comment", "number": args.number, "payload": payload}):
        return
    comment = api_request(
        "POST",
        f"https://api.github.com/repos/{repo}/issues/{args.number}/comments",
        auth_headers,
        payload,
    )
    print(
        json.dumps(
            {
                "action": "comment",
                "repo": repo,
                "number": args.number,
                "comment_id": comment["id"],
                "url": comment["html_url"],
            },
            ensure_ascii=False,
        )
    )


def cmd_edit(args, repo, auth_headers):
    payload = {}
    if args.title is not None:
        payload["title"] = args.title
    if args.body is not None or args.body_file is not None:
        payload["body"] = read_text(args.body, args.body_file) or ""
    if args.labels is not None:
        payload["labels"] = normalize_labels(args.labels) or []
    if args.state is not None:
        payload["state"] = args.state
    if not payload:
        raise ValueError("At least one editable field is required.")
    if preview_or_execute(args, {"repo": repo, "action": "edit", "number": args.number, "payload": payload}):
        return
    issue = api_request("PATCH", f"https://api.github.com/repos/{repo}/issues/{args.number}", auth_headers, payload)
    print(json.dumps({"action": "edit", "repo": repo, "number": issue["number"], "state": issue["state"], "url": issue["html_url"]}, ensure_ascii=False))


def cmd_change_state(args, repo, auth_headers, state, action_name):
    payload = {"state": state}
    if preview_or_execute(args, {"repo": repo, "action": action_name, "number": args.number, "payload": payload}):
        return
    issue = api_request("PATCH", f"https://api.github.com/repos/{repo}/issues/{args.number}", auth_headers, payload)
    print(json.dumps({"action": action_name, "repo": repo, "number": issue["number"], "state": issue["state"], "url": issue["html_url"]}, ensure_ascii=False))


def build_parser():
    parser = argparse.ArgumentParser(description="Create and manage GitHub issues from local repo context.")
    parser.add_argument("--repo", help="GitHub repository in owner/repo format. If omitted, infer from git origin.")
    parser.add_argument("--cwd", default=".", help="Working directory used to resolve git remote origin.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create", help="Create a new issue.")
    create_parser.add_argument("--title", required=True, help="Issue title.")
    create_parser.add_argument("--body", help="Issue body as inline text.")
    create_parser.add_argument("--body-file", help="Read issue body from a file.")
    create_parser.add_argument("--labels", help="Comma-separated labels.")
    create_parser.add_argument("--dry-run", action="store_true", help="Print payload without calling GitHub.")

    get_parser = subparsers.add_parser("get", help="Fetch an issue by number.")
    get_parser.add_argument("--number", required=True, type=int, help="Issue number.")

    list_parser = subparsers.add_parser("list", help="List issues.")
    list_parser.add_argument("--state", default="open", choices=["open", "closed", "all"], help="Issue state filter.")
    list_parser.add_argument("--labels", help="Comma-separated labels.")
    list_parser.add_argument("--limit", type=int, default=20, help="Maximum number of issues to request.")

    comment_parser = subparsers.add_parser("comment", help="Add a comment to an issue.")
    comment_parser.add_argument("--number", required=True, type=int, help="Issue number.")
    comment_parser.add_argument("--body", help="Comment body as inline text.")
    comment_parser.add_argument("--body-file", help="Read comment body from a file.")
    comment_parser.add_argument("--dry-run", action="store_true", help="Print payload without calling GitHub.")

    edit_parser = subparsers.add_parser("edit", help="Edit an issue.")
    edit_parser.add_argument("--number", required=True, type=int, help="Issue number.")
    edit_parser.add_argument("--title", help="New title.")
    edit_parser.add_argument("--body", help="New body as inline text.")
    edit_parser.add_argument("--body-file", help="Read new body from a file.")
    edit_parser.add_argument("--labels", help="Comma-separated labels. Use empty string to clear.")
    edit_parser.add_argument("--state", choices=["open", "closed"], help="New issue state.")
    edit_parser.add_argument("--dry-run", action="store_true", help="Print payload without calling GitHub.")

    close_parser = subparsers.add_parser("close", help="Close an issue.")
    close_parser.add_argument("--number", required=True, type=int, help="Issue number.")
    close_parser.add_argument("--dry-run", action="store_true", help="Print payload without calling GitHub.")

    reopen_parser = subparsers.add_parser("reopen", help="Reopen an issue.")
    reopen_parser.add_argument("--number", required=True, type=int, help="Issue number.")
    reopen_parser.add_argument("--dry-run", action="store_true", help="Print payload without calling GitHub.")

    return parser


def is_dry_run(args):
    return bool(getattr(args, "dry_run", False))


def resolve_auth_headers(repo, command, dry_run):
    read_only_commands = {"get", "list"}
    if dry_run:
        return {}
    if command in read_only_commands:
        try:
            headers, _source = get_auth_header(repo)
            return headers
        except Exception:
            return {}
    headers, _source = get_auth_header(repo)
    return headers


def main():
    configure_stdio()
    parser = build_parser()
    args = parser.parse_args()
    try:
        repo = resolve_repo(args.repo, args.cwd)
        auth_headers = resolve_auth_headers(repo, args.command, is_dry_run(args))
        if args.command == "create":
            cmd_create(args, repo, auth_headers)
        elif args.command == "get":
            cmd_get(args, repo, auth_headers)
        elif args.command == "list":
            cmd_list(args, repo, auth_headers)
        elif args.command == "comment":
            cmd_comment(args, repo, auth_headers)
        elif args.command == "edit":
            cmd_edit(args, repo, auth_headers)
        elif args.command == "close":
            cmd_change_state(args, repo, auth_headers, "closed", "close")
        elif args.command == "reopen":
            cmd_change_state(args, repo, auth_headers, "open", "reopen")
        else:
            raise ValueError(f"Unsupported command: {args.command}")
        return 0
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
