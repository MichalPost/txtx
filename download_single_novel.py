#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
单本小说下载工具
使用方法: python download_single_novel.py <小说URL>
示例: python download_single_novel.py https://trxs.cc/tongren/11235.html
"""

import asyncio
import sys
from single_novel_downloader import SingleNovelDownloader
from rich.console import Console

console = Console()

async def main():
    """主函数"""
    import argparse
    
    parser = argparse.ArgumentParser(description='单本小说下载工具')
    parser.add_argument('url', help='小说URL')
    parser.add_argument('--skip-blacklist', action='store_true', help='跳过黑名单检查')
    
    args = parser.parse_args()
    
    novel_url = args.url.strip()
    
    # 简单的URL验证
    if not novel_url.startswith(('http://', 'https://')):
        console.print("[red]❌ 无效的URL格式，请使用完整的HTTP/HTTPS链接[/red]")
        return
    
    console.print(f"[blue]🎯 目标小说: {novel_url}[/blue]")
    if args.skip_blacklist:
        console.print("[yellow]⚠️ 已跳过黑名单检查[/yellow]")
    console.print()
    
    try:
        downloader = SingleNovelDownloader()
        success = await downloader.download_novel(novel_url, skip_blacklist=args.skip_blacklist)
        
        if success:
            console.print()
            console.print("[green]🎉 下载完成！[/green]")
        else:
            console.print()
            console.print("[red]💥 下载失败！[/red]")
            sys.exit(1)
            
    except KeyboardInterrupt:
        console.print("\n[yellow]⚠️ 用户中断程序[/yellow]")
    except Exception as e:
        console.print(f"\n[red]💥 程序执行失败: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main())