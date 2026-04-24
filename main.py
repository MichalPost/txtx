#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import logging
from contextlib import AsyncExitStack
from pathlib import Path
from typing import Any, List, Dict

import yaml
from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

from config_service import ConfigService, get_config_service
from novel_crawler import NovelCrawler
from enhanced_blacklist import EnhancedBlacklist
from download_pool import DownloadPool

# 创建全局控制台对象
console = Console()
logging.getLogger().handlers = []
logging.basicConfig(level=logging.INFO)

async def _download_with_overall_progress(crawler, download_items, progress, site_progress_id, overall_progress_id, total_novels):
    """带总体进度更新的下载包装器"""
    
    class ProgressWrapper:
        def __init__(self, original_progress, site_id, overall_id, crawler, total_items, total_novels):
            self.original_progress = original_progress
            self.site_id = site_id
            self.overall_id = overall_id
            self.crawler = crawler
            self.total_items = total_items
            self.total_novels = total_novels
            self.site_completed = 0
            self.overall_completed = 0  # 添加总体完成计数器
            
        def update(self, task_id, **kwargs):
            # 只有当更新的是当前网站的任务ID时才处理
            if task_id == self.site_id:
                # 更新网站进度
                if 'advance' in kwargs and kwargs['advance'] > 0:
                    self.site_completed += kwargs['advance']
                    self.overall_completed += kwargs['advance']  # 同步更新总体计数器
                    
                    # 更新网站进度条描述
                    site_desc = f"[cyan]{self.crawler.config.domain_name} ({self.site_completed}/{self.total_items})[/cyan]"
                    self.original_progress.update(task_id, description=site_desc, **kwargs)
                    
                    # 更新总体进度条
                    self.original_progress.update(self.overall_id, advance=kwargs['advance'])
                    
                    # 更新总体进度条描述
                    overall_desc = f"[green]总体进度 ({self.overall_completed}/{self.total_novels})[/green]"
                    self.original_progress.update(self.overall_id, description=overall_desc)
                else:
                    self.original_progress.update(task_id, **kwargs)
            else:
                # 如果不是当前网站的任务ID，直接传递给原始progress
                self.original_progress.update(task_id, **kwargs)
        
        def __getattr__(self, name):
            return getattr(self.original_progress, name)
    
    wrapped_progress = ProgressWrapper(progress, site_progress_id, overall_progress_id, crawler, len(download_items), total_novels)
    await crawler.download_specific_novels(download_items, wrapped_progress, site_progress_id)

async def main():
    """主程序：收集 -> 筛选 -> 下载"""
    try:
        # 配置加载
        config_service = get_config_service()
        config_service.load_config()
        
        if not config_service.validate_config():
            console.print("[red]❌ 配置验证失败，程序退出[/red]")
            return
        
        websites_config = config_service.get_websites_config()
        common_config = config_service.get_common_config()
        blacklist_config = config_service.get_blacklist_config()

        # 初始化黑名单
        blacklist_checker = None
        if blacklist_config:
            blacklist_checker = EnhancedBlacklist(config_data=blacklist_config)
            
        base_dir = Path(common_config.get('base_dir', 'E:/Downloads/xs'))
        base_dir.mkdir(parents=True, exist_ok=True)

        # 创建下载池
        download_pool = DownloadPool()

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            console=console,
            transient=False
        ) as progress:
            
            console.print("[bold blue]📝 第一阶段：数据收集[/bold blue]")
            
            async with AsyncExitStack() as stack:
                # 初始化爬虫
                crawlers = []
                for site_name, site_cfg in websites_config.items():
                    try:
                        config_obj = config_service.create_site_config(site_cfg, common_config)
                        crawler = await stack.enter_async_context(NovelCrawler(config_obj))
                        crawlers.append(crawler)
                        console.print(f"[green]✅ {site_name} ({config_obj.domain_name}) - 初始化成功[/green]")
                    except Exception as e:
                        console.print(f"[red]❌ 初始化失败 {site_name}: {e}[/red]")

                if not crawlers:
                    console.print("[red]所有网站初始化失败，程序退出[/red]")
                    return

                # 扫描网站
                scan_task_id = progress.add_task("[yellow]🔍 正在扫描所有站点...[/yellow]", total=len(crawlers))
                
                scan_tasks = [crawler.scan_candidates(progress) for crawler in crawlers]
                results = await asyncio.gather(*scan_tasks, return_exceptions=True)
                
                # 收集结果（改进错误处理）
                successful_sites = 0
                total_candidates = 0
                
                for i, result in enumerate(results):
                    if isinstance(result, Exception):
                        console.print(f"[red]扫描失败: {crawlers[i].config.domain_name} - {str(result)[:100]}[/red]")
                    else:
                        download_pool.add_candidates(result)
                        successful_sites += 1
                        total_candidates += len(result)
                        logging.info(f"✅ {crawlers[i].config.domain_name}: {len(result)} 本书")
                    progress.update(scan_task_id, advance=1)
                
                progress.update(scan_task_id, visible=False)
                
                console.print(f"[green]扫描完成: {successful_sites}/{len(crawlers)} 个网站成功，共收集 {total_candidates} 本书[/green]")
                
                # 第二阶段：筛选处理
                console.print("[bold blue]🔍 第二阶段：筛选处理[/bold blue]")
                
                filter_task_id = progress.add_task("[yellow]📋 正在处理筛选...[/yellow]", total=4)
                
                download_pool.deduplicate()
                progress.update(filter_task_id, advance=1)
                
                download_pool.apply_blacklist_filter(blacklist_checker)
                progress.update(filter_task_id, advance=1)
                
                download_pool.check_local_exists(base_dir)
                progress.update(filter_task_id, advance=1)
                
                tasks_by_crawler = download_pool.get_download_tasks_by_crawler(crawlers)
                progress.update(filter_task_id, advance=1)
                
                progress.update(filter_task_id, visible=False)
                
                # 显示统计
                download_pool.print_statistics(console)

                if download_pool.stats['final_download'] == 0:
                    console.print("[yellow]没有需要下载的新书。[/yellow]")
                    return

                # 第三阶段：批量下载
                console.print("[bold blue]⬇️ 第三阶段：批量下载[/bold blue]")
                
                # 调试信息：显示任务分配情况
                for crawler, candidates in tasks_by_crawler.items():
                    console.print(f"[blue]🔍 调试: {crawler.config.domain_name} 分配到 {len(candidates)} 个任务[/blue]")
                
                # 计算总下载任务数
                total_novels_to_download = sum(len(candidates) for candidates in tasks_by_crawler.values())
                console.print(f"[blue]🔍 调试: 总计 {total_novels_to_download} 个下载任务[/blue]")
                
                if total_novels_to_download == 0:
                    console.print("[yellow]⚠️ 没有分配到任何下载任务，请检查域名匹配[/yellow]")
                    return
                
                # 创建总体进度条
                overall_progress_id = progress.add_task(
                    f"[green]总体进度 (0/{total_novels_to_download})[/green]", 
                    total=total_novels_to_download
                )
                
                download_tasks = []
                for crawler, candidates in tasks_by_crawler.items():
                    if candidates:
                        download_items = []
                        for candidate in candidates:
                            download_items.append({
                                'name': candidate.name,
                                'url': candidate.url,
                                'crawler': crawler,
                                'date': candidate.date
                            })
                        
                        # 为每个网站创建单独的进度条
                        site_progress_id = progress.add_task(
                            f"[cyan]{crawler.config.domain_name} (0/{len(download_items)})[/cyan]", 
                            total=len(download_items)
                        )
                        
                        # 创建下载任务，传入总体进度ID
                        download_tasks.append(
                            _download_with_overall_progress(
                                crawler, download_items, progress, site_progress_id, overall_progress_id, total_novels_to_download
                            )
                        )
                
                # 执行下载
                await asyncio.gather(*download_tasks, return_exceptions=True)
                
                console.print(f"\n[green]✅ 任务完成![/green]")

    except KeyboardInterrupt:
        console.print("\n[yellow]⚠️  用户中断程序[/yellow]")
    except Exception as e:
        console.print(f"[red]💥 程序执行失败: {e}[/red]")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(main())