#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
TTKS.TW 网站专用小说下载器
针对 ttks.tw 网站的特殊结构进行优化
"""

import asyncio
import logging
from pathlib import Path
from urllib.parse import urlparse, urljoin
from typing import Optional, List, Dict, Any
import re
import random
import os

from rich.console import Console
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn
from curl_cffi.requests import AsyncSession

from network_client import NetworkClient
from content_processor import ContentProcessor
from text_converter import TextConverter
from config_service import get_config_service

console = Console()

class TTKSNovelDownloader:
    """TTKS.TW 网站专用下载器"""
    
    def __init__(self):
        """初始化下载器"""
        # 加载基础配置
        config_service = get_config_service()
        config_service.load_config()
        common_config = config_service.get_common_config()
        
        # 使用 curl_cffi 替代原有的网络客户端，完美模拟 Chrome 浏览器
        # 使用更新的Chrome版本和更完整的配置
        self.session = AsyncSession(
            impersonate="chrome120",
            timeout=45,  # 增加超时时间
            verify=False,  # 禁用SSL验证以避免证书问题
            headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
        )
        
        # 内容处理器
        self.content_processor = ContentProcessor("/html/body/div[1]/div/div/div/div[2]/div[4]/p//text()")
        
        # 文本转换器 - 对于 TTKS 网站强制启用繁简转换
        self.text_converter = TextConverter()
        if self.text_converter.is_available():
            logging.info("繁简转换器已启用（TTKS专用）")
        else:
            logging.warning("繁简转换器初始化失败，请安装 opencc-python-reimplemented")
            logging.warning("运行命令: pip install opencc-python-reimplemented")
            self.text_converter = None
        
        # 基础配置
        self.base_dir = Path(common_config.get('base_dir', './downloads'))
        self.base_dir.mkdir(parents=True, exist_ok=True)
        
        # 临时目录配置
        self.temp_dir = Path(common_config.get('temp_dir', './downloads/temp'))
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        
        # TTKS 网站特定配置
        self.domain = "https://ttks.tw"
        self.novel_name_xpath = "/html/body/div[2]/div/div/div[2]/div/div[2]/div[2]/ul/li[1]/h1/text()"
        self.chapter_links_xpath = "/html/body/div[1]/div/div/div[2]/div/div[6]/div/div//a"
        self.content_xpath = "/html/body/div[1]/div/div/div/div[2]/div[4]/p//text()"
        
        # 初始化访问记录
        self._last_url = None
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    def extract_novel_id(self, url: str) -> Optional[str]:
        """从URL中提取小说ID"""
        # 匹配模式: https://ttks.tw/novel/chapters/{novel_id}/index.html
        match = re.search(r'/novel/chapters/([^/]+)/', url)
        return match.group(1) if match else None
    
    def get_novel_name_from_url(self, url: str) -> str:
        """从URL中提取并格式化小说名称"""
        novel_id = self.extract_novel_id(url)
        if novel_id:
            # 将URL中的小说ID转换为可读的名称
            # 例如: wobeitamenlianaimonile -> 我被她们恋爱模拟了
            name = novel_id.replace('-', ' ').replace('_', ' ')
            # 首字母大写
            name = ' '.join(word.capitalize() for word in name.split())
            return name
        return "未知小说"
    
    async def fetch_page_with_fallback(self, url: str) -> str:
        """使用多种方法尝试获取页面内容"""
        # 首先尝试主要方法
        try:
            return await self.fetch_page(url)
        except Exception as e:
            logging.warning(f"主要方法失败: {e}")
            
        # 尝试不同的浏览器指纹
        browser_types = ["chrome120", "chrome119", "safari15_5", "edge101"]
        
        for browser in browser_types:
            try:
                logging.info(f"尝试使用 {browser} 指纹...")
                
                # 创建新的会话
                if self.session:
                    await self.session.close()
                
                self.session = AsyncSession(
                    impersonate=browser,
                    timeout=60,
                    verify=False
                )
                
                # 使用更简单的头部
                headers = {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
                    "Accept-Encoding": "gzip, deflate, br",
                    "DNT": "1",
                    "Connection": "keep-alive",
                    "Upgrade-Insecure-Requests": "1"
                }
                
                # 更长的延迟
                await asyncio.sleep(random.uniform(30, 60))
                
                response = await self.session.get(url, headers=headers, timeout=60)
                if response.status_code == 200:
                    logging.info(f"使用 {browser} 指纹成功获取页面")
                    return response.text
                    
            except Exception as e:
                logging.warning(f"使用 {browser} 指纹失败: {e}")
                continue
        
        # 所有方法都失败
        raise ValueError(f"所有方法都无法访问页面: {url}")

    async def fetch_page(self, url: str) -> str:
        """使用 curl_cffi 获取页面内容，完美模拟浏览器"""
        # 更完整的浏览器头部，模拟真实用户访问
        headers = {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6",
            "Accept-Encoding": "gzip, deflate, br",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",  # 模拟直接访问
            "Sec-Fetch-User": "?1",
            "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "DNT": "1",
            "Connection": "keep-alive"
        }
        
        # 如果不是首次访问，设置合适的 Referer
        if hasattr(self, '_last_url') and self._last_url:
            headers["Referer"] = self._last_url
            headers["Sec-Fetch-Site"] = "same-origin"
        
        # 随机延迟15-25秒，更保守的策略
        delay = random.uniform(8, 15)
        logging.info(f"等待 {delay:.1f} 秒后访问: {url}")
        await asyncio.sleep(delay)
        
        max_retries = 3
        for attempt in range(max_retries):
            try:
                # 创建新的会话实例，避免会话状态问题
                if attempt > 0:
                    await self.session.close()
                    self.session = AsyncSession(impersonate="chrome120")
                
                response = await self.session.get(url, headers=headers, timeout=45, allow_redirects=True)
                
                # 记录当前URL用于下次请求的Referer
                self._last_url = url
                
                if response.status_code == 200:
                    return response.text
                elif response.status_code == 403:
                    logging.warning(f"403 Forbidden {url}，尝试第 {attempt + 1}/{max_retries} 次")
                    if attempt < max_retries - 1:
                        # 403错误时使用更长的延迟
                        wait_time = random.uniform(30, 60) * (attempt + 1)
                        logging.info(f"等待 {wait_time:.1f} 秒后重试...")
                        await asyncio.sleep(wait_time)
                        continue
                    else:
                        raise ValueError(f"HTTP错误 403: {url}")
                elif response.status_code == 429:
                    # 遇到429错误时进入长效冷却模式
                    wait_time = 120 * (attempt + 1)  # 递增等待时间
                    logging.warning(f"遇到速率限制 {url}，等待 {wait_time} 秒...")
                    await asyncio.sleep(wait_time)
                    continue
                else:
                    logging.error(f"请求失败 {url}: {response.status_code}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(random.uniform(20, 40))
                        continue
                    raise ValueError(f"HTTP错误 {response.status_code}: {url}")
                    
            except Exception as e:
                error_msg = str(e)
                if "403" in error_msg or "429" in error_msg:
                    if attempt < max_retries - 1:
                        wait_time = random.uniform(60, 120) * (attempt + 1)
                        logging.warning(f"网络错误 {url}: {error_msg[:100]}，等待 {wait_time:.1f} 秒后重试...")
                        await asyncio.sleep(wait_time)
                        continue
                
                logging.error(f"网络异常 {url}: {error_msg}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(random.uniform(30, 60))
                    continue
                raise
    
    async def establish_session(self) -> bool:
        """建立合法的浏览会话，先访问首页"""
        try:
            logging.info("正在建立浏览会话...")
            homepage_url = "https://ttks.tw/"
            
            headers = {
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                "Accept-Language": "zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6",
                "Accept-Encoding": "gzip, deflate, br",
                "Cache-Control": "no-cache",
                "Pragma": "no-cache",
                "Upgrade-Insecure-Requests": "1",
                "Sec-Fetch-Dest": "document",
                "Sec-Fetch-Mode": "navigate",
                "Sec-Fetch-Site": "none",
                "Sec-Fetch-User": "?1",
                "DNT": "1",
                "Connection": "keep-alive"
            }
            
            # 访问首页建立会话
            response = await self.session.get(homepage_url, headers=headers, timeout=45)
            if response.status_code == 200:
                self._last_url = homepage_url
                logging.info("浏览会话建立成功")
                # 模拟用户浏览行为，短暂停留
                await asyncio.sleep(random.uniform(3, 8))
                return True
            else:
                logging.warning(f"建立会话失败: {response.status_code}")
                return False
                
        except Exception as e:
            logging.error(f"建立会话异常: {e}")
            return False

    async def get_novel_info(self, novel_url: str) -> Optional[Dict[str, Any]]:
        """获取小说基本信息"""
        try:
            # 尝试从网页解析小说名称
            novel_name = None
            try:
                content = await self.fetch_page_with_fallback(novel_url)
                from lxml import html
                tree = html.fromstring(content)
                
                # 使用xpath提取小说名称
                name_elements = tree.xpath(self.novel_name_xpath)
                if name_elements:
                    novel_name = name_elements[0].strip()
                    # 应用繁简转换
                    if self.text_converter:
                        novel_name, _ = self.text_converter.detect_and_convert_text(novel_name)
            except Exception as e:
                logging.warning(f"从网页解析小说名称失败: {e}")
            
            # 如果网页解析失败，从URL获取小说名称作为备选
            if not novel_name:
                novel_name = self.get_novel_name_from_url(novel_url)
            
            return {
                'name': self.content_processor.sanitize_filename(novel_name),
                'url': novel_url,
                'id': self.extract_novel_id(novel_url)
            }
        except Exception as e:
            logging.error(f"获取小说信息失败: {e}")
            return None
    
    async def get_chapter_list(self, novel_url: str) -> List[Dict[str, str]]:
        """获取章节列表"""
        try:
            content = await self.fetch_page_with_fallback(novel_url)
            
            from lxml import html
            tree = html.fromstring(content)
            
            # 获取所有章节链接
            chapter_elements = tree.xpath(self.chapter_links_xpath)
            chapters = []
            
            for element in chapter_elements:
                try:
                    # 获取链接
                    href = element.get('href', '')
                    if not href:
                        continue
                    
                    # 转换为绝对URL
                    if href.startswith('/'):
                        chapter_url = self.domain + href
                    elif href.startswith('http'):
                        chapter_url = href
                    else:
                        chapter_url = urljoin(novel_url, href)
                    
                    # 获取章节标题
                    title = element.text_content().strip() if hasattr(element, 'text_content') else ''
                    if not title:
                        # 从URL推断章节号
                        chapter_match = re.search(r'/(\d+)\.html$', chapter_url)
                        if chapter_match:
                            title = f"第{chapter_match.group(1)}章"
                        else:
                            title = f"章节{len(chapters) + 1}"
                    
                    chapters.append({
                        'title': title,
                        'url': chapter_url,
                        'index': len(chapters)
                    })
                    
                except Exception as e:
                    logging.debug(f"解析章节链接失败: {e}")
                    continue
            
            # 按章节号排序
            def extract_chapter_number(chapter):
                match = re.search(r'/(\d+)\.html$', chapter['url'])
                return int(match.group(1)) if match else chapter['index']
            
            chapters.sort(key=extract_chapter_number)
            
            return chapters
            
        except Exception as e:
            logging.error(f"获取章节列表失败: {e}")
            return []
    
    def filter_ttks_ads(self, content: str) -> str:
        """过滤TTKS网站特有的广告内容"""
        if not content:
            return content
        
        lines = content.split('\n')
        filtered_lines = []
        
        # TTKS网站特有的广告模式
        ttks_ad_patterns = [
            r'.*读小说选天天看小说.*',
            r'.*𝘁𝘁𝗸𝘀\.𝘁𝘄.*',
            r'.*ttks\.tw.*',
            r'.*天天看小说.*',
            r'.*超流畅.*',
            r'.*无广告.*',
            r'.*更新最快.*',
            r'.*手机阅读.*',
            r'.*免费阅读.*',
            r'.*在线阅读.*',
            r'.*章节错误.*点此举报.*',
            r'.*举报章节错误.*',
            r'.*本章未完.*点击下一页继续阅读.*',
            r'.*点击下一页继续阅读.*',
            r'.*上一章.*下一章.*',
            r'.*返回目录.*',
            r'.*加入书签.*',
            r'.*推荐阅读.*',
            r'.*相关推荐.*',
            r'.*热门推荐.*',
            r'.*最新章节.*',
            r'.*章节列表.*',
            r'.*全文阅读.*',
            r'.*小说网.*',
            r'.*阅读网.*',
            r'.*文学网.*',
            r'.*书友.*正在阅读.*',
            r'.*正在手打中.*',
            r'.*手打中.*请稍等片刻.*',
            r'.*内容更新后.*请重新刷新页面.*',
            r'.*请重新刷新页面.*',
            r'.*网页版章节内容慢.*',
            r'.*请下载.*app.*',
            r'.*下载.*app.*',
            r'.*客户端.*',
            r'.*APP.*',
            r'.*应用.*',
            r'.*软件.*',
        ]
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # 检查是否匹配广告模式
            is_ad = False
            for pattern in ttks_ad_patterns:
                if re.match(pattern, line, re.IGNORECASE):
                    is_ad = True
                    break
            
            # 额外检查：包含特殊Unicode字符的可能是广告
            if not is_ad and any(ord(char) > 0x1F600 for char in line):
                # 检查是否包含特殊字体的ttks相关内容
                if any(keyword in line.lower() for keyword in ['ttks', '天天看', '小说', '阅读']):
                    is_ad = True
            
            # 检查是否是纯数字或特殊符号行（可能是页面元素）
            if not is_ad and len(line) < 10 and re.match(r'^[0-9\s\-_=+|<>()[\]{}.,;:!?]*$', line):
                is_ad = True
            
            if not is_ad:
                filtered_lines.append(line)
        
        # 移除连续的空行，保留段落间的单个空行
        result_lines = []
        prev_empty = False
        for line in filtered_lines:
            if line.strip():
                result_lines.append(line)
                prev_empty = False
            elif not prev_empty:
                result_lines.append('')
                prev_empty = True
        
        return '\n'.join(result_lines).strip()
    
    def check_existing_chapter(self, temp_file: Path) -> bool:
        """检查章节文件是否已存在且有效（大于1KB）"""
        if temp_file.exists():
            file_size = temp_file.stat().st_size
            if file_size > 1024:  # 大于1KB认为是有效文件
                return True
            else:
                # 删除无效的小文件
                try:
                    temp_file.unlink()
                    logging.warning(f"删除无效小文件: {temp_file} (大小: {file_size} bytes)")
                except:
                    pass
        return False

    async def check_and_fix_chapters(self, novel_temp_dir: Path, chapters: List[Dict[str, str]]) -> bool:
        """检查章节完整性并修复缺失或损坏的章节"""
        missing_chapters = []
        small_chapters = []
        
        console.print(f"[blue]🔍 正在检查 {len(chapters)} 个章节的完整性...[/blue]")
        
        # 检查所有章节
        for i, chapter in enumerate(chapters):
            temp_file = novel_temp_dir / f"chapter_{i:04d}.txt"
            
            if not temp_file.exists():
                missing_chapters.append((i, chapter))
            else:
                file_size = temp_file.stat().st_size
                if file_size < 1024:  # 小于1KB认为是损坏文件
                    small_chapters.append((i, chapter))
        
        # 报告检查结果
        total_issues = len(missing_chapters) + len(small_chapters)
        if total_issues == 0:
            console.print(f"[green]✅ 所有章节检查完成，无需修复[/green]")
            return True
        
        if missing_chapters:
            missing_str = ", ".join([f"第{i+1}章" for i, _ in missing_chapters[:5]])
            if len(missing_chapters) > 5:
                missing_str += f" 等{len(missing_chapters)}个"
            console.print(f"[yellow]⚠️ 发现 {len(missing_chapters)} 个缺失章节: {missing_str}[/yellow]")
            
            # 显示缺失章节的URL
            for i, chapter in missing_chapters[:3]:  # 只显示前3个的URL
                console.print(f"[blue]  第{i+1}章 URL: {chapter['url']}[/blue]")
            if len(missing_chapters) > 3:
                console.print(f"[blue]  ... 还有 {len(missing_chapters) - 3} 个缺失章节[/blue]")
        
        if small_chapters:
            small_str = ", ".join([f"第{i+1}章" for i, _ in small_chapters[:5]])
            if len(small_chapters) > 5:
                small_str += f" 等{len(small_chapters)}个"
            console.print(f"[yellow]⚠️ 发现 {len(small_chapters)} 个损坏章节: {small_str}[/yellow]")
            
            # 显示损坏章节的URL和文件大小
            for i, chapter in small_chapters[:3]:  # 只显示前3个的URL
                temp_file = novel_temp_dir / f"chapter_{i:04d}.txt"
                file_size = temp_file.stat().st_size if temp_file.exists() else 0
                console.print(f"[blue]  第{i+1}章 ({file_size}B) URL: {chapter['url']}[/blue]")
        
        # 修复章节
        console.print(f"[blue]🔧 正在修复 {total_issues} 个问题章节...[/blue]")
        
        all_problem_chapters = missing_chapters + small_chapters
        success_count = 0
        skipped_count = 0
        failed_attempts = {}  # 记录失败次数
        
        for i, chapter in all_problem_chapters:
            try:
                # 检查是否已经多次失败
                if failed_attempts.get(i, 0) >= 2:
                    console.print(f"[yellow]⏭️ 第{i+1}章已多次失败，跳过重试[/yellow]")
                    skipped_count += 1
                    continue
                
                console.print(f"[cyan]正在重新下载第{i+1}章: {chapter['title'][:30]}...[/cyan]")
                console.print(f"[blue]  章节URL: {chapter['url']}[/blue]")
                
                # 删除损坏的文件
                temp_file = novel_temp_dir / f"chapter_{i:04d}.txt"
                if temp_file.exists():
                    temp_file.unlink()
                
                # 重新下载
                result = await self.download_chapter(chapter['url'], chapter['title'], i, novel_temp_dir)
                if result:
                    # 检查下载的文件大小
                    if temp_file.exists():
                        file_size = temp_file.stat().st_size
                        if file_size < 100:  # 小于100字节认为是无效内容
                            console.print(f"[yellow]⚠️ 第{i+1}章内容过少({file_size}B)，标记为跳过[/yellow]")
                            failed_attempts[i] = failed_attempts.get(i, 0) + 1
                            skipped_count += 1
                            continue
                    
                    success_count += 1
                    console.print(f"[green]✅ 第{i+1}章修复成功[/green]")
                else:
                    failed_attempts[i] = failed_attempts.get(i, 0) + 1
                    if failed_attempts[i] >= 2:
                        console.print(f"[yellow]⚠️ 第{i+1}章多次失败，将跳过 - URL: {chapter['url']}[/yellow]")
                        skipped_count += 1
                    else:
                        console.print(f"[red]❌ 第{i+1}章修复失败 - URL: {chapter['url']}[/red]")
                    
            except Exception as e:
                failed_attempts[i] = failed_attempts.get(i, 0) + 1
                console.print(f"[red]❌ 第{i+1}章修复异常: {e}[/red]")
                console.print(f"[red]  失败URL: {chapter['url']}[/red]")
        
        total_processed = success_count + skipped_count
        console.print(f"[blue]📊 章节修复完成: {success_count}成功, {skipped_count}跳过, {total_issues-total_processed}失败[/blue]")
        
        # 更宽松的成功判断：只要失败章节不超过总章节的5%，就认为修复成功
        failed_count = total_issues - total_processed
        total_chapters = len(chapters)
        
        if failed_count <= max(2, total_chapters * 0.05):  # 最多允许5%的章节失败，但至少允许2个
            if failed_count > 0:
                console.print(f"[yellow]ℹ️ 仅有 {failed_count} 个章节无法获取，将继续合并其余章节[/yellow]")
            if skipped_count > 0:
                console.print(f"[yellow]ℹ️ 已跳过 {skipped_count} 个无效章节，这些章节可能在原网站不存在或无内容[/yellow]")
            return True
        else:
            console.print(f"[red]❌ 失败章节过多({failed_count}个，占{failed_count/total_chapters:.1%})，建议重新下载整本小说[/red]")
            return False
    
    async def download_chapter(self, chapter_url: str, chapter_title: str, chapter_index: int, novel_temp_dir: Path) -> Optional[str]:
        """下载单个章节内容到临时文件（支持断点续传）"""
        # 生成临时文件路径
        temp_file = novel_temp_dir / f"chapter_{chapter_index:04d}.txt"
        
        # 检查是否已存在有效的章节文件
        if self.check_existing_chapter(temp_file):
            logging.info(f"章节已存在，跳过下载: {chapter_title}")
            return str(temp_file)
        
        try:
            content = await self.fetch_page_with_fallback(chapter_url)
            text_parts = self.content_processor.extract_chapter_content(content)
            
            if not text_parts:
                return None
            
            chapter_content = self.content_processor.optimize_chapter_content(text_parts)
            
            if not chapter_content:
                return None
            
            # 应用TTKS网站特有的广告过滤
            chapter_content = self.filter_ttks_ads(chapter_content)
            
            # 应用繁简转换
            if self.text_converter:
                chapter_content, _ = self.text_converter.detect_and_convert_text(chapter_content)
                chapter_title, _ = self.text_converter.detect_and_convert_text(chapter_title)
            
            # 检查内容中是否已包含章节标题，避免重复
            content_lines = chapter_content.strip().split('\n')
            first_line = content_lines[0].strip() if content_lines else ""
            
            # 如果第一行不是章节标题，则添加章节标题
            if not (chapter_title in first_line or first_line.startswith('第') and '章' in first_line):
                formatted_content = f"\n\n=== {chapter_title} ===\n\n{chapter_content}\n"
            else:
                # 如果已有标题，直接使用内容
                formatted_content = f"\n\n{chapter_content}\n"
            
            # 保存到临时文件
            with open(temp_file, 'w', encoding='utf-8') as f:
                f.write(formatted_content)
            
            return str(temp_file)
            
        except Exception as e:
            logging.error(f"下载章节失败 {chapter_url}: {e}")
            return None
    
    async def download_novel(self, novel_url: str) -> bool:
        """下载完整小说"""
        try:
            console.print(f"[blue]📖 正在分析小说: {novel_url}[/blue]")
            
            # 首先建立合法的浏览会话
            if not await self.establish_session():
                console.print("[yellow]⚠️ 无法建立浏览会话，继续尝试直接访问...[/yellow]")
            
            # 获取小说信息
            novel_info = await self.get_novel_info(novel_url)
            if not novel_info:
                console.print("[red]❌ 无法获取小说信息[/red]")
                return False
            
            novel_name = novel_info['name']
            console.print(f"[green]📚 小说名称: {novel_name}[/green]")
            
            # 检查是否已存在
            output_file = self.base_dir / f"{novel_name}.txt"
            if output_file.exists():
                console.print(f"[yellow]📁 文件已存在: {output_file}[/yellow]")
                from rich.prompt import Confirm
                if not Confirm.ask("是否重新下载？"):
                    return True
            
            # 获取章节列表
            console.print("[blue]🔍 正在获取章节列表...[/blue]")
            chapters = await self.get_chapter_list(novel_url)
            
            if not chapters:
                console.print("[red]❌ 未找到章节列表[/red]")
                return False
            
            console.print(f"[green]📋 找到 {len(chapters)} 个章节[/green]")
            
            # 创建小说专用临时目录
            novel_temp_dir = self.temp_dir / self.content_processor.sanitize_filename(novel_name)
            novel_temp_dir.mkdir(parents=True, exist_ok=True)
            
            # 检查已存在的章节文件
            existing_chapters = 0
            for i in range(len(chapters)):
                temp_file = novel_temp_dir / f"chapter_{i:04d}.txt"
                if self.check_existing_chapter(temp_file):
                    existing_chapters += 1
            
            if existing_chapters > 0:
                console.print(f"[yellow]📁 发现 {existing_chapters} 个已下载章节，将进行断点续传[/yellow]")
            
            # 下载章节
            with Progress(
                SpinnerColumn(),
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                TaskProgressColumn(),
                console=console,
                transient=False
            ) as progress:
                
                task_id = progress.add_task(
                    f"[cyan]下载 {novel_name}[/cyan]", 
                    total=len(chapters)
                )
                
                downloaded_files = []
                failed_chapters = []
                skipped_chapters = 0
                
                for i, chapter in enumerate(chapters):
                    try:
                        # 检查是否已存在
                        temp_file_path = novel_temp_dir / f"chapter_{i:04d}.txt"
                        if self.check_existing_chapter(temp_file_path):
                            downloaded_files.append(str(temp_file_path))
                            skipped_chapters += 1
                            progress.update(task_id, description=f"[green]跳过已存在 {novel_name} - 第{i+1}/{len(chapters)}章[/green]", advance=1)
                            continue
                        
                        # 显示当前状态
                        progress.update(task_id, description=f"[cyan]下载中 {novel_name} - 第{i+1}/{len(chapters)}章[/cyan]")
                        
                        temp_file = await self.download_chapter(chapter['url'], chapter['title'], i, novel_temp_dir)
                        if temp_file:
                            downloaded_files.append(temp_file)
                        else:
                            failed_chapters.append(chapter['title'])
                        
                        progress.update(task_id, advance=1)
                        
                    except Exception as e:
                        error_msg = str(e)
                        failed_chapters.append(f"{chapter['title']} ({error_msg})")
                        # 如果是429错误，显示冷却状态
                        if "429" in error_msg:
                            progress.update(task_id, description=f"[red]冷却中 {novel_name} - 第{i+1}/{len(chapters)}章[/red]")
                        progress.update(task_id, advance=1)
                
                # 合并所有章节文件
                if downloaded_files:
                    # 在合并前检查章节完整性
                    console.print(f"[blue]🔍 正在检查章节完整性...[/blue]")
                    check_success = await self.check_and_fix_chapters(novel_temp_dir, chapters)
                    
                    if not check_success:
                        console.print("[red]❌ 章节检查失败，无法合并文件[/red]")
                        return False
                    
                    console.print(f"[blue]📝 正在合并 {len(downloaded_files)} 个章节文件...[/blue]")
                    
                    # 重新获取下载的文件列表（可能有新修复的文件）
                    downloaded_files = []
                    for i in range(len(chapters)):
                        temp_file_path = novel_temp_dir / f"chapter_{i:04d}.txt"
                        if self.check_existing_chapter(temp_file_path):
                            downloaded_files.append(str(temp_file_path))
                    
                    full_content = f"《{novel_name}》\n\n"
                    
                    # 按文件名排序确保章节顺序正确
                    downloaded_files.sort()
                    
                    for temp_file in downloaded_files:
                        try:
                            with open(temp_file, 'r', encoding='utf-8') as f:
                                chapter_content = f.read()
                                full_content += chapter_content
                        except Exception as e:
                            logging.error(f"读取临时文件失败 {temp_file}: {e}")
                    
                    # 保存最终文件
                    with open(output_file, 'w', encoding='utf-8') as f:
                        f.write(full_content)
                    
                    # 清理临时文件
                    console.print(f"[blue]🧹 清理临时文件...[/blue]")
                    try:
                        import shutil
                        shutil.rmtree(novel_temp_dir)
                    except Exception as e:
                        logging.warning(f"清理临时目录失败: {e}")
                    
                    console.print(f"[green]✅ 下载完成: {output_file}[/green]")
                    console.print(f"[blue]📊 成功: {len(downloaded_files)}/{len(chapters)} 章节[/blue]")
                    if skipped_chapters > 0:
                        console.print(f"[yellow]⏭️ 跳过: {skipped_chapters} 个已存在章节[/yellow]")
                    
                    if failed_chapters:
                        console.print(f"[yellow]⚠️ 失败章节: {len(failed_chapters)}[/yellow]")
                        for failed in failed_chapters[:5]:  # 只显示前5个
                            console.print(f"  • {failed}")
                        if len(failed_chapters) > 5:
                            console.print(f"  • ... 还有 {len(failed_chapters) - 5} 个")
                    
                    return True
                else:
                    console.print("[red]❌ 没有成功下载任何章节[/red]")
                    return False
                    
        except Exception as e:
            console.print(f"[red]❌ 下载失败: {e}[/red]")
            logging.exception("下载过程中发生错误")
            return False

async def main():
    """主函数"""
    import sys
    
    if len(sys.argv) != 2:
        console.print("[yellow]使用方法: python ttks_novel_downloader.py <小说URL>[/yellow]")
        console.print("[yellow]示例: python ttks_novel_downloader.py https://ttks.tw/novel/chapters/wobeitamenlianaimonile/index.html[/yellow]")
        return
    
    novel_url = sys.argv[1]
    
    # 处理帮助参数
    if novel_url in ['--help', '-h', 'help']:
        console.print("[blue]TTKS.TW 网站专用小说下载器[/blue]")
        console.print("[yellow]使用方法: python ttks_novel_downloader.py <小说URL>[/yellow]")
        console.print("[yellow]示例: python ttks_novel_downloader.py https://ttks.tw/novel/chapters/wobeitamenlianaimonile/index.html[/yellow]")
        console.print("\n[green]功能特性:[/green]")
        console.print("  • 自动解析章节列表")
        console.print("  • 智能内容提取")
        console.print("  • 繁简转换支持")
        console.print("  • 进度显示")
        console.print("  • 错误恢复")
        return
    
    # 验证URL
    if not novel_url.startswith('https://ttks.tw/'):
        console.print("[red]❌ 只支持 ttks.tw 网站的小说[/red]")
        console.print("[yellow]示例URL: https://ttks.tw/novel/chapters/wobeitamenlianaimonile/index.html[/yellow]")
        return
    
    try:
        async with TTKSNovelDownloader() as downloader:
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
    asyncio.run(main())