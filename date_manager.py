#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional, Tuple
import yaml

class DateManager:
    """日期管理器，负责记录和计算下载日期范围"""
    
    def __init__(self, config_path: str = "config/config.yml"):
        self.config_path = Path(config_path)
        self.config_data = None
        self._load_config()
    
    def _load_config(self) -> None:
        """加载配置文件"""
        try:
            with open(self.config_path, 'r', encoding='utf-8') as f:
                self.config_data = yaml.safe_load(f)
        except Exception as e:
            logging.error(f"加载配置文件失败: {e}")
            raise
    
    def _save_config(self) -> None:
        """保存配置文件"""
        try:
            with open(self.config_path, 'w', encoding='utf-8') as f:
                yaml.dump(self.config_data, f, default_flow_style=False, 
                         allow_unicode=True, sort_keys=False)
        except Exception as e:
            logging.error(f"保存配置文件失败: {e}")
            raise
    
    def get_download_date_range(self) -> Tuple[str, int]:
        """
        获取下载日期范围
        
        Returns:
            Tuple[str, int]: (目标日期字符串, 实际天数限制)
        """
        filtering_config = self.config_data.get('filtering', {})
        days_limit = filtering_config.get('days_limit', 60)
        min_days_limit = filtering_config.get('min_days_limit', 1)
        last_download_date = filtering_config.get('last_download_date')
        
        current_date = datetime.now()
        
        if last_download_date is None:
            # 首次运行，使用配置的天数限制
            actual_days = max(days_limit, min_days_limit)
            target_date = (current_date - timedelta(days=actual_days)).strftime('%Y-%m-%d')
            logging.info(f"首次运行，下载 {actual_days} 天内的小说")
        else:
            # 计算距离上次下载的天数
            try:
                last_date = datetime.strptime(last_download_date, '%Y-%m-%d')
                days_since_last = (current_date - last_date).days
                
                # 确保至少下载1天的内容
                actual_days = max(days_since_last, min_days_limit)
                
                # 但不超过配置的最大天数限制
                actual_days = min(actual_days, days_limit)
                
                target_date = (current_date - timedelta(days=actual_days)).strftime('%Y-%m-%d')
                
                logging.info(f"距离上次下载 {days_since_last} 天，实际下载 {actual_days} 天内的小说")
                
            except ValueError as e:
                logging.warning(f"解析上次下载日期失败: {e}，使用默认天数限制")
                actual_days = max(days_limit, min_days_limit)
                target_date = (current_date - timedelta(days=actual_days)).strftime('%Y-%m-%d')
        
        return target_date, actual_days
    
    def update_last_download_date(self, date: Optional[str] = None) -> None:
        """
        更新上次下载日期
        
        Args:
            date: 指定日期，格式 YYYY-MM-DD，如果为None则使用当前日期
        """
        if date is None:
            date = datetime.now().strftime('%Y-%m-%d')
        
        try:
            # 验证日期格式
            datetime.strptime(date, '%Y-%m-%d')
            
            # 更新配置
            if 'filtering' not in self.config_data:
                self.config_data['filtering'] = {}
            
            self.config_data['filtering']['last_download_date'] = date
            self._save_config()
            
            logging.info(f"已更新上次下载日期为: {date}")
            
        except ValueError as e:
            logging.error(f"日期格式错误: {e}")
            raise
        except Exception as e:
            logging.error(f"更新下载日期失败: {e}")
            raise
    
    def get_last_download_date(self) -> Optional[str]:
        """获取上次下载日期"""
        filtering_config = self.config_data.get('filtering', {})
        return filtering_config.get('last_download_date')
    
    def reset_download_date(self) -> None:
        """重置下载日期（设为None，下次运行时将使用完整的天数限制）"""
        if 'filtering' not in self.config_data:
            self.config_data['filtering'] = {}
        
        self.config_data['filtering']['last_download_date'] = None
        self._save_config()
        
        logging.info("已重置下载日期记录")
    
    def get_days_since_last_download(self) -> Optional[int]:
        """获取距离上次下载的天数"""
        last_date = self.get_last_download_date()
        if last_date is None:
            return None
        
        try:
            last_datetime = datetime.strptime(last_date, '%Y-%m-%d')
            current_datetime = datetime.now()
            return (current_datetime - last_datetime).days
        except ValueError:
            return None