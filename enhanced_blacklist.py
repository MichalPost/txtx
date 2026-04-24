#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import logging
import re
from pathlib import Path
from typing import List, Dict, Optional, Union, Pattern, Tuple, Any
import yaml

class EnhancedBlacklist:
    """增强版黑名单过滤系统
    
    支持以下功能：
    1. 关键词匹配（支持大小写敏感和模糊匹配）
    2. 正则表达式匹配
    3. 分级内容过滤（严格、中等、轻度）
    4. 内容标签系统
    """
    
    # [修改] 增加 config_data 参数，允许直接传入字典配置
    def __init__(self, config_path: str = './config/enhanced_blacklist.yml', config_data: Dict[str, Any] = None):
        """初始化黑名单系统
        
        Args:
            config_path: 黑名单配置文件路径
            config_data: 可选，直接传入的配置字典
        """
        self.config_path = Path(config_path)
        self.keywords: List[str] = []
        self.regex_patterns: List[Pattern] = []
        self.grading_rules: Dict[str, List[str]] = {}
        self.tags: Dict[str, List[str]] = {}
        self.rules: Dict[str, Union[bool, str, List[str]]] = {}
        self.compiled_regex: List[Pattern] = []
        
        # 优先使用传入的配置，否则加载文件
        if config_data:
            self._load_from_dict(config_data)
        else:
            self._load_config()
        
    def _load_config(self) -> None:
        """加载黑名单配置"""
        try:
            if not self.config_path.exists():
                logging.warning(f"黑名单配置文件不存在: {self.config_path}，将使用默认配置")
                self._set_default_config()
                return
                
            with self.config_path.open('r', encoding='utf-8') as f:
                config = yaml.safe_load(f)
                
            # 加载关键词列表
            self.keywords = config.get('keywords', [])
            
            # 加载正则表达式模式
            regex_patterns = config.get('regex_patterns', [])
            self.regex_patterns = regex_patterns
            self.compiled_regex = [re.compile(pattern) for pattern in regex_patterns]
            
            # 加载分级规则
            self.grading_rules = config.get('grading_rules', {
                'strict': [],
                'moderate': [],
                'mild': []
            })
            
            # 加载标签系统
            self.tags = config.get('tags', {})
            
            # 加载匹配规则
            self.rules = config.get('rules', {
                'case_insensitive': True,
                'fuzzy_match': True,
                'regex_match': True,
                'grading_filter': True,
                'filter_level': 'moderate',
                'tag_filter': False,
                'filtered_tags': []
            })
            
            logging.info(f"已加载增强版黑名单配置，包含 {len(self.keywords)} 个关键词，{len(self.regex_patterns)} 个正则表达式模式")
            
        except Exception as e:
            logging.error(f"加载黑名单配置失败: {e}，将使用默认配置")
            self._set_default_config()
    
    def _load_from_dict(self, config: Dict[str, Any]) -> None:
        """从字典加载配置"""
        try:
            self.keywords = config.get('keywords', [])
            regex_patterns = config.get('regex_patterns', [])
            self.regex_patterns = regex_patterns
            self.compiled_regex = [re.compile(str(p)) for p in regex_patterns]
            
            self.grading_rules = config.get('grading_rules', {'strict': [], 'moderate': [], 'mild': []})
            self.tags = config.get('tags', {})
            
            default_rules = {
                'case_insensitive': True,
                'fuzzy_match': True,
                'regex_match': True,
                'grading_filter': True,
                'filter_level': 'moderate',
                'tag_filter': False,
                'filtered_tags': []
            }
            self.rules = config.get('rules', default_rules)
            # 合并默认规则防止缺失
            for k, v in default_rules.items():
                if k not in self.rules:
                    self.rules[k] = v
                    
        except Exception as e:
            logging.error(f"加载黑名单配置失败: {e}")
            self._set_default_config()
    
    def _set_default_config(self) -> None:
        """设置默认配置"""
        self.keywords = []
        self.regex_patterns = []
        self.compiled_regex = []
        self.grading_rules = {
            'strict': ['色情', '淫秽'],
            'moderate': ['暴力', '血腥'],
            'mild': ['恋爱', '言情']
        }
        self.tags = {}
        self.rules = {
            'case_insensitive': True,
            'fuzzy_match': True,
            'regex_match': False,
            'grading_filter': False,
            'filter_level': 'moderate',
            'tag_filter': False,
            'filtered_tags': []
        }
    
    # [关键修改] 返回类型改为 Tuple[bool, str]
    def is_blacklisted(self, novel_name: str, tags: Optional[List[str]] = None) -> Tuple[bool, str]:
        """检查小说是否在黑名单中，返回 (是否屏蔽, 屏蔽原因)"""
        
        # 1. 关键词匹配
        is_match, reason = self._match_keywords(novel_name)
        if is_match:
            return True, reason
            
        # 2. 正则表达式匹配
        if self.rules.get('regex_match', False):
            is_match, reason = self._match_regex(novel_name)
            if is_match:
                return True, reason
            
        # 3. 分级过滤
        if self.rules.get('grading_filter', False):
            is_match, reason = self._match_grading(novel_name)
            if is_match:
                return True, reason
            
        return False, ""
    
    # [修改] 返回具体的关键词
    def _match_keywords(self, novel_name: str) -> Tuple[bool, str]:
        if not self.keywords:
            return False, ""
            
        name = novel_name
        check_keywords = self.keywords
        
        if self.rules.get('case_insensitive', True):
            name = name.lower()
            check_keywords = [k.lower() for k in self.keywords]
            # 为了返回原始关键词，需要保留映射，这里简化处理返回匹配到的那个词
            
        if self.rules.get('fuzzy_match', True):
            for i, keyword in enumerate(check_keywords):
                if keyword in name:
                    # 尝试返回原始大小写的关键词
                    raw_keyword = self.keywords[i] if i < len(self.keywords) else keyword
                    return True, raw_keyword
        else:
            if name in check_keywords:
                return True, name
        return False, ""
    
    def _match_regex(self, novel_name: str) -> Tuple[bool, str]:
        if not self.compiled_regex:
            return False, ""
        for i, pattern in enumerate(self.compiled_regex):
            if pattern.search(novel_name):
                return True, f"Regex({self.regex_patterns[i]})"
        return False, ""
    
    def _match_grading(self, novel_name: str) -> Tuple[bool, str]:
        filter_level = self.rules.get('filter_level', 'moderate')
        levels_to_check = []
        if filter_level == 'strict': levels_to_check = ['strict']
        elif filter_level == 'moderate': levels_to_check = ['strict', 'moderate']
        elif filter_level == 'mild': levels_to_check = ['strict', 'moderate', 'mild']
        else: return False, ""
            
        name = novel_name.lower() if self.rules.get('case_insensitive', True) else novel_name
        
        for level in levels_to_check:
            keywords = self.grading_rules.get(level, [])
            for k in keywords:
                check_k = k.lower() if self.rules.get('case_insensitive', True) else k
                if self.rules.get('fuzzy_match', True):
                    if check_k in name: return True, k
                else:
                    if name == check_k: return True, k
        return False, ""
    
    def _match_tags(self, tags: List[str]) -> bool:
        """标签匹配
        
        Args:
            tags: 小说标签列表
            
        Returns:
            是否匹配标签过滤
        """
        filtered_tags = self.rules.get('filtered_tags', [])
        if not filtered_tags:
            return False
            
        # 如果大小写不敏感，转换为小写
        if self.rules.get('case_insensitive', True):
            tags = [t.lower() for t in tags]
            filtered_tags = [t.lower() for t in filtered_tags]
            
        # 检查是否有交集
        return bool(set(tags) & set(filtered_tags))
    
    def add_keyword(self, keyword: str) -> None:
        """添加关键词到黑名单
        
        Args:
            keyword: 要添加的关键词
        """
        if keyword not in self.keywords:
            self.keywords.append(keyword)
            logging.info(f"已添加关键词到黑名单: {keyword}")
    
    def add_regex(self, pattern: str) -> None:
        """添加正则表达式模式到黑名单
        
        Args:
            pattern: 正则表达式模式
        """
        if pattern not in self.regex_patterns:
            try:
                compiled = re.compile(pattern)
                self.regex_patterns.append(pattern)
                self.compiled_regex.append(compiled)
                logging.info(f"已添加正则表达式模式到黑名单: {pattern}")
            except re.error as e:
                logging.error(f"添加正则表达式模式失败，无效的模式: {pattern}, 错误: {e}")
    
    def save_config(self) -> None:
        """保存黑名单配置到文件"""
        try:
            config_data = {
                'keywords': self.keywords,
                'regex_patterns': self.regex_patterns,
                'grading_rules': self.grading_rules,
                'tags': self.tags,
                'rules': self.rules
            }
            
            with self.config_path.open('w', encoding='utf-8') as f:
                yaml.safe_dump(config_data, f, ensure_ascii=False, indent=2)
            
            logging.info(f"黑名单配置已保存到: {self.config_path}")
        except Exception as e:
            logging.error(f"保存黑名单配置失败: {e}")
    
    def set_filter_level(self, level: str) -> None:
        """设置过滤级别"""
        valid_levels = ['strict', 'moderate', 'mild', 'none']
        if level not in valid_levels:
            raise ValueError(f"无效的过滤级别: {level}，有效值: {', '.join(valid_levels)}")
        
        self.rules['filter_level'] = level
        logging.info(f"过滤级别已设置为: {level}")
        
    def enable_feature(self, feature: str, enable: bool = True) -> None:
        """启用或禁用特定功能"""
        valid_features = ['case_insensitive', 'fuzzy_match', 'regex_match', 
                         'grading_filter', 'tag_filter']
        if feature not in valid_features:
            raise ValueError(f"无效的功能: {feature}，有效值: {', '.join(valid_features)}")
        
        self.rules[feature] = enable
        logging.info(f"功能 {feature} 已{'启用' if enable else '禁用'}")
        
    def add_filtered_tag(self, tag: str) -> None:
        """添加要过滤的标签"""
        filtered_tags = self.rules.get('filtered_tags', [])
        if tag not in filtered_tags:
            filtered_tags.append(tag)
            self.rules['filtered_tags'] = filtered_tags
            logging.info(f"已添加过滤标签: {tag}")
            
    def remove_filtered_tag(self, tag: str) -> None:
        """移除过滤标签"""
        filtered_tags = self.rules.get('filtered_tags', [])
        if tag in filtered_tags:
            filtered_tags.remove(tag)
            self.rules['filtered_tags'] = filtered_tags
            logging.info(f"已移除过滤标签: {tag}")
    
    def get_statistics(self) -> Dict[str, int]:
        """获取黑名单统计信息"""
        return {
            'keywords_count': len(self.keywords),
            'regex_patterns_count': len(self.regex_patterns)
        }