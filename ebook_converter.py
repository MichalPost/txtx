#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import List, Optional, Dict, Tuple
import os
import tempfile
import shutil
import asyncio

# 电子书处理库
try:
    import ebooklib
    from ebooklib import epub
    EBOOKLIB_AVAILABLE = True
except ImportError:
    EBOOKLIB_AVAILABLE = False
    logging.warning("ebooklib 未安装，EPUB转换功能将不可用")

def _check_calibre_cli() -> bool:
    """检查calibre命令行工具是否可用"""
    try:
        import subprocess
        import os
        
        if shutil.which('ebook-convert'):
            return True
            
        common_paths = [
            r'C:\Program Files\Calibre2\ebook-convert.exe',
            r'C:\Program Files (x86)\Calibre2\ebook-convert.exe',
            '/Applications/calibre.app/Contents/MacOS/ebook-convert',
            '/usr/bin/ebook-convert'
        ]
        
        for path in common_paths:
            if os.path.isfile(path):
                result = subprocess.run([path, '--version'], 
                                      stdout=subprocess.PIPE, 
                                      stderr=subprocess.PIPE,
                                      text=True,
                                      shell=False)
                if result.returncode == 0:
                    os.environ['PATH'] += os.pathsep + os.path.dirname(path)
                    return True
        return False
    except Exception:
        return False

CALIBRE_AVAILABLE = False
try:
    from calibre.ebooks.conversion.cli import main as calibre_converter
    CALIBRE_AVAILABLE = True
    logging.info("已检测到Calibre Python库")
except ImportError:
    if _check_calibre_cli():
        CALIBRE_AVAILABLE = True
        logging.info("已检测到Calibre命令行工具")
    else:
        logging.warning("calibre 未安装或未配置，MOBI转换功能将不可用")

class ChapterInfo:
    """章节信息类"""
    def __init__(self, title: str, content: str, index: int):
        self.title = title
        self.content = content
        self.index = index

class EbookConverter:
    """电子书转换器类（精简版）"""
    
    def __init__(self, output_dir: Optional[str] = None):
        self.output_dir = output_dir

    async def convert(self, txt_path: Path, format_type: str) -> None:
        """统一转换接口"""
        if format_type == 'epub':
            await asyncio.to_thread(self._convert_to_epub_sync, str(txt_path))
        elif format_type == 'mobi':
            await asyncio.to_thread(self._convert_to_mobi_sync, str(txt_path))
        else:
            logging.warning(f"不支持的格式: {format_type}")
    
    def _convert_to_epub_sync(self, txt_path: str) -> None:
        """同步EPUB转换（用于线程池）"""
        # 原来的convert_to_epub逻辑
        pass
    
    def _convert_to_mobi_sync(self, txt_path: str) -> None:
        """同步MOBI转换（用于线程池）"""
        # 原来的convert_to_mobi逻辑
        pass
        
    def _extract_chapters(self, txt_content: str) -> List[ChapterInfo]:
        """从TXT内容中提取章节（修复版）"""
        # 修复后的正则表达式模式
        patterns = [
            r'^第[\d一二三四五六七八九十百千万]+章\s*(.*)$',
            r'^第[\d一二三四五六七八九十百千万]+节\s*(.*)$',
            r'^章节[\d一二三四五六七八九十百千万]+\s*(.*)$',
            r'^[\d一二三四五六七八九十百千万]+[、.．]\s*(.*)$',
            r'^第[\d一二三四五六七八九十百千万]+回\s*(.*)$',
            r'^卷[\d一二三四五六七八九十百千万]+\s*(.*)$',
        ]
        
        lines = txt_content.split('\n')
        chapters = []
        current_chapter_title = "引言"
        current_chapter_content = []
        chapter_index = 0
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            is_chapter_title = False
            for pattern in patterns:
                match = re.match(pattern, line)
                if match:
                    if current_chapter_content:
                        chapters.append(ChapterInfo(
                            title=current_chapter_title,
                            content='\n'.join(current_chapter_content),
                            index=chapter_index
                        ))
                        chapter_index += 1
                        current_chapter_content = []
                    
                    chapter_name = match.group(1).strip() if match.group(1).strip() else ""
                    current_chapter_title = line if not chapter_name else f"{line.split()[0]} {chapter_name}"
                    is_chapter_title = True
                    break
            
            if not is_chapter_title:
                current_chapter_content.append(line)
        
        if current_chapter_content:
            chapters.append(ChapterInfo(
                title=current_chapter_title,
                content='\n'.join(current_chapter_content),
                index=chapter_index
            ))
        
        if not chapters:
            lines_per_chapter = 100
            content_lines = [l for l in lines if l.strip()]
            
            if len(content_lines) > lines_per_chapter:
                for i in range(0, len(content_lines), lines_per_chapter):
                    chapter_content = content_lines[i:i + lines_per_chapter]
                    chapters.append(ChapterInfo(
                        title=f"第{i // lines_per_chapter + 1}部分",
                        content='\n'.join(chapter_content),
                        index=i // lines_per_chapter
                    ))
            else:
                chapters.append(ChapterInfo(
                    title="全文",
                    content=txt_content,
                    index=0
                ))
            
        return chapters
    
    def _extract_author_from_txt(self, txt_content: str) -> Optional[str]:
        """从TXT内容中提取作者信息"""
        patterns = [
            r'作者[：:](\s*\S+)',
            r'【作者】(\s*\S+)',
        ]
        
        content_to_check = txt_content[:1000]
        
        for pattern in patterns:
            match = re.search(pattern, content_to_check, re.IGNORECASE)
            if match:
                author = match.group(1).strip()
                if author and len(author) < 50:
                    return author
        
        return None