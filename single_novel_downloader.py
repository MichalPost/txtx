#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import asyncio
import logging
from pathlib import Path
from urllib.parse import urlparse
from typing import Optional, Dict, Any
from contextlib import AsyncExitStack

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn

from config_service import Config, get_config_service
from novel_crawler import NovelCrawler
from enhanced_blacklist import EnhancedBlacklist

console = Console()

class SingleNovelDownloader:
    """单本小说下载器"""
    
    def __init__(self):
        config_service = get_config_service()
        config_service.load_config()
        
        if not config_service.validate_config():
            raise ValueError("配置验证失败")
        
        self.websites_config = config_service.get_websites_config()
        self.common_config = config_service.get_common_config()
        self.blacklist_config = config_service.get_blacklist_config()
        
        # 初始化黑名单
        self.blacklist_checker = None
        if self.blacklist_config:
            self.blacklist_checker = EnhancedBlacklist(config_data=self.blacklist_config)
    
    def find_matching_website(self, url: str) -> Optional[tuple[str, Dict[str, Any]]]:
        """根据URL找到匹配的网站配置"""
        parsed_url = urlparse(url)
        target_domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
        
        for site_name, site_config in self.websites_config.items():
            domain_name = site_config.get('domain_name', '').rstrip('/')
            if domain_name == target_domain:
                return site_name, site_config
        
        return None
    
    async def download_novel(self, novel_url: str, skip_blacklist: bool = False) -> bool:
        """下载单本小说"""
        try:
            # 查找匹配的网站配置
            match_result = self.find_matching_website(novel_url)
            if not match_result:
                parsed_url = urlparse(novel_url)
                target_domain = f"{parsed_url.scheme}://{parsed_url.netloc}"
                console.print(f"[red]❌ 未找到匹配的网站配置: {target_domain}[/red]")
                console.print("[yellow]💡 请检查配置文件中是否包含此域名[/yellow]")
                return False
            
            site_name, site_config = match_result
            
            # 检查网站是否启用
            if not site_config.get('enabled', True):
                console.print(f"[yellow]⏸️ 网站 {site_name} 已禁用，无法下载[/yellow]")
                console.print("[yellow]💡 请在配置文件中设置 enabled: true 来启用此网站[/yellow]")
                return False
            
            console.print(f"[green]✅ 找到匹配网站: {site_name} ({site_config['domain_name']})[/green]")
            
            # 创建配置对象
            config_service = get_config_service()
            config_obj = config_service.create_site_config(site_config, self.common_config)
            
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TaskProgressColumn(),
                console=console,
                transient=False
            ) as progress:
                
                async with AsyncExitStack() as stack:
                    # 初始化爬虫
                    crawler = await stack.enter_async_context(NovelCrawler(config_obj))
                    console.print(f"[green]✅ 爬虫初始化成功[/green]")
                    
                    # 获取小说信息
                    console.print(f"[blue]📖 正在获取小说信息...[/blue]")
                    novel_info = await crawler.get_novel_info(novel_url)
                    
                    if not novel_info:
                        console.print(f"[red]❌ 无法获取小说信息: {novel_url}[/red]")
                        return False
                    
                    novel_name = novel_info.get('name', '未知小说')
                    console.print(f"[cyan]📚 小说名称: {novel_name}[/cyan]")
                    
                    # 检查黑名单
                    if not skip_blacklist and self.blacklist_checker:
                        is_blacklisted, reason = self.blacklist_checker.is_blacklisted(novel_name)
                        if is_blacklisted:
                            console.print(f"[yellow]🚫 小说 '{novel_name}' 在黑名单中，匹配关键词: '{reason}'[/yellow]")
                            console.print(f"[dim]💡 使用 --skip-blacklist 参数可跳过黑名单检查[/dim]")
                            return False
                    
                    # 检查本地是否已存在
                    base_dir = Path(config_obj.base_dir)
                    novel_dir = base_dir / novel_name
                    if novel_dir.exists():
                        console.print(f"[yellow]📁 小说已存在: {novel_dir}[/yellow]")
                        user_input = input("是否重新下载？(y/N): ").strip().lower()
                        if user_input not in ['y', 'yes']:
                            console.print("[yellow]⏭️ 跳过下载[/yellow]")
                            return True
                    
                    # 开始下载
                    console.print(f"[blue]⬇️ 开始下载小说...[/blue]")
                    
                    download_items = [{
                        'name': novel_name,
                        'url': novel_url,
                        'crawler': crawler,
                        'date': None  # 单本下载不需要日期筛选
                    }]
                    
                    task_id = progress.add_task(
                        f"[cyan]下载 {novel_name}[/cyan]", 
                        total=1
                    )
                    
                    # 执行下载
                    await crawler.download_specific_novels(download_items, progress, task_id, show_chapter_progress=True)
                    
                    console.print(f"[green]✅ 下载完成: {novel_name}[/green]")
                    return True
                    
        except Exception as e:
            console.print(f"[red]❌ 下载失败: {e}[/red]")
            logging.exception("下载过程中发生错误")
            return False

async def main():
    """主函数"""
    import sys
    
    if len(sys.argv) != 2:
        console.print("[yellow]使用方法: python single_novel_downloader.py <小说URL>[/yellow]")
        console.print("[yellow]示例: python single_novel_downloader.py https://trxs.cc/tongren/11235.html[/yellow]")
        return
    
    novel_url = sys.argv[1]
    
    try:
        downloader = SingleNovelDownloader()
        success = await downloader.download_novel(novel_url)
        
        if success:
            console.print("[green]🎉 任务完成![/green]")
        else:
            console.print("[red]💥 任务失败![/red]")
            sys.exit(1)
            
    except KeyboardInterrupt:
        console.print("\n[yellow]⚠️ 用户中断程序[/yellow]")
    except Exception as e:
        console.print(f"[red]💥 程序执行失败: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())