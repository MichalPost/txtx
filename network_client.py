#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import asyncio
import logging
import re
import random
from typing import Dict, Optional
from urllib.parse import urlparse

from curl_cffi.requests import AsyncSession
import chardet
from pathlib import Path

class NetworkClient:
    """网络请求客户端，使用 curl_cffi 处理HTTP请求和编码解析"""
    
    def __init__(self, user_agent: str, retry_count: int = 3, retry_delay: int = 5, proxy: str = None, timeout: int = 30):
        """初始化网络客户端"""
        self.user_agent = user_agent
        self.retry_count = retry_count
        self.retry_delay = retry_delay
        self.proxy = proxy
        self.timeout = timeout  # 添加超时配置
        self.session: Optional[AsyncSession] = None
        self.last_url: Optional[str] = None  # 记录上一个访问的URL，用于动态Referer
        self.encoding_map = {
            'ffxs8.com': 'gbk',
            'trxs.cc': 'gbk',
            'trxs.me': 'gbk',
            'tongrenquan.org': 'utf-8',
            'qbtr.cc': 'utf-8'
        }
        
        # Chrome版本池，用于随机化
        self.chrome_versions = [
            "120.0.0.0", "119.0.0.0", "118.0.0.0", "117.0.0.0"
        ]
        
        # 随机选择一个Chrome版本
        self.chrome_version = random.choice(self.chrome_versions)
    
    def _get_dynamic_headers(self, url: str) -> Dict[str, str]:
        """生成动态请求头，包括智能Referer"""
        domain = self._extract_domain(url)
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        
        # 基础请求头
        headers = {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',  # 改为no-cache避免缓存问题
            'Pragma': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-User': '?1',
            'Sec-Ch-Ua': f'"Not_A Brand";v="8", "Chromium";v="{self.chrome_version}", "Google Chrome";v="{self.chrome_version}"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"Windows"',
            'Connection': 'keep-alive'
        }
        
        # 智能设置Referer - 更保守的策略
        if self.last_url and self._extract_domain(self.last_url) == domain:
            # 如果上一个URL是同域名，使用上一个URL作为Referer
            headers['Referer'] = self.last_url
            headers['Sec-Fetch-Site'] = 'same-origin'
        else:
            # 使用网站首页作为Referer
            headers['Referer'] = base_url + '/'
            headers['Sec-Fetch-Site'] = 'none'  # 改为none，模拟直接访问
        
        # 针对特定网站的优化
        if 'trxs.cc' in url or 'trxs.me' in url or 'qbtr.cc' in url:
            # 这些网站可能需要特殊的请求头
            headers.update({
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Sec-Fetch-Site': 'same-origin' if self.last_url else 'none',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-User': '?1'
            })
        
        # 微调某些头部，增加随机性
        if random.random() < 0.3:  # 30%概率添加DNT头
            headers['DNT'] = '1'
            
        return headers
    async def __aenter__(self):
        """异步上下文管理器入口"""
        if self.session and not self.session.closed:
            return self

        # 使用 curl_cffi 创建会话，模拟真实浏览器
        self.session = AsyncSession(
            impersonate="chrome120",  # 模拟 Chrome 120 浏览器
            timeout=self.timeout,     # 使用配置的超时时间
            verify=False,  # 禁用SSL验证
            proxies={"http": self.proxy, "https": self.proxy} if self.proxy else None
        )
        
        # 设置基础User-Agent（会被动态头部覆盖）
        self.session.headers.update({
            'User-Agent': self.user_agent
        })
        
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """异步上下文管理器出口"""
        try:
            if self.session:
                await self.session.close()
                self.session = None
        except Exception as e:
            logging.error(f"关闭会话失败: {e}")
            raise
    
    def update_encoding_map(self, custom_map: Dict[str, str]) -> None:
        """更新编码映射
        
        Args:
            custom_map: 自定义的编码映射
        """
        self.encoding_map.update(custom_map)
    
    @staticmethod
    def _extract_domain(url: str) -> str:
        """从URL中提取域名
        
        Args:
            url: 完整的URL
            
        Returns:
            提取的域名
        """
        try:
            parsed = urlparse(url)
            domain = parsed.netloc
            # 移除 www. 前缀
            if domain.startswith('www.'):
                domain = domain[4:]
            return domain
        except Exception:
            # 备用方案：使用正则表达式
            match = re.search(r'https?://(?:www\.)?([^/]+)', url)
            return match.group(1) if match else ''
    
    def detect_encoding(self, content: bytes, url: str = '') -> str:
        """检测内容编码"""
        # 优先检查 URL 特定配置
        if url:
            domain = self._extract_domain(url)
            if domain in self.encoding_map:
                return self.encoding_map[domain]
        
        # 快速探测常用编码
        for encoding in ['utf-8', 'gbk']:
            try:
                content.decode(encoding)
                return encoding
            except UnicodeDecodeError:
                continue

        # 使用 chardet 作为最后手段
        try:
            result = chardet.detect(content)
            encoding = result.get('encoding', 'utf-8')
            confidence = result.get('confidence', 0)
            
            if confidence < 0.8:
                return 'utf-8'
            
            encoding_lower = encoding.lower()
            if encoding_lower in {'gb2312', 'iso-8859-1', 'windows-1252', 'ascii'}:
                return 'gbk'
            
            return encoding
        except Exception:
            return 'utf-8'
    
    @staticmethod
    def decode_content(content: bytes, encoding: str) -> str:
        """解码内容
        
        Args:
            content: 要解码的内容
            encoding: 编码方式
            
        Returns:
            解码后的内容
            
        Raises:
            ValueError: 解码失败
        """
        encodings = [encoding]
        backup_encodings = ['utf-8', 'gbk', 'gb18030', 'big5', 'shift_jis', 'utf-16', 'utf-32']
        encodings.extend([enc for enc in backup_encodings if enc.lower() != encoding.lower()])
        
        errors = []
        for enc in encodings:
            try:
                return content.decode(enc)
            except UnicodeDecodeError as e:
                errors.append(f"{enc}: {str(e)}")
            except Exception as e:
                errors.append(f"{enc}: {str(e)}")
                continue
        
        try:
            return content.decode(encoding, errors='ignore')
        except Exception as e:
            errors.append(f"使用 {encoding} (ignore): {str(e)}")
        
        try:
            return content.decode('utf-8', errors='ignore')
        except Exception as e:
            errors.append(f"使用 utf-8 (ignore): {str(e)}")
        
        error_msg = "\n".join(errors)
        raise ValueError(f"无法解码内容，尝试的所有编码均失败:\n{error_msg}")
    
    async def fetch_page(self, url: str) -> str:
        """获取页面内容（使用 curl_cffi 优化网络请求）"""
        if not self.session:
            raise RuntimeError("Client session not initialized")
            
        for attempt in range(self.retry_count):
            try:
                # 生成动态请求头
                dynamic_headers = self._get_dynamic_headers(url)
                
                # 发送请求
                response = await self.session.get(url, headers=dynamic_headers)
                
                # 检查HTTP状态码
                if response.status_code == 404:
                    logging.warning(f"页面不存在 {url}: HTTP 404")
                    raise ValueError(f"页面不存在: {url}")
                elif response.status_code >= 400:
                    logging.warning(f"HTTP错误 {url}: {response.status_code}")
                    if attempt < self.retry_count - 1:
                        await asyncio.sleep(self.retry_delay)
                        continue
                    raise ValueError(f"HTTP错误 {response.status_code}: {url}")
                
                content = response.content
                if not content:
                    logging.warning(f"页面内容为空 {url}")
                    if attempt < self.retry_count - 1:
                        await asyncio.sleep(self.retry_delay)
                        continue
                    raise ValueError(f"页面内容为空: {url}")
                
                # 更新last_url用于下次请求的Referer
                self.last_url = url
                
                # 检测编码并解码内容
                encoding = self.detect_encoding(content, url)
                try:
                    return self.decode_content(content, encoding)
                except ValueError as e:
                    if attempt < self.retry_count - 1:
                        logging.warning(f"解码失败 {url}: {e}，{self.retry_delay}秒后重试")
                        await asyncio.sleep(self.retry_delay)
                        continue
                    logging.error(f"解码失败 {url}: {e}")
                    raise
                        
            except asyncio.TimeoutError:
                if attempt < self.retry_count - 1:
                    logging.warning(f"请求超时 {url}，{self.retry_delay}秒后重试第{attempt + 2}次")
                    await asyncio.sleep(self.retry_delay)
                else:
                    logging.error(f"请求超时 {url}，已达到最大重试次数")
                    raise
            except Exception as e:
                # curl_cffi 的异常处理
                error_msg = str(e)
                if attempt < self.retry_count - 1:
                    logging.warning(f"请求失败 {url}: {error_msg[:100]}，{self.retry_delay}秒后重试第{attempt + 2}次")
                    await asyncio.sleep(self.retry_delay)
                else:
                    logging.error(f"请求失败 {url}: {error_msg[:100]}，已达到最大重试次数")
                    raise