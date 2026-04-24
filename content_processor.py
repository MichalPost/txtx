#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations


from lxml import html
import re

class ContentProcessor:
    """内容处理类，负责章节内容的提取和优化"""
    
    def __init__(self, novel_content_xpath: str):
        """初始化内容处理器
        
        Args:
            novel_content_xpath: 小说内容的XPath表达式
        """
        self.novel_content_xpath = novel_content_xpath
    
    def extract_chapter_content(self, html_content: str) -> list[str]:
        """从HTML中提取章节内容
        
        Args:
            html_content: HTML内容
            
        Returns:
            提取的文本内容列表
        """
        html_tree = html.fromstring(html_content)
        chapter_content = html_tree.xpath(self.novel_content_xpath)
        
        # 使用生成器表达式和join优化文本处理
        text_parts = (
            node.strip() if isinstance(node, str)
            else node.text.strip() if hasattr(node, 'text') and node.text
            else ''.join(node.xpath('.//text()')).strip()
            for node in chapter_content
            if node
        )
        return [part for part in text_parts if part]
    
    @staticmethod
    def optimize_chapter_content(content: list[str]) -> str:
        """优化章节内容，去除空行和广告（增强版）
        
        Args:
            content: 章节内容列表
            
        Returns:
            优化后的内容
        """
        if not content:
            return ""
            
        # 移除空行和只包含空白字符的行
        content = [line.strip() for line in content if line.strip()]
        
        # 智能广告检测和移除
        filtered_content = []
        ad_patterns = [
            r'.*www\.[a-zA-Z0-9.-]+\.(com|cn|net|org).*',  # 网址
            r'.*QQ[：:]?\s*\d{5,}.*',  # QQ号
            r'.*微信[：:]?\s*[a-zA-Z0-9_-]+.*',  # 微信号
            r'.*关注.*公众号.*',  # 公众号广告
            r'.*加群.*\d+.*',  # 加群广告
            r'.*更新.*最快.*',  # 更新广告
            r'.*手机.*阅读.*',  # 手机阅读广告
            r'.*上一篇[：:].*',  # 上一篇导航
            r'.*下一篇[：:].*',  # 下一篇导航
            r'.*上一章[：:].*',  # 上一章导航
            r'.*下一章[：:].*',  # 下一章导航
            r'.*返回目录.*',  # 返回目录链接
            r'.*章节目录.*',  # 章节目录链接
            r'.*书签.*收藏.*',  # 书签收藏
            r'.*加入书架.*',  # 加入书架
        ]
        
        for line in content:
            is_ad = False
            for pattern in ad_patterns:
                if re.match(pattern, line, re.IGNORECASE):
                    is_ad = True
                    break
            if not is_ad:
                filtered_content.append(line)
        
        # 额外处理：移除末尾的导航链接（针对web1~web7网站）
        while filtered_content:
            last_line = filtered_content[-1]
            # 检查最后一行是否包含导航关键词
            if any(keyword in last_line for keyword in ['上一篇', '下一篇', '上一章', '下一章', '返回目录', '章节目录']):
                filtered_content.pop()
            else:
                break
        
        # 如果过滤后内容太少，可能误删了正文，回退到原逻辑
        if len(filtered_content) < len(content) * 0.3:  # 降低阈值，避免过度保守
            # 回退到硬编码删除最后两行的逻辑
            if len(content) >= 2:
                content = content[:-2]
            elif len(content) == 1:
                content = []
            return '\n'.join(content) if content else ""
        
        return '\n'.join(filtered_content) if filtered_content else ""
    
    @staticmethod
    def sanitize_filename(name: str) -> str:
        """清理文件名，移除非法字符
        
        Args:
            name: 原始文件名
            
        Returns:
            清理后的文件名
        """
        # 移除括号内容和特殊字符
        name = re.sub(r'\(.*?\)', '', name)
        name = re.sub(r'[\\/:*?"<>|]', ' ', name)
        return name.strip()
    
    def extract_novel_name(self, html_content: str, novel_name_xpath: str) -> str | None:
        """提取小说名称
        
        Args:
            html_content: HTML内容
            novel_name_xpath: 小说名称的XPath表达式
            
        Returns:
            小说名称，如果提取失败则返回None
        """
        html_tree = html.fromstring(html_content)
        novel_name_elements = html_tree.xpath(novel_name_xpath)
        
        if not novel_name_elements:
            return None
            
        element = novel_name_elements[0]
        if isinstance(element, str):
            novel_name = element
        elif hasattr(element, 'text'):
            novel_name = element.text
        else:
            novel_name = str(element)
            
        return self.sanitize_filename(novel_name)
    
    def extract_chapter_urls(self, html_content: str, chapter_url_xpath: str) -> list[str]:
        """提取章节URL列表
        
        Args:
            html_content: HTML内容
            chapter_url_xpath: 章节URL的XPath表达式
            
        Returns:
            章节URL列表
        """
        html_tree = html.fromstring(html_content)
        chapter_urls = html_tree.xpath(chapter_url_xpath)
        
        # 使用列表推导式优化URL处理
        return [
            url.strip() if isinstance(url, str)
            else url.text.strip() if hasattr(url, 'text')
            else str(url).strip()
            for url in chapter_urls
        ]