#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, field
import yaml

@dataclass
class Config:
    """配置数据类，负责数据验证和默认值设置"""
    # 网站配置
    domain_name: str
    release_date: str
    release_url: str
    novel_name_x: str
    novel_content: str
    chapter_url_x: str
    page_list: list[str]
    
    # 可选字段
    list_novel_name: str = ""
    
    # 线程配置
    number_of_novel_threads: int = 2
    number_of_chapter_threads: int = 2
    
    # 网络配置
    user_agent: str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    proxy: Optional[str] = None
    retry_count: int = 3
    retry_delay: int = 5
    timeout: int = 30
    encoding_map: dict[str, str] = field(default_factory=dict)
    
    # 路径配置
    base_dir: str = "E:/Downloads/xs"
    
    # 过滤配置
    days_limit: int = 7
    
    # 转换配置
    convert_formats: list[str] = field(default_factory=list)
    use_enhanced_blacklist: bool = False
    
    # 其他配置
    blacklist: dict[str, Any] = field(default_factory=dict)
    text_conversion: dict[str, Any] = field(default_factory=dict)

class ConfigService:
    """单例配置服务，统一管理所有配置"""
    
    _instance: Optional[ConfigService] = None
    _initialized: bool = False
    
    def __new__(cls, config_dir: str = './config') -> ConfigService:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self, config_dir: str = './config'):
        if self._initialized:
            return
            
        self.config_dir = Path(config_dir)
        self.raw_config: Dict[str, Any] = {}
        self._initialized = True
        
    def load_config(self) -> None:
        """加载配置文件"""
        config_file = self.config_dir / 'config.yml'
        
        if not config_file.exists():
            raise FileNotFoundError(f"配置文件不存在: {config_file}")
        
        try:
            with config_file.open('r', encoding='utf-8') as f:
                self.raw_config = yaml.safe_load(f)
                
            if not self.raw_config:
                raise ValueError("配置文件为空或格式错误")
            
            logging.info(f"✅ 已加载配置文件: {config_file}")
            
        except Exception as e:
            logging.error(f"❌ 加载配置失败: {e}")
            raise
    
    def get_websites_config(self, show_logs: bool = True) -> Dict[str, Any]:
        """获取启用的网站配置"""
        all_websites = self.raw_config.get('websites', {})
        enabled_websites = {}
        
        for site_name, site_config in all_websites.items():
            if site_config.get('enabled', True):
                enabled_websites[site_name] = site_config
                if show_logs:
                    logging.info(f"✅ 网站 {site_name} 已启用")
            else:
                if show_logs:
                    logging.info(f"⏸️ 网站 {site_name} 已禁用，跳过")
        
        return enabled_websites
    
    def get_common_config(self) -> Dict[str, Any]:
        """获取通用配置"""
        common_config = {}
        
        # 路径配置
        if 'paths' in self.raw_config:
            common_config.update(self.raw_config['paths'])
        
        # 网络配置
        if 'network' in self.raw_config:
            network_config = self.raw_config['network']
            common_config.update({
                'user_agent': network_config.get('user_agent'),
                'proxy': network_config.get('proxy'),
                'retry_count': network_config.get('retry_count', 3),
                'retry_delay': network_config.get('retry_delay', 5),
                'timeout': network_config.get('timeout', 30),
                'encoding_map': network_config.get('encoding_map', {})
            })
        
        # 并发配置
        if 'concurrency' in self.raw_config:
            concurrency_config = self.raw_config['concurrency']
            common_config.update({
                'novel_threads': concurrency_config.get('novel_threads', 2),
                'chapter_threads': concurrency_config.get('chapter_threads', 2),
                'number_of_novel_threads': concurrency_config.get('novel_threads', 2),
                'number_of_chapter_threads': concurrency_config.get('chapter_threads', 2)
            })
        
        # 过滤配置
        if 'filtering' in self.raw_config:
            filtering_config = self.raw_config['filtering']
            common_config.update({
                'days_limit': filtering_config.get('days_limit', 60),
                'site_priority': filtering_config.get('site_priority', {})
            })
        
        # 其他配置
        if 'blacklist' in self.raw_config:
            common_config['blacklist'] = self.raw_config['blacklist']
        
        if 'ebook_conversion' in self.raw_config:
            common_config['ebook_conversion'] = self.raw_config['ebook_conversion']
            
        if 'text_conversion' in self.raw_config:
            common_config['text_conversion'] = self.raw_config['text_conversion']
        
        return common_config
    
    def create_site_config(self, site_config: Dict[str, Any], common_config: Dict[str, Any]) -> Config:
        """创建站点配置对象"""
        # 合并配置
        merged_config = site_config.copy()
        
        # 移除 Config 类不需要的字段
        merged_config.pop('enabled', None)
        
        # 验证必需字段
        required_fields = [
            'domain_name', 'release_date', 'release_url', 
            'novel_name_x', 'novel_content', 'chapter_url_x', 'page_list'
        ]
        
        for field in required_fields:
            if field not in merged_config:
                raise ValueError(f"网站配置缺少必需字段: {field}")
        
        # 应用通用配置的默认值
        merged_config.setdefault('number_of_novel_threads', common_config.get('number_of_novel_threads', 2))
        merged_config.setdefault('number_of_chapter_threads', common_config.get('number_of_chapter_threads', 2))
        merged_config.setdefault('base_dir', common_config.get('base_dir', 'E:/Downloads/xs'))
        merged_config.setdefault('retry_count', common_config.get('retry_count', 3))
        merged_config.setdefault('retry_delay', common_config.get('retry_delay', 5))
        merged_config.setdefault('timeout', common_config.get('timeout', 30))
        merged_config.setdefault('days_limit', common_config.get('days_limit', 7))
        merged_config.setdefault('user_agent', common_config.get('user_agent', 'Mozilla/5.0'))
        merged_config.setdefault('proxy', common_config.get('proxy'))
        merged_config.setdefault('blacklist', common_config.get('blacklist', {}))
        merged_config.setdefault('text_conversion', common_config.get('text_conversion', {}))
        merged_config.setdefault('convert_formats', [])
        merged_config.setdefault('encoding_map', {})
        
        # 设置增强黑名单标志
        merged_config['use_enhanced_blacklist'] = bool(common_config.get('blacklist'))
        
        # 创建输出目录
        Path(merged_config['base_dir']).mkdir(parents=True, exist_ok=True)
        
        return Config(**merged_config)
    
    def get_blacklist_config(self) -> Optional[Dict[str, Any]]:
        """获取黑名单配置"""
        return self.raw_config.get('blacklist')
    
    def validate_config(self) -> bool:
        """验证配置完整性"""
        try:
            websites = self.get_websites_config(show_logs=False)  # 验证时不显示日志
            if not websites:
                logging.error("❌ 没有配置任何启用的网站")
                return False
            
            required_fields = [
                'domain_name', 'release_date', 'release_url', 
                'novel_name_x', 'novel_content', 'chapter_url_x', 'page_list'
            ]
            
            for site_name, site_config in websites.items():
                for field in required_fields:
                    if field not in site_config:
                        logging.error(f"❌ 网站 {site_name} 缺少必需字段: {field}")
                        return False
            
            return True
            
        except Exception as e:
            logging.error(f"❌ 配置验证失败: {e}")
            return False

# 提供全局访问接口
def get_config_service(config_dir: str = './config') -> ConfigService:
    """获取配置服务实例"""
    return ConfigService(config_dir)