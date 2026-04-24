#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import asyncio
import logging
import shutil
import re
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional, Tuple, Dict, Any

import aiofiles
from lxml import etree
from rich.progress import Progress

from config_service import Config
from content_processor import ContentProcessor
from network_client import NetworkClient
from enhanced_blacklist import EnhancedBlacklist
from ebook_converter import EbookConverter
from text_converter import TextConverter
from date_manager import DateManager

class NovelCrawler:
    
    def __init__(self, config: Config):
        self.config = config
        
        # 使用日期管理器来计算目标时间
        self.date_manager = DateManager()
        self.target_time, self.actual_days_limit = self.date_manager.get_download_date_range()
        
        self.total_novels = 0
        self.current_novel = 0
        
        self.network_client = NetworkClient(
            config.user_agent, 
            config.retry_count, 
            config.retry_delay, 
            proxy=config.proxy,
            timeout=getattr(config, 'timeout', 30)  # 添加超时参数，默认30秒
        )
        self.content_processor = ContentProcessor(config.novel_content)
        
        self.enhanced_blacklist = None
        if config.use_enhanced_blacklist:
            blacklist_config = config.blacklist if isinstance(config.blacklist, dict) else {}
            self.enhanced_blacklist = EnhancedBlacklist(config_data=blacklist_config)
        
        self.ebook_converter = EbookConverter(output_dir=config.base_dir) if config.convert_formats else None
        if config.encoding_map:
            self.network_client.update_encoding_map(config.encoding_map)
        
        # 初始化文本转换器
        self.text_converter = None
        text_config = getattr(config, 'text_conversion', {})
        if text_config.get('enabled', False) and text_config.get('traditional_to_simplified', False):
            self.text_converter = TextConverter()
            if self.text_converter.is_available():
                logging.info("繁简转换器已启用")
            else:
                logging.warning("繁简转换器初始化失败，将跳过文本转换")
                self.text_converter = None
    
    def _check_file_exists(self, file_path: Path) -> bool:
        """同步检查文件是否存在（用于线程池）"""
        return file_path.exists()
    
    def _get_file_size(self, file_path: Path) -> int:
        """同步获取文件大小（用于线程池）"""
        return file_path.stat().st_size
    
    def _merge_files_sync(self, temp_dir: Path, final_path: Path) -> None:
        """同步合并文件（用于线程池）"""
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(self.merge_files(temp_dir, final_path))
        finally:
            loop.close()
    
    async def __aenter__(self):
        await self.network_client.__aenter__()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.network_client.__aexit__(exc_type, exc_val, exc_tb)

    def _print_msg(self, progress: Optional[Progress], message: str, level: str = "INFO"):
        """打印带时间戳的消息"""
        current_time = datetime.now().strftime("%Y/%m/%d %H:%M:%S")
        msg_content = f"{current_time} {message}"
        if progress:
            if level == "ERROR":
                progress.console.print(f"[red]{msg_content}[/red]")
            else:
                progress.console.print(msg_content)
        else:
            print(msg_content)
    
    def print_date_info(self, progress: Optional[Progress] = None):
        """打印日期相关信息"""
        last_date = self.date_manager.get_last_download_date()
        days_since = self.date_manager.get_days_since_last_download()
        
        if last_date is None:
            self._print_msg(progress, f"📅 首次运行，将下载 {self.actual_days_limit} 天内的小说（目标日期: {self.target_time}）", level="INFO")
        else:
            self._print_msg(progress, f"📅 上次下载日期: {last_date}，距今 {days_since} 天", level="INFO")
            self._print_msg(progress, f"📅 本次下载 {self.actual_days_limit} 天内的小说（目标日期: {self.target_time}）", level="INFO")

    @staticmethod
    def sanitize_filename(name: str) -> str:
        if not name: return "Unknown_Novel"
        name = re.sub(r'[\n\r\t]', '', name)
        name = re.sub(r'\(.*?\)', '', name)
        name = re.sub(r'（.*?）', '', name)
        name = re.sub(r'[\\/:*?"<>|]', '_', name)
        name = re.sub(r'\s+', ' ', name)
        name = name.strip().rstrip('.')
        return name if name else "Untitled_Novel"

    async def _fetch_novel_name_from_detail(self, url: str) -> Optional[str]:
        """仅获取详情页以解析书名"""
        try:
            content = await self.network_client.fetch_page(url)
            html = etree.HTML(content)
            novel_name_elements = html.xpath(self.config.novel_name_x)
            if not novel_name_elements:
                return None
            
            match novel_name_elements[0]:
                case str() as name: raw_name = name
                case element if hasattr(element, 'text'): raw_name = element.text
                case _: raw_name = str(novel_name_elements[0])
            
            return self.sanitize_filename(raw_name)
        except Exception:
            return None

    async def get_novel_info(self, url: str) -> Optional[Dict[str, Any]]:
        """获取单本小说的基本信息"""
        try:
            content = await self.network_client.fetch_page(url)
            html = etree.HTML(content)
            
            if html is None:
                return None
            
            # 获取小说名称
            novel_name_elements = html.xpath(self.config.novel_name_x)
            if not novel_name_elements:
                return None
            
            match novel_name_elements[0]:
                case str() as name: raw_name = name
                case element if hasattr(element, 'text'): raw_name = element.text
                case _: raw_name = str(novel_name_elements[0])
            
            novel_name = self.sanitize_filename(raw_name)
            
            # 获取章节列表（用于验证小说是否有效）
            chapter_elements = html.xpath(self.config.chapter_url_x)
            chapter_count = len(chapter_elements) if chapter_elements else 0
            
            return {
                'name': novel_name,
                'url': url,
                'chapter_count': chapter_count,
                'valid': chapter_count > 0
            }
            
        except Exception as e:
            logging.error(f"获取小说信息失败 {url}: {e}")
            return None

    async def scan_candidates(self, progress: Optional[Progress] = None) -> List[Dict[str, Any]]:
        """
        扫描更新，并确保每本书都有名字。
        返回标准化的候选书籍列表，供DownloadPool使用。
        """
        candidates = []
        
        # 显示日期信息
        self.print_date_info(progress)
        
        # 1. 获取所有列表页（添加错误处理）
        tasks = []
        valid_pages = []
        
        for page in self.config.page_list:
            url = f"{self.config.domain_name}{page}"
            tasks.append(self.network_client.fetch_page(url))
            valid_pages.append(url)
        
        if progress:
            self._print_msg(progress, f"正在扫描 {self.config.domain_name} ...")
            
        # 并发获取页面，但处理异常
        pages_content = await asyncio.gather(*tasks, return_exceptions=True)
        
        raw_items = []
        successful_pages = 0
        failed_pages = 0

        # 2. 解析列表页（跳过失败的页面）
        for i, page_content in enumerate(pages_content):
            if isinstance(page_content, Exception): 
                failed_pages += 1
                logging.warning(f"跳过失败页面: {valid_pages[i]} - {str(page_content)[:100]}")
                continue
            
            try:
                html = etree.HTML(page_content)
                if html is None:
                    failed_pages += 1
                    logging.warning(f"HTML解析失败: {valid_pages[i]}")
                    continue
                    
                dates = html.xpath(self.config.release_date)
                url_nodes = html.xpath(self.config.release_url)
                
                # 尝试获取列表页书名
                name_nodes = []
                if hasattr(self.config, 'list_novel_name') and self.config.list_novel_name:
                    name_nodes = html.xpath(self.config.list_novel_name)
                
                if not dates or not url_nodes:
                    logging.warning(f"XPath未匹配到内容: {valid_pages[i]}")
                    continue
                
                min_len = min(len(dates), len(url_nodes))
                page_items = 0
                
                for j in range(min_len):
                    try:
                        date_node = dates[j]
                        url_node = url_nodes[j]
                        
                        d_text = date_node if isinstance(date_node, str) else getattr(date_node, 'text', '').strip()
                        
                        if d_text and d_text > self.target_time:
                            item = {
                                'url': '', 
                                'name': None, 
                                'crawler': self,
                                'date': d_text
                            }
                            
                            # 提取 URL
                            if isinstance(url_node, str):
                                item['url'] = url_node.strip()
                            else:
                                item['url'] = url_node.get('href', '').strip()
                            
                            # 优先从列表页获取书名
                            if name_nodes and j < len(name_nodes):
                                name_node = name_nodes[j]
                                if isinstance(name_node, str):
                                    item['name'] = self.sanitize_filename(name_node.strip())
                                elif hasattr(name_node, 'text') and name_node.text:
                                    item['name'] = self.sanitize_filename(name_node.text.strip())
                            
                            # 如果列表页没有获取到书名，尝试从URL节点获取
                            if not item['name'] and hasattr(url_node, 'xpath'):
                                text_content = url_node.xpath('string(.)').strip()
                                if text_content:
                                    item['name'] = self.sanitize_filename(text_content)
                            
                            if item['url']:
                                if not item['url'].startswith(('http:', 'https:')):
                                    item['url'] = f"{self.config.domain_name}{item['url']}"
                                raw_items.append(item)
                                page_items += 1
                    except Exception as e:
                        logging.debug(f"解析单个项目失败: {e}")
                        continue
                
                if page_items > 0:
                    successful_pages += 1
                    
            except Exception as e:
                failed_pages += 1
                logging.error(f"解析页面失败 {valid_pages[i]}: {e}")

        if progress:
            self._print_msg(progress, f"页面解析完成: 成功 {successful_pages}, 失败 {failed_pages}, 找到 {len(raw_items)} 个候选项")

        # 3. 补全缺失的名字 (并发处理，但限制并发数)
        pending_name_tasks = []
        semaphore = asyncio.Semaphore(min(self.config.number_of_novel_threads, 3))  # 限制并发数

        async def fill_name(item):
            if not item['name']:
                async with semaphore:
                    try:
                        name = await self._fetch_novel_name_from_detail(item['url'])
                        if name:
                            item['name'] = name
                    except Exception as e:
                        logging.debug(f"获取书名失败 {item['url']}: {e}")

        for item in raw_items:
            if not item['name']:
                pending_name_tasks.append(fill_name(item))
        
        if pending_name_tasks:
            if progress:
                self._print_msg(progress, f"正在从详情页补全 {len(pending_name_tasks)} 本书的名称...")
            await asyncio.gather(*pending_name_tasks, return_exceptions=True)
        
        # 过滤掉仍然没有名字的（可能是死链或解析失败）
        final_candidates = [item for item in raw_items if item['name']]
        
        if progress:
            self._print_msg(progress, f"扫描完成: {self.config.domain_name} 最终获得 {len(final_candidates)} 本有效书籍")
        
        return final_candidates

    async def download_chapter(self, chapter_url: str, temp_dir: Path, index: int, retry_count: int = 0) -> bool:
        """下载单个章节
        
        Args:
            chapter_url: 章节URL
            temp_dir: 临时目录
            index: 章节索引
            retry_count: 当前重试次数
            
        Returns:
            bool: 下载是否成功
        """
        try:
            if not temp_dir.exists(): 
                temp_dir.mkdir(parents=True, exist_ok=True)
                
            temp_file = temp_dir / f"{index:04d}.txt"
            
            # 检查是否需要跳过（断点续传功能）
            if await asyncio.to_thread(self._check_file_exists, temp_file):
                file_size = await asyncio.to_thread(self._get_file_size, temp_file)
                if file_size >= 1024:  # 大于等于1KB，跳过下载
                    return True
                elif retry_count >= 2:  # 已重试2次仍小于1KB，保留文件
                    logging.info(f"章节 {index:04d} 重试2次后仍小于1KB，保留现有文件")
                    return True
            
            content = await self.network_client.fetch_page(chapter_url)
            text_parts = self.content_processor.extract_chapter_content(content)
            if text_parts:
                optimized_text = self.content_processor.optimize_chapter_content(text_parts)
                if optimized_text:
                    # 应用繁简转换
                    if self.text_converter:
                        text_config = getattr(self.config, 'text_conversion', {})
                        auto_detect = text_config.get('auto_detect', True)
                        if auto_detect:
                            optimized_text, _ = self.text_converter.detect_and_convert_text(optimized_text)
                        else:
                            optimized_text = self.text_converter.convert_traditional_to_simplified(optimized_text)
                    
                    async with aiofiles.open(temp_file, 'w', encoding='utf-8') as f:
                        await f.write(optimized_text + '\n')
                    
                    # 检查下载后的文件大小
                    file_size = await asyncio.to_thread(self._get_file_size, temp_file)
                    if file_size < 1024 and retry_count < 2:
                        logging.warning(f"章节 {index:04d} 下载后小于1KB，将重试")
                        return False  # 需要重试
                    
                    return True
            return False
        except Exception as e:
            logging.error(f"下载章节 {index:04d} 失败: {e}")
            return False

    async def check_and_fix_chapters(self, temp_dir: Path, total_chapters: int, chapter_urls: List[str], progress: Progress, task_id: int) -> bool:
        """检查章节完整性并修复小于1KB的章节
        
        Args:
            temp_dir: 临时目录
            total_chapters: 总章节数
            chapter_urls: 章节URL列表
            progress: 进度条对象
            task_id: 任务ID
            
        Returns:
            bool: 检查和修复是否成功
        """
        if not await asyncio.to_thread(self._check_file_exists, temp_dir):
            self._print_msg(progress, "临时目录不存在", level="ERROR")
            return False
            
        # 检查所有章节是否存在
        missing_chapters = []
        small_chapters = []  # 小于1KB的章节
        
        for i in range(total_chapters):
            temp_file = temp_dir / f"{i:04d}.txt"
            if not await asyncio.to_thread(self._check_file_exists, temp_file):
                missing_chapters.append(i)
            else:
                file_size = await asyncio.to_thread(self._get_file_size, temp_file)
                if file_size < 1024:
                    small_chapters.append(i)
        
        # 详细报告检查结果
        if missing_chapters:
            missing_str = ", ".join([f"第{i+1}章" for i in missing_chapters[:10]])  # 只显示前10个
            if len(missing_chapters) > 10:
                missing_str += f" 等{len(missing_chapters)}个章节"
            self._print_msg(progress, f"发现 {len(missing_chapters)} 个缺失章节: {missing_str}", level="WARNING")
            
            # 显示缺失章节的URL（用于调试）
            for i in missing_chapters[:5]:  # 只显示前5个的URL
                url = chapter_urls[i]
                full_url = f"{self.config.domain_name}{url}" if not url.startswith('http') else url
                self._print_msg(progress, f"  第{i+1}章 URL: {full_url}", level="INFO")
            if len(missing_chapters) > 5:
                self._print_msg(progress, f"  ... 还有 {len(missing_chapters) - 5} 个缺失章节", level="INFO")
            
            # 尝试重新下载缺失章节
            self._print_msg(progress, "正在重新下载缺失章节...")
            success = await self._retry_missing_chapters(missing_chapters, chapter_urls, temp_dir, progress, total_chapters)
            if not success:
                self._print_msg(progress, "重新下载缺失章节失败", level="ERROR")
                return False
            
        if small_chapters:
            small_str = ", ".join([f"第{i+1}章" for i in small_chapters[:10]])
            if len(small_chapters) > 10:
                small_str += f" 等{len(small_chapters)}个章节"
            self._print_msg(progress, f"发现 {len(small_chapters)} 个小于1KB的章节: {small_str}", level="WARNING")
            
            # 显示小章节的URL（用于调试）
            for i in small_chapters[:3]:  # 只显示前3个的URL
                url = chapter_urls[i]
                full_url = f"{self.config.domain_name}{url}" if not url.startswith('http') else url
                temp_file = temp_dir / f"{i:04d}.txt"
                file_size = await asyncio.to_thread(self._get_file_size, temp_file) if await asyncio.to_thread(self._check_file_exists, temp_file) else 0
                self._print_msg(progress, f"  第{i+1}章 ({file_size}B) URL: {full_url}", level="INFO")
            
            # 修复小于1KB的章节
            self._print_msg(progress, "正在修复小章节...")
            await self._fix_small_chapters(small_chapters, chapter_urls, temp_dir, progress)
        
        if not missing_chapters and not small_chapters:
            self._print_msg(progress, "所有章节检查完成，无需修复")
            
        return True

    async def _retry_missing_chapters(self, missing_chapters: List[int], chapter_urls: List[str], temp_dir: Path, progress: Progress, total_chapters: int) -> bool:
        """重新下载缺失的章节"""
        global_chapter_semaphore = asyncio.Semaphore(self.config.number_of_chapter_threads)
        
        # 记录失败次数，避免无限重试
        failed_attempts = {}
        
        async def retry_download_chapter(index: int):
            async with global_chapter_semaphore:
                url = chapter_urls[index]
                full_url = f"{self.config.domain_name}{url}" if not url.startswith('http') else url
                
                # 检查是否已经多次失败
                if failed_attempts.get(index, 0) >= 2:
                    self._print_msg(progress, f"第{index+1}章已多次失败，跳过重试", level="WARNING")
                    return False
                
                # 最多重试3次
                for retry in range(3):
                    success = await self.download_chapter(full_url, temp_dir, index, retry)
                    if success:
                        # 检查下载的文件大小
                        temp_file = temp_dir / f"{index:04d}.txt"
                        if await asyncio.to_thread(self._check_file_exists, temp_file):
                            file_size = await asyncio.to_thread(self._get_file_size, temp_file)
                            if file_size < 100:  # 小于100字节认为是无效内容
                                self._print_msg(progress, f"第{index+1}章内容过少({file_size}B)，标记为跳过", level="WARNING")
                                failed_attempts[index] = failed_attempts.get(index, 0) + 1
                                return False
                        return True
                    await asyncio.sleep(2)  # 增加重试间隔
                
                # 记录失败次数
                failed_attempts[index] = failed_attempts.get(index, 0) + 1
                return False
        
        # 并发重新下载缺失章节
        retry_tasks = [retry_download_chapter(i) for i in missing_chapters]
        results = await asyncio.gather(*retry_tasks, return_exceptions=True)
        
        # 检查重新下载结果
        success_count = 0
        skipped_count = 0
        
        for i, result in enumerate(results):
            chapter_index = missing_chapters[i]
            url = chapter_urls[chapter_index]
            full_url = f"{self.config.domain_name}{url}" if not url.startswith('http') else url
            
            if isinstance(result, Exception):
                self._print_msg(progress, f"第{chapter_index+1}章重新下载异常: {result}", level="ERROR")
                self._print_msg(progress, f"  失败URL: {full_url}", level="ERROR")
            elif result:
                success_count += 1
            else:
                # 检查是否是因为多次失败被跳过
                if failed_attempts.get(chapter_index, 0) >= 2:
                    skipped_count += 1
                    self._print_msg(progress, f"第{chapter_index+1}章多次失败，已跳过", level="WARNING")
                else:
                    self._print_msg(progress, f"第{chapter_index+1}章重新下载失败", level="ERROR")
                    self._print_msg(progress, f"  失败URL: {full_url}", level="ERROR")
        
        total_processed = success_count + skipped_count
        self._print_msg(progress, f"缺失章节处理完成: {success_count}成功, {skipped_count}跳过, {len(missing_chapters)-total_processed}失败")
        
        # 更宽松的成功判断：只要失败章节不超过总章节的5%，就认为可以继续
        failed_count = len(missing_chapters) - total_processed
        
        if failed_count <= max(2, total_chapters * 0.05):  # 最多允许5%的章节失败，但至少允许2个
            if failed_count > 0:
                self._print_msg(progress, f"仅有 {failed_count} 个章节无法获取，继续合并其余章节", level="WARNING")
            return True
        else:
            self._print_msg(progress, f"失败章节过多({failed_count}个，占{failed_count/total_chapters:.1%})，无法继续", level="ERROR")
            return False

    async def _fix_small_chapters(self, small_chapters: List[int], chapter_urls: List[str], temp_dir: Path, progress: Progress):
        """修复小于1KB的章节"""
        global_chapter_semaphore = asyncio.Semaphore(self.config.number_of_chapter_threads)
        
        async def retry_download_chapter(index: int):
            async with global_chapter_semaphore:
                url = chapter_urls[index]
                full_url = f"{self.config.domain_name}{url}" if not url.startswith('http') else url
                
                # 最多重试2次
                for retry in range(2):
                    success = await self.download_chapter(full_url, temp_dir, index, retry)
                    if success:
                        break
                    await asyncio.sleep(1)  # 重试间隔
        
        # 并发修复小章节
        retry_tasks = [retry_download_chapter(i) for i in small_chapters]
        await asyncio.gather(*retry_tasks, return_exceptions=True)
        
        # 再次检查修复结果
        fixed_count = 0
        for i in small_chapters:
            temp_file = temp_dir / f"{i:04d}.txt"
            if await asyncio.to_thread(self._check_file_exists, temp_file):
                file_size = await asyncio.to_thread(self._get_file_size, temp_file)
                if file_size >= 1024:
                    fixed_count += 1
        
        self._print_msg(progress, f"小章节修复完成: {fixed_count}/{len(small_chapters)} 个章节已修复")
        for i in small_chapters:
            temp_file = temp_dir / f"{i:04d}.txt"
            if await asyncio.to_thread(self._check_file_exists, temp_file):
                file_size = await asyncio.to_thread(self._get_file_size, temp_file)
                if file_size >= 1024:
                    fixed_count += 1
        
        logging.info(f"章节修复完成：{fixed_count}/{len(small_chapters)} 个章节已修复")
        return True

    async def merge_files(self, temp_dir: Path, final_path: Path, buffer_size: int = 65536) -> None:
        """流式合并临时文件到最终文件，优化内存使用
        
        Args:
            temp_dir: 临时文件目录
            final_path: 最终输出文件路径
            buffer_size: 缓冲区大小（默认64KB，适合大文件）
        """
        try:
            # 确保输出目录存在
            final_path.parent.mkdir(parents=True, exist_ok=True)
            
            # 获取所有临时文件并按序号排序
            temp_files = sorted(temp_dir.glob('*.txt'), key=lambda x: int(x.stem))
            
            if not temp_files:
                logging.warning(f"没有找到临时文件: {temp_dir}")
                return
            
            # 流式合并文件
            async with aiofiles.open(final_path, 'w', encoding='utf-8', buffering=buffer_size) as outfile:
                for i, temp_file in enumerate(temp_files):
                    try:
                        async with aiofiles.open(temp_file, 'r', encoding='utf-8', buffering=buffer_size) as infile:
                            # 流式读取并写入，避免大文件一次性加载到内存
                            while True:
                                chunk = await infile.read(buffer_size)
                                if not chunk:
                                    break
                                await outfile.write(chunk)
                                
                            # 在章节之间添加分隔符（可选）
                            if i < len(temp_files) - 1:
                                await outfile.write('\n')
                                
                    except Exception as e:
                        logging.warning(f"合并文件失败 {temp_file}: {e}")
                        continue
                        
            logging.info(f"成功合并 {len(temp_files)} 个文件到 {final_path}")
            
        except Exception as e:
            logging.error(f"文件合并过程失败: {e}")
            raise

    async def download_specific_novels(self, tasks: List[Dict[str, Any]], progress: Progress, task_id: int, show_chapter_progress: bool = False) -> None:
        """接收已过滤的任务列表进行下载
        
        Args:
            tasks: 下载任务列表
            progress: 进度条对象
            task_id: 任务ID
            show_chapter_progress: 是否显示章节级别的进度（单本下载时为True，批量下载时为False）
        """
        global_chapter_semaphore = asyncio.Semaphore(self.config.number_of_chapter_threads)
        novel_semaphore = asyncio.Semaphore(self.config.number_of_novel_threads)

        async def worker(item):
            async with novel_semaphore:
                try:
                    await self._download_logic(item['url'], item['name'], progress, task_id, global_chapter_semaphore, show_chapter_progress)
                except Exception as e:
                    self._print_msg(progress, f"下载失败 {item['name']}: {e}", level="ERROR")

        task_objs = [asyncio.create_task(worker(item)) for item in tasks]
        await asyncio.gather(*task_objs, return_exceptions=True)
        
        # 下载完成后更新最后下载日期
        try:
            self.date_manager.update_last_download_date()
            self._print_msg(progress, f"已更新下载日期记录", level="INFO")
        except Exception as e:
            self._print_msg(progress, f"更新下载日期失败: {e}", level="WARNING")

    async def _download_logic(self, novel_url: str, novel_name: str, progress: Progress, 
                            task_id: int, global_semaphore: asyncio.Semaphore, show_chapter_progress: bool = False) -> None:
        temp_dir = None
        progress_updated = False  # 添加标志来跟踪进度是否已更新
        
        try:
            # 直接进入下载流程，假设所有过滤已经在外部完成
            content = await self.network_client.fetch_page(novel_url)
            html = etree.HTML(content)
            
            base_dir = Path(self.config.base_dir)
            final_path = base_dir / f"{novel_name}.txt"
            temp_dir = base_dir / f"temp_{novel_name}"
            
            # 双重检查：防止在等待Semaphore期间文件被其他协程创建
            if final_path.exists():
                if show_chapter_progress:
                    progress.update(task_id, completed=1)
                else:
                    progress.update(task_id, advance=1)
                progress_updated = True  # 标记进度已更新
                return

            chapter_urls = html.xpath(self.config.chapter_url_x)
            if not chapter_urls:
                if show_chapter_progress:
                    progress.update(task_id, completed=1)
                else:
                    progress.update(task_id, advance=1)
                progress_updated = True  # 标记进度已更新
                return

            processed_urls = [
                url.strip() if isinstance(url, str)
                else url.text.strip() if hasattr(url, 'text')
                else str(url).strip()
                for url in chapter_urls
            ]

            # 只有在单本下载模式下才更新进度条总数为章节数
            if show_chapter_progress:
                progress.update(task_id, total=len(processed_urls))

            temp_dir.mkdir(parents=True, exist_ok=True)
            
            # 检查断点续传情况
            existing_chapters = 0
            if temp_dir.exists():
                for i in range(len(processed_urls)):
                    temp_file = temp_dir / f"{i:04d}.txt"
                    if temp_file.exists() and temp_file.stat().st_size >= 1024:
                        existing_chapters += 1
                
                if existing_chapters > 0:
                    self._print_msg(progress, f"{novel_name} 发现已下载 {existing_chapters}/{len(processed_urls)} 章节，继续下载...")

            downloaded_chapters = existing_chapters  # 从已有章节数开始计算
            progress_lock = asyncio.Lock()

            async def update_progress():
                nonlocal downloaded_chapters
                async with progress_lock:
                    downloaded_chapters += 1
                    if show_chapter_progress:
                        progress.update(task_id, completed=downloaded_chapters)

            async def download_with_semaphore(url: str, index: int):
                async with global_semaphore:
                    try:
                        full_url = f"{self.config.domain_name}{url}" if not url.startswith('http') else url
                        
                        # 检查是否需要下载（断点续传）
                        temp_file = temp_dir / f"{index:04d}.txt"
                        if temp_file.exists() and temp_file.stat().st_size >= 1024:
                            return  # 跳过已下载的章节
                        
                        # 下载章节，支持重试
                        for retry in range(3):  # 最多重试3次
                            success = await self.download_chapter(full_url, temp_dir, index, retry)
                            if success:
                                await update_progress()
                                break
                            await asyncio.sleep(1)
                    except Exception: 
                        pass

            # 并发下载章节
            tasks = [download_with_semaphore(url, i) for i, url in enumerate(processed_urls)]
            await asyncio.gather(*tasks)

            # 合并前检查章节完整性
            self._print_msg(progress, f"{novel_name} 下载完成，正在检查章节完整性...")
            check_success = await self.check_and_fix_chapters(temp_dir, len(processed_urls), processed_urls, progress, task_id)
            
            if not check_success:
                self._print_msg(progress, f"{novel_name} 章节检查失败，跳过合并", level="ERROR")
                return

            if temp_dir and temp_dir.exists():
                await asyncio.to_thread(self._merge_files_sync, temp_dir, final_path)
                await asyncio.to_thread(shutil.rmtree, temp_dir)
                
                self._print_msg(progress, f"{novel_name} 下载完成！")

                if self.ebook_converter and self.config.convert_formats:
                    for format_type in self.config.convert_formats:
                        await self.ebook_converter.convert(final_path, format_type)
        
        except Exception as e:
            self._print_msg(progress, f"下载异常 {novel_name}: {e}", level="ERROR")
            if temp_dir and temp_dir.exists():
                shutil.rmtree(temp_dir)
        finally:
            # 根据模式更新进度（只有在之前没有更新过的情况下）
            if not progress_updated:
                if show_chapter_progress:
                    # 单本下载模式：确保进度条完成
                    progress.update(task_id, completed=progress.tasks[task_id].total)
                else:
                    # 批量下载模式：每完成一本小说就+1
                    progress.update(task_id, advance=1)

    # 兼容旧代码接口（如果需要独立运行）
    async def start_download(self, progress: Progress) -> None:
        candidates = await self.scan_candidates(progress)
        task_id = progress.add_task(f"[cyan]任务 - {self.config.domain_name}[/cyan]", total=len(candidates))
        await self.download_specific_novels(candidates, progress, task_id)