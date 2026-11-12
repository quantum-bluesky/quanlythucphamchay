#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
scripts/run_tests_summary.py
Wrapper chạy test (Python unittest & Playwright integration) với output tinh gọn,
giúp tiết kiệm token context window cho AI Agent và giữ console sạch cho dev.

Tính năng:
- Redirect toàn bộ raw output chi tiết vào file `logs/test-<type>-<timestamp>.log`.
- Chỉ in ra console bản tóm tắt siêu ngắn gọn (Passed/Failed/Skipped, thời gian).
- Khi có test fail: trích xuất danh sách test fail và lý do cốt lõi (tự động cắt ngắn
  các chuỗi HTML/JSON dump quá dài).
- Trả về đúng exit code của runner gốc (0 = pass, khác 0 = fail).
"""

import argparse
import datetime
import os
import re
import subprocess
import sys
from pathlib import Path


# Đảm bảo mã hóa UTF-8 trên console Windows theo chuẩn repo (AGENTS.md)
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


REPO_ROOT = Path(__file__).resolve().parents[1]
LOGS_DIR = REPO_ROOT / "logs"


def ensure_logs_dir() -> Path:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    return LOGS_DIR


def make_log_filepath(test_type: str) -> Path:
    ensure_logs_dir()
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    return LOGS_DIR / f"test-{test_type}-{timestamp}.log"


def clean_line_noise(text: str) -> str:
    """Loại bỏ ký tự điều khiển ANSI escape và chuẩn hóa newline."""
    ansi_regex = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
    cleaned = ansi_regex.sub("", text)
    return cleaned.replace("\r\n", "\n").replace("\r", "\n")


def truncate_message(msg: str, max_chars: int = 350) -> str:
    """Rút gọn message lỗi nếu quá dài (vd dump toàn bộ trang HTML)."""
    cleaned = " ".join(msg.split())
    if len(cleaned) > max_chars:
        return cleaned[:max_chars] + "... [truncated, xem full log để biết chi tiết]"
    return cleaned


# ==============================================================================
# PARSER: Python unittest
# ==============================================================================
def parse_unittest_output(raw_output: str) -> dict:
    text = clean_line_noise(raw_output)
    lines = text.split("\n")

    summary = {
        "type": "unittest",
        "passed": 0,
        "failed": 0,
        "errors": 0,
        "skipped": 0,
        "total": 0,
        "duration_sec": 0.0,
        "failures_list": [],
        "raw_status_line": "",
    }

    # Tìm dòng "Ran X tests in Ys"
    ran_match = re.search(r"Ran\s+(\d+)\s+tests?\s+in\s+([0-9\.]+)s", text)
    if ran_match:
        summary["total"] = int(ran_match.group(1))
        summary["duration_sec"] = float(ran_match.group(2))

    # Tìm dòng kết quả cuối: "OK", "OK (skipped=1)", "FAILED (failures=2, errors=1)"
    for line in reversed(lines):
        line_strip = line.strip()
        if line_strip.startswith("OK"):
            summary["raw_status_line"] = line_strip
            skip_m = re.search(r"skipped=(\d+)", line_strip)
            if skip_m:
                summary["skipped"] = int(skip_m.group(1))
            summary["passed"] = summary["total"] - summary["skipped"]
            break
        elif line_strip.startswith("FAILED"):
            summary["raw_status_line"] = line_strip
            fail_m = re.search(r"failures=(\d+)", line_strip)
            err_m = re.search(r"errors=(\d+)", line_strip)
            skip_m = re.search(r"skipped=(\d+)", line_strip)
            summary["failed"] = int(fail_m.group(1)) if fail_m else 0
            summary["errors"] = int(err_m.group(1)) if err_m else 0
            summary["skipped"] = int(skip_m.group(1)) if skip_m else 0
            summary["passed"] = max(0, summary["total"] - summary["failed"] - summary["errors"] - summary["skipped"])
            break

    # Trích xuất các test case fail / error
    # Định dạng unittest:
    # ======================================================================
    # FAIL: test_method (module.ClassName.test_method)
    # ----------------------------------------------------------------------
    # Traceback (most recent call last):
    #   ...
    # AssertionError: ...
    blocks = re.split(r"={50,}", text)
    for block in blocks[1:]:
        header_match = re.search(r"\n?(FAIL|ERROR):\s+([^\n]+)", block)
        if not header_match:
            continue
        kind = header_match.group(1)
        test_ident = header_match.group(2).strip()

        # Tìm dòng lỗi cuối cùng (thường là AssertionError hoặc Exception class)
        error_lines = []
        for bline in block.strip().split("\n"):
            bline_s = bline.strip()
            if (
                bline_s.startswith("AssertionError:")
                or bline_s.startswith("Error:")
                or ("Error:" in bline_s and not bline_s.startswith("File "))
                or bline_s.startswith("Exception:")
            ):
                error_lines.append(bline_s)

        error_reason = error_lines[-1] if error_lines else "Test failed (xem log)"
        summary["failures_list"].append({
            "kind": kind,
            "name": test_ident,
            "reason": truncate_message(error_reason),
        })

    if not summary["failures_list"]:
        general_errors = [
            line.strip() for line in lines
            if line.strip().startswith("SyntaxError:")
            or line.strip().startswith("ModuleNotFoundError:")
            or line.strip().startswith("ImportError:")
            or line.strip().startswith("IndentationError:")
            or (line.strip().endswith("Error:") and not line.strip().startswith("File "))
        ]
        for err in general_errors:
            summary["failures_list"].append({
                "kind": "ERROR",
                "name": "Lỗi cú pháp / nạp module runner",
                "reason": truncate_message(err),
            })

    return summary


def format_unittest_summary(summary: dict, log_path: Path, exit_code: int) -> str:
    rel_log = log_path.relative_to(REPO_ROOT) if log_path.is_relative_to(REPO_ROOT) else log_path
    if exit_code == 0 and summary["failed"] == 0 and summary["errors"] == 0:
        skip_info = f", {summary['skipped']} skipped" if summary["skipped"] > 0 else ""
        return (
            f"[PASS] Python unittest: {summary['total']} tests passed{skip_info} "
            f"in {summary['duration_sec']:.2f}s\n"
            f"       Log chi tiết: {rel_log}"
        )

    # Có lỗi
    total_fails = summary["failed"] + summary["errors"]
    if total_fails == 0 and exit_code != 0:
        total_fails = 1

    lines = [
        f"[FAIL] Python unittest: {summary['passed']} passed, {total_fails} failed, "
        f"{summary['skipped']} skipped in {summary['duration_sec']:.2f}s",
        f"       Log chi tiết: {rel_log}",
        "--- Danh sách test thất bại ---",
    ]
    if summary["failures_list"]:
        for item in summary["failures_list"]:
            lines.append(f"  * [{item['kind']}] {item['name']}")
            lines.append(f"    -> {item['reason']}")
    else:
        lines.append("  (Không tìm thấy block FAIL/ERROR chi tiết. Vui lòng xem full log để kiểm tra lỗi cú pháp hoặc runtime error)")

    return "\n".join(lines)


# ==============================================================================
# PARSER: Playwright integration test
# ==============================================================================
def parse_playwright_output(raw_output: str) -> dict:
    text = clean_line_noise(raw_output)
    lines = text.split("\n")

    summary = {
        "type": "playwright",
        "passed": 0,
        "failed": 0,
        "flaky": 0,
        "skipped": 0,
        "total": 0,
        "duration_str": "",
        "failures_list": [],
    }

    # Playwright summary line ví dụ:
    # "  80 passed (42.1s)"
    # "  2 failed"
    # "    [chromium] › core-workflows.spec.js:45:1 › [ACC-SALE-01] ..."
    # "  1 flaky"
    # "  3 skipped"
    for line in lines:
        line_strip = line.strip()
        pass_m = re.search(r"(\d+)\s+passed(?:\s+\(([^)]+)\))?", line_strip)
        if pass_m:
            summary["passed"] = int(pass_m.group(1))
            if pass_m.group(2):
                summary["duration_str"] = pass_m.group(2)

        fail_m = re.search(r"^(\d+)\s+failed\b", line_strip)
        if fail_m:
            summary["failed"] = int(fail_m.group(1))

        flaky_m = re.search(r"^(\d+)\s+flaky\b", line_strip)
        if flaky_m:
            summary["flaky"] = int(flaky_m.group(1))

        skip_m = re.search(r"^(\d+)\s+skipped\b", line_strip)
        if skip_m:
            summary["skipped"] = int(skip_m.group(1))

    summary["total"] = summary["passed"] + summary["failed"] + summary["flaky"] + summary["skipped"]

    # Bắt danh sách các test fail
    # Thường Playwright in:
    # 1) [chromium] › tests/integration/login.spec.js:20:5 › test title
    #    Error: ...
    failed_test_regex = re.compile(r"^\s*(?:\d+\)\s+)?(\[[a-zA-Z0-9_-]+\]\s+›\s+.*|tests[/\\]integration[/\\][^\n:]+:\d+:\d+\s+›\s+.*)")
    current_fail = None

    for line in lines:
        line_clean = line.strip()
        m = failed_test_regex.match(line)
        if m:
            if current_fail:
                summary["failures_list"].append(current_fail)
            current_fail = {
                "name": m.group(1).strip(),
                "reason": "",
            }
        elif current_fail and not current_fail["reason"]:
            if line_clean.startswith("Error:") or line_clean.startswith("expect("):
                current_fail["reason"] = truncate_message(line_clean)

    if current_fail:
        summary["failures_list"].append(current_fail)

    # Nếu không bắt được từng test case cụ thể nhưng có lỗi chung (vd: port in use, syntax error, config error)
    if not summary["failures_list"]:
        general_errors = [
            line.strip() for line in lines
            if line.strip().startswith("Error:") or line.strip().startswith("Exception:")
        ]
        for err in general_errors:
            summary["failures_list"].append({
                "name": "Lỗi khởi động / cấu hình runner",
                "reason": truncate_message(err),
            })

    return summary


def format_playwright_summary(summary: dict, log_path: Path, exit_code: int) -> str:
    rel_log = log_path.relative_to(REPO_ROOT) if log_path.is_relative_to(REPO_ROOT) else log_path
    duration_info = f" in {summary['duration_str']}" if summary["duration_str"] else ""

    if exit_code == 0 and summary["failed"] == 0:
        skip_info = f", {summary['skipped']} skipped" if summary["skipped"] > 0 else ""
        return (
            f"[PASS] Playwright integration: {summary['passed']} tests passed{skip_info}"
            f"{duration_info}\n"
            f"       Log chi tiết: {rel_log}"
        )

    total_fails = summary["failed"] if summary["failed"] > 0 else (1 if exit_code != 0 else 0)
    lines = [
        f"[FAIL] Playwright integration: {summary['passed']} passed, {total_fails} failed, "
        f"{summary['skipped']} skipped{duration_info}",
        f"       Log chi tiết: {rel_log}",
        "--- Danh sách test thất bại ---",
    ]
    if summary["failures_list"]:
        for item in summary["failures_list"]:
            lines.append(f"  * {item['name']}")
            if item["reason"]:
                lines.append(f"    -> {item['reason']}")
    else:
        lines.append("  (Không bắt được danh sách test cụ thể từ output Playwright. Vui lòng mở full log để tra cứu)")

    return "\n".join(lines)


# ==============================================================================
# RUNNER EXECUTION
# ==============================================================================
def run_command_with_logging(cmd: list[str], log_file: Path, env: dict | None = None) -> tuple[int, str]:
    """Chạy command, lưu toàn bộ raw stream vào log_file, trả về (exit_code, combined_output)."""
    with open(log_file, "w", encoding="utf-8", errors="replace") as f:
        f.write(f"=== TEST RUN STARTED: {datetime.datetime.now().isoformat()} ===\n")
        f.write(f"Command: {' '.join(cmd)}\n")
        f.write("=" * 70 + "\n\n")

    process = subprocess.Popen(
        cmd,
        cwd=REPO_ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        shell=(os.name == "nt" and cmd[0].endswith(".cmd")),
    )

    output_chunks = []
    with open(log_file, "a", encoding="utf-8", errors="replace") as f:
        while True:
            line = process.stdout.readline()
            if not line and process.poll() is not None:
                break
            if line:
                f.write(line)
                f.flush()
                output_chunks.append(line)

    exit_code = process.wait()
    with open(log_file, "a", encoding="utf-8", errors="replace") as f:
        f.write("\n" + "=" * 70 + "\n")
        f.write(f"=== TEST RUN FINISHED (Exit code: {exit_code}) AT {datetime.datetime.now().isoformat()} ===\n")

    combined_output = "".join(output_chunks)
    return exit_code, combined_output


def run_unit_tests(extra_args: list[str]) -> int:
    log_file = make_log_filepath("unit")
    cmd = [sys.executable, "-m", "unittest"]
    if extra_args:
        cmd.extend(extra_args)
    else:
        cmd.extend(["discover", "-s", "tests"])

    # Thiết lập biến môi trường để giảm ồn nếu có
    test_env = os.environ.copy()
    test_env["PYTHONIOENCODING"] = "utf-8"
    test_env["QLTP_QUIET_TEST_SERVER"] = "1"

    print(f"-> Đang chạy Python unit test... (output ghi vào {log_file.name})", flush=True)
    exit_code, output = run_command_with_logging(cmd, log_file, env=test_env)
    summary = parse_unittest_output(output)
    formatted = format_unittest_summary(summary, log_file, exit_code)
    print(formatted)
    return exit_code


def run_integration_tests(extra_args: list[str]) -> int:
    log_file = make_log_filepath("integration")
    npx_bin = "npx.cmd" if os.name == "nt" else "npx"
    cmd = [npx_bin, "playwright", "test"]

    if extra_args:
        cmd.extend(extra_args)

    test_env = os.environ.copy()
    test_env["QLTP_QUIET_TEST_SERVER"] = "1"

    print(f"-> Đang chạy Playwright integration test... (output ghi vào {log_file.name})", flush=True)
    exit_code, output = run_command_with_logging(cmd, log_file, env=test_env)
    summary = parse_playwright_output(output)
    formatted = format_playwright_summary(summary, log_file, exit_code)
    print(formatted)
    return exit_code


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Chạy test với output tóm tắt ngắn gọn và ghi full log ra file.",
        add_help=True,
    )
    parser.add_argument(
        "type",
        choices=["unit", "integration", "all"],
        help="Loại test muốn chạy: unit, integration, hoặc all",
    )
    parser.add_argument(
        "extra_args",
        nargs=argparse.REMAINDER,
        help="Các tham số chuyển tiếp trực tiếp cho runner (vd: --grep, test file, etc.)",
    )

    args = parser.parse_args()

    # Nếu người dùng truyền dấu '--' phân cách của npm, loại bỏ phần tử '--' đầu tiên
    extra = list(args.extra_args)
    if extra and extra[0] == "--":
        extra = extra[1:]

    overall_code = 0
    if args.type == "unit":
        overall_code = run_unit_tests(extra)
    elif args.type == "integration":
        overall_code = run_integration_tests(extra)
    elif args.type == "all":
        print("=== BẮT ĐẦU CHẠY FULL TEST SUITE VỚI SUMMARY RUNNER ===")
        unit_code = run_unit_tests([])
        print()
        int_code = run_integration_tests([])
        overall_code = unit_code if unit_code != 0 else int_code
        print("=" * 60)
        if overall_code == 0:
            print("[SUMMARY] Toàn bộ unit test và integration test đều PASSED!")
        else:
            print(f"[SUMMARY] Có test thất bại! (Unit: {'PASS' if unit_code == 0 else 'FAIL'}, Integration: {'PASS' if int_code == 0 else 'FAIL'})")

    return overall_code


if __name__ == "__main__":
    sys.exit(main())
