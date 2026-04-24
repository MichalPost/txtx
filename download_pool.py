#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Set, List, Dict, Tuple, Optional, Any
from collections import defaultdict

@staticmethod
def sanitize_filename(name: str) -> str:
    """清理文件名，移除非法字符
    
    Args:
        name: 原始文件名
        
    Returns:
        清理后的文件名
    """
    if not name:
        return ""
    # 移除括号内容和特殊字符
    name = re.sub(r'\(.*?\)', '', name)
    name = re.sub(r'[\\/:*?"<>|]', ' ', name)
    return name.strip()

@dataclass(frozen=True)
class BookCandidate:
    """书籍候选项（使用frozen dataclass确保可以放入set）"""
    name: str           # 书名
    url: str           # 详情页链接
    crawler_domain: str # 来源网站域名
    date: str = ""     # 发布日期（可选）
    
    def __hash__(self):
        # 主要按书名进行hash，用于去重
        return hash(self.name)
    
    def __eq__(self, other):
        if not isinstance(other, BookCandidate):
            return False
        # 按书名判断是否相等
        return self.name == other.name

class DownloadPool:
    """下载池管理器 - 负责收集、筛选、管理所有待下载的书籍"""
    
    def __init__(self):
        self.candidate_pool: Set[BookCandidate] = set()  # 原始候选池
        self.deduplicated_pool: List[BookCandidate] = []  # 去重后的池
        self.filtered_pool: List[BookCandidate] = []      # 最终下载池
        
        # 统计信息
        self.stats = {
            'total_collected': 0,      # 收集总数
            'after_dedup': 0,          # 去重后数量
            'blacklist_filtered': 0,   # 黑名单过滤数量
            'local_exists': 0,         # 本地已存在数量
            'final_download': 0        # 最终下载数量
        }
        
        # 按网站分组的统计
        self.site_stats: Dict[str, int] = defaultdict(int)
    
    def add_candidates(self, candidates: List[Dict[str, Any]]) -> None:
        """添加候选书籍到筛选池
        
        Args:
            candidates: 候选书籍列表，每个元素包含 name, url, crawler 等信息
        """
        for item in candidates:
            if not item.get('name') or not item.get('url'):
                continue
            
            # 清理书名，移除非法字符
            cleaned_name = sanitize_filename(item['name'])
            if not cleaned_name:  # 如果清理后书名为空，跳过
                continue
                
            candidate = BookCandidate(
                name=cleaned_name,
                url=item['url'],
                crawler_domain=item['crawler'].config.domain_name,
                date=item.get('date', '')
            )
            
            # 添加到候选池（set自动去重）
            old_size = len(self.candidate_pool)
            self.candidate_pool.add(candidate)
            
            # 如果确实添加了新项目，更新统计
            if len(self.candidate_pool) > old_size:
                self.stats['total_collected'] += 1
                self.site_stats[candidate.crawler_domain] += 1
        
        logging.info(f"候选池更新: 当前总数 {len(self.candidate_pool)}")
    
    def deduplicate(self) -> None:
        """对候选池进行去重处理"""
        # 由于使用了set，天然去重，但我们需要转换为list以便后续处理
        # 如果同名书籍来自不同网站，优先选择某个网站的版本
        
        name_to_candidate: Dict[str, BookCandidate] = {}
        
        # 网站优先级（可以根据实际情况调整）
        site_priority = {
            'https://trxs.cc': 1,
            'https://www.qbtr.cc': 2,
            'https://www.trxs.me': 3,
            'https://tongrenquan.org': 4,
            'https://ffxs8.com': 5,
            'https://powanjuan.cc': 6,
            'https://jpxs123.com': 7,
        }
        
        for candidate in self.candidate_pool:
            existing = name_to_candidate.get(candidate.name)
            
            if existing is None:
                # 第一次遇到这个书名
                name_to_candidate[candidate.name] = candidate
            else:
                # 已存在同名书籍，按优先级选择
                current_priority = site_priority.get(candidate.crawler_domain, 999)
                existing_priority = site_priority.get(existing.crawler_domain, 999)
                
                if current_priority < existing_priority:
                    name_to_candidate[candidate.name] = candidate
        
        self.deduplicated_pool = list(name_to_candidate.values())
        self.stats['after_dedup'] = len(self.deduplicated_pool)
        
        logging.info(f"去重完成: {self.stats['total_collected']} -> {self.stats['after_dedup']}")
    
    def apply_blacklist_filter(self, blacklist_checker) -> None:
        """应用黑名单过滤
        
        Args:
            blacklist_checker: 黑名单检查器实例
        """
        if not blacklist_checker:
            # 如果没有黑名单检查器，直接复制到过滤池
            self.filtered_pool = self.deduplicated_pool.copy()
            return
        
        filtered_candidates = []
        blacklist_count = 0
        
        for candidate in self.deduplicated_pool:
            is_blocked, reason = blacklist_checker.is_blacklisted(candidate.name)
            if is_blocked:
                blacklist_count += 1
                logging.debug(f"🚫 黑名单过滤: {candidate.name} (原因: {reason})")
            else:
                filtered_candidates.append(candidate)
        
        self.filtered_pool = filtered_candidates
        self.stats['blacklist_filtered'] = blacklist_count
        
        logging.info(f"黑名单过滤完成: {len(self.deduplicated_pool)} -> {len(self.filtered_pool)} (过滤 {blacklist_count} 本)")
    
    def check_local_exists(self, base_dir: Path) -> None:
        """检查本地文件是否已存在
        
        Args:
            base_dir: 本地存储目录
        """
        final_candidates = []
        exists_count = 0
        
        for candidate in self.filtered_pool:
            local_file = base_dir / f"{candidate.name}.txt"
            if local_file.exists():
                exists_count += 1
                logging.debug(f"📂 本地已存在: {candidate.name}")
            else:
                final_candidates.append(candidate)
        
        self.filtered_pool = final_candidates
        self.stats['local_exists'] = exists_count
        self.stats['final_download'] = len(self.filtered_pool)
        
        logging.info(f"本地文件检查完成: 过滤 {exists_count} 个已存在文件，最终待下载: {self.stats['final_download']}")
    
    def get_download_tasks_by_crawler(self, crawlers: List) -> Dict[Any, List[BookCandidate]]:
        """按爬虫分组获取下载任务
        
        Args:
            crawlers: 爬虫实例列表
            
        Returns:
            按爬虫分组的下载任务字典
        """
        # 创建域名到爬虫的映射
        domain_to_crawler = {crawler.config.domain_name: crawler for crawler in crawlers}
        
        # 调试信息：显示可用的爬虫域名
        logging.info(f"可用爬虫域名: {list(domain_to_crawler.keys())}")
        
        # 按爬虫分组任务
        tasks_by_crawler: Dict[Any, List[BookCandidate]] = defaultdict(list)
        unmatched_domains = set()
        
        for candidate in self.filtered_pool:
            crawler = domain_to_crawler.get(candidate.crawler_domain)
            if crawler:
                tasks_by_crawler[crawler].append(candidate)
            else:
                unmatched_domains.add(candidate.crawler_domain)
        
        # 调试信息：显示未匹配的域名
        if unmatched_domains:
            logging.warning(f"未匹配的候选项域名: {list(unmatched_domains)}")
        
        # 调试信息：显示每个爬虫分配到的任务数
        for crawler, candidates in tasks_by_crawler.items():
            logging.info(f"爬虫 {crawler.config.domain_name} 分配到 {len(candidates)} 个下载任务")
        
        return dict(tasks_by_crawler)
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取详细统计信息"""
        return {
            'processing_stats': self.stats.copy(),
            'current_pool_size': len(self.candidate_pool),
            'final_download_count': len(self.filtered_pool)
        }
    
    def print_statistics(self, console) -> None:
        """打印统计信息到控制台"""
        stats = self.stats
        
        console.print(f"\n[green]📊 下载池统计:[/green]")
        console.print(f"  - 🔍 收集总数: {stats['total_collected']}")
        console.print(f"  - 🔄 去重后:   {stats['after_dedup']}")
        console.print(f"  - 🚫 黑名单:   {stats['blacklist_filtered']}")
        console.print(f"  - 📂 已存在:   {stats['local_exists']}")
        console.print(f"  - [bold cyan]⬇️  待下载:   {stats['final_download']}[/bold cyan]")
        console.print()
    
    def clear(self) -> None:
        """清空所有池和统计信息"""
        self.candidate_pool.clear()
        self.deduplicated_pool.clear()
        self.filtered_pool.clear()
        self.stats = {
            'total_collected': 0,
            'after_dedup': 0,
            'blacklist_filtered': 0,
            'local_exists': 0,
            'final_download': 0
        }
        self.site_stats.clear()