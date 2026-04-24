#!/usr/bin/env python3
"""
import_config.py
把 config/config.yml 里的站点规则和黑名单导入到
app-shell/.txtx-http/ 下的 JSON 数据文件。

用法:
    python import_config.py              # 默认路径
    python import_config.py --dry-run   # 只打印，不写文件
"""

import json
import uuid
import argparse
from pathlib import Path

try:
    import yaml
except ImportError:
    raise SystemExit("需要 PyYAML：pip install pyyaml")


# ── 路径 ──────────────────────────────────────────────────────────────────────
ROOT        = Path(__file__).parent
CONFIG_YML  = ROOT / "config" / "config.yml"
DATA_DIR    = ROOT / "app-shell" / ".txtx-http"
RULES_JSON  = DATA_DIR / "site-rules.json"
CONFIG_JSON = DATA_DIR / "app-config.json"


# ── 辅助 ──────────────────────────────────────────────────────────────────────
def load_yaml(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f)


def load_json(path: Path) -> dict | list:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data, dry_run: bool) -> None:
    text = json.dumps(data, ensure_ascii=False, indent=2)
    if dry_run:
        print(f"\n{'='*60}")
        print(f"[DRY-RUN] Would write → {path}")
        print(text[:2000] + ("…" if len(text) > 2000 else ""))
    else:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")
        print(f"✓  Written → {path}")


# ── 站点规则转换 ───────────────────────────────────────────────────────────────
def web_to_rule(key: str, web: dict, priority: int, encoding_map: dict) -> dict:
    """把 config.yml 里的一个 web* 条目转成 SiteRule JSON。"""
    domain: str = web.get("domain_name", "")
    encoding = encoding_map.get(domain.removeprefix("https://").removeprefix("http://").rstrip("/"), "utf-8")

    page_list: list[str] = web.get("page_list", [])

    return {
        "id":   str(uuid.uuid5(uuid.NAMESPACE_URL, domain)),   # 稳定 ID（同域名每次相同）
        "name": domain.removeprefix("https://").removeprefix("http://").rstrip("/"),
        "enabled": bool(web.get("enabled", True)),
        "priority": priority,
        "domain": domain,
        "listPages": page_list,
        "selectorEngine": "xpath",
        "selectors": {
            "listDate":   web.get("release_date",      ""),
            "listUrl":    web.get("release_url",       ""),
            "listName":   web.get("list_novel_name",   None),
            "detailName": web.get("novel_name_x",      ""),
            "chapterUrl": web.get("chapter_url_x",     ""),
            "content":    web.get("novel_content",     ""),
        },
        "network": {
            "encoding":  encoding,
            "timeoutMs": 45_000,
            "retryCount": 5,
            "proxy": None,
        },
    }


def convert_rules(cfg: dict) -> list[dict]:
    websites: dict = cfg.get("websites", {})
    encoding_map: dict = cfg.get("network", {}).get("encoding_map", {})
    priority_map: dict = cfg.get("filtering", {}).get("site_priority", {})

    rules = []
    for key, web in websites.items():
        if not isinstance(web, dict):
            continue
        domain = web.get("domain_name", "")
        priority = priority_map.get(domain, 99)
        rules.append(web_to_rule(key, web, priority, encoding_map))

    # 按优先级排序
    rules.sort(key=lambda r: r["priority"])
    return rules


# ── app-config 更新 ────────────────────────────────────────────────────────────
def update_app_config(cfg: dict, existing: dict) -> dict:
    paths_cfg    = cfg.get("paths", {})
    network_cfg  = cfg.get("network", {})
    filtering    = cfg.get("filtering", {})
    blacklist    = cfg.get("blacklist", {})
    text_conv    = cfg.get("text_conversion", {})
    ebook        = cfg.get("ebook_conversion", {})
    concurrency  = cfg.get("concurrency", {})

    # 输出格式
    output_formats = []
    if ebook.get("enabled", False):
        output_formats = ebook.get("formats", ["txt"])
    if not output_formats:
        output_formats = ["txt"]

    # 黑名单关键词（去重、去空）
    keywords = list(dict.fromkeys(
        kw.strip() for kw in blacklist.get("keywords", []) if kw and kw.strip()
    ))

    # 正则黑名单
    patterns = list(dict.fromkeys(
        p.strip() for p in blacklist.get("regex_patterns", []) if p and p.strip()
    ))

    updated = {
        **existing,
        "downloadDir":          paths_cfg.get("base_dir", existing.get("downloadDir", "")),
        "concurrency":          concurrency.get("novel_threads", existing.get("concurrency", 2)),
        "chapterConcurrency":   concurrency.get("chapter_threads", existing.get("chapterConcurrency", 2)),
        "daysLimit":            filtering.get("days_limit", existing.get("daysLimit", 30)),
        "lastDownloadDate":     filtering.get("last_download_date", existing.get("lastDownloadDate")),
        "userAgent":            network_cfg.get("user_agent", existing.get("userAgent", "")),
        "outputFormats":        output_formats,
        "textConversionEnabled": text_conv.get("enabled", existing.get("textConversionEnabled", False)),
        "filterExisting":       existing.get("filterExisting", False),
        "blacklistKeywords":    keywords,
        "blacklistPatterns":    patterns,
        "logLevel":             existing.get("logLevel", "info"),
        "themeId":              existing.get("themeId", "aurora-glass"),
        "appearanceMode":       existing.get("appearanceMode", "light"),
    }
    return updated


# ── 主流程 ────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Import Python config → txtx JSON data files")
    parser.add_argument("--dry-run", action="store_true", help="Print output without writing files")
    parser.add_argument("--config",  default=str(CONFIG_YML), help="Path to config.yml")
    parser.add_argument("--rules",   default=str(RULES_JSON), help="Path to site-rules.json")
    parser.add_argument("--appconf", default=str(CONFIG_JSON), help="Path to app-config.json")
    args = parser.parse_args()

    cfg_path   = Path(args.config)
    rules_path = Path(args.rules)
    conf_path  = Path(args.appconf)

    print(f"Reading  {cfg_path}")
    cfg = load_yaml(cfg_path)

    # ── 站点规则 ──
    rules = convert_rules(cfg)
    print(f"\n站点规则: {len(rules)} 条")
    for r in rules:
        status = "✓ 启用" if r["enabled"] else "✗ 停用"
        print(f"  [{r['priority']:>2}] {status}  {r['name']}")

    # ── app-config ──
    existing_conf = load_json(conf_path) if conf_path.exists() else {}
    new_conf = update_app_config(cfg, existing_conf)
    kw_count = len(new_conf["blacklistKeywords"])
    re_count = len(new_conf["blacklistPatterns"])
    print(f"\n黑名单关键词: {kw_count} 条")
    print(f"正则黑名单:   {re_count} 条")
    print(f"下载目录:     {new_conf['downloadDir']}")
    print(f"扫描天数:     {new_conf['daysLimit']}")
    print(f"最近下载日期: {new_conf['lastDownloadDate']}")

    # ── 写入 ──
    save_json(rules_path, rules, args.dry_run)
    save_json(conf_path,  new_conf, args.dry_run)

    if not args.dry_run:
        print("\n✅ 导入完成！重启后端服务后生效。")
    else:
        print("\n[DRY-RUN] 未写入任何文件。")


if __name__ == "__main__":
    main()
