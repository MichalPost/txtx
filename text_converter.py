#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
文本转换工具类
支持繁体转简体等文本转换功能
"""

import logging
from typing import Optional

try:
    import opencc
    OPENCC_AVAILABLE = True
except ImportError:
    OPENCC_AVAILABLE = False
    logging.warning("opencc-python-reimplemented 未安装，繁简转换功能将不可用")

class TextConverter:
    """文本转换器类"""
    
    def __init__(self):
        """初始化文本转换器"""
        self.converter = None
        if OPENCC_AVAILABLE:
            try:
                # 使用繁体转简体的配置，修复配置文件路径问题
                self.converter = opencc.OpenCC('t2s')  # 去掉.json后缀
                logging.info("繁简转换器初始化成功")
            except Exception as e:
                # 尝试其他可能的配置名称
                try:
                    self.converter = opencc.OpenCC('tw2s')  # 台湾繁体转简体
                    logging.info("繁简转换器初始化成功（使用tw2s配置）")
                except Exception as e2:
                    try:
                        self.converter = opencc.OpenCC('hk2s')  # 香港繁体转简体
                        logging.info("繁简转换器初始化成功（使用hk2s配置）")
                    except Exception as e3:
                        logging.warning(f"繁简转换器初始化失败: {e}")
                        logging.warning(f"备用配置也失败: tw2s={e2}, hk2s={e3}")
                        self.converter = None
    
    def is_available(self) -> bool:
        """检查转换器是否可用"""
        return self.converter is not None
    
    def convert_traditional_to_simplified(self, text: str) -> str:
        """将繁体中文转换为简体中文
        
        Args:
            text: 待转换的文本
            
        Returns:
            转换后的文本，如果转换器不可用则返回原文本
        """
        if not text:
            return text
            
        if not self.is_available():
            return text
        
        try:
            return self.converter.convert(text)
        except Exception as e:
            logging.warning(f"文本转换失败: {e}")
            return text
    
    def detect_and_convert_text(self, text: str) -> tuple[str, bool]:
        """检测并转换文本
        
        Args:
            text: 待检测和转换的文本
            
        Returns:
            tuple: (转换后的文本, 是否进行了转换)
        """
        if not text or not self.is_available():
            return text, False
        
        try:
            # 简单检测：如果转换前后不同，说明包含繁体字
            converted_text = self.converter.convert(text)
            has_traditional = converted_text != text
            return converted_text, has_traditional
        except Exception as e:
            logging.warning(f"文本检测转换失败: {e}")
            return text, False
    
    def convert_file_content(self, content: str, auto_detect: bool = True) -> tuple[str, bool]:
        """转换文件内容
        
        Args:
            content: 文件内容
            auto_detect: 是否自动检测是否需要转换
            
        Returns:
            tuple: (转换后的内容, 是否进行了转换)
        """
        if not content:
            return content, False
        
        if auto_detect:
            return self.detect_and_convert_text(content)
        else:
            # 强制转换
            converted = self.convert_traditional_to_simplified(content)
            return converted, converted != content